import { EventSource } from 'eventsource';
import { prisma } from '@kindred/db';
import { sanitizeEnvValue } from '@kindred/minds-client';

// Persistent connection to SubscribeEvents on the official Hello Minds
// Builder API (Blueprint Section 6.4/6.6). Node.js has no native
// EventSource (that's a browser-only API), hence the 'eventsource' npm
// package, which supports Node via a fetch-override for custom headers
// (its default constructor has no headers option, unlike browser
// EventSource's cookie-based auth model).
const BASE_URL = 'https://api.build.hellominds.ai';
const SUBSCRIBE_EVENTS_PATH = '/v1/messaging/events';

const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30_000;

export interface SseListenerHandle {
  close: () => void;
}

// Starts the listener and manages reconnection with exponential backoff
// entirely explicitly — the library's own default auto-reconnect uses a
// fixed delay, not backoff, and calling close() below deliberately takes
// the connection out of a state where the library would retry on its
// own, so there is exactly one reconnect mechanism in play, not two
// competing ones.
export function startMindsSseListener(
  onEvent: (data: string) => void,
  url: string = `${BASE_URL}${SUBSCRIBE_EVENTS_PATH}`,
): SseListenerHandle {
  // Fail fast at the entry point if the only credential this listener
  // actually needs is missing. Previously, the missing-key check lived
  // inside connect() and silently returned — the listener looked
  // started, PM2 reported healthy, and autonomous insights never
  // arrived. Throwing here makes the failure visible at boot.
  //
  // MINDS_ID is intentionally not checked here: this listener only
  // authenticates the SSE connection with the API key. MINDS_ID is
  // already covered for the rest of the agent by
  // apps/agent/src/index.ts validateRequiredEnv, which runs before
  // this function is called from the normal startup path.
  const rawApiKey = process.env.MINDS_BUILDER_API_KEY;
  if (!rawApiKey) {
    throw new Error(
      'Minds SSE listener cannot start: MINDS_BUILDER_API_KEY is not set. ' +
        'Configure it in the VPS environment and restart PM2.',
    );
  }
  let reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
  let closedByCaller = false;
  let eventSource: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect(): void {
    const rawApiKey = process.env.MINDS_BUILDER_API_KEY;
    if (!rawApiKey) {
      console.error('MINDS_BUILDER_API_KEY is not set — cannot start Minds SSE listener.');
      return;
    }
    // Same fix as packages/minds-client/index.ts's authHeaders() — a
    // confirmed real production bug, not hypothetical: an env var value
    // copied from a dashboard can carry invisible Unicode formatting
    // characters that fetch's Headers rejects with "Cannot convert
    // argument to a ByteString".
    const apiKey = sanitizeEnvValue(rawApiKey);

    eventSource = new EventSource(url, {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          headers: { ...init?.headers, 'X-Api-Key': apiKey },
        }),
    });

    eventSource.onopen = () => {
      console.log('Minds SSE listener connected.');
      reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS; // Reset backoff on a healthy connection.
    };

    eventSource.onmessage = (event: MessageEvent) => {
      onEvent(event.data as string);
    };

    eventSource.onerror = (error: unknown) => {
      console.error('Minds SSE listener error:', error);
      eventSource?.close();

      if (closedByCaller) {
        return;
      }

      const delay = reconnectDelayMs;
      reconnectDelayMs = Math.min(reconnectDelayMs * 2, MAX_RECONNECT_DELAY_MS);
      console.log(`Reconnecting Minds SSE listener in ${delay}ms...`);
      reconnectTimer = setTimeout(connect, delay);
    };
  }

  connect();

  return {
    close: () => {
      closedByCaller = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      eventSource?.close();
    },
  };
}

// Checkpoint 48: turns Mind-originated SSE events into Insight rows
// (source: 'autonomous'). Deliberately a separate function from
// startMindsSseListener above, not a change to it — that function is
// generic and Prisma-free, and its connection/reconnect behavior was
// already proven correct with a real local test (Checkpoint 47); this
// layers the actual business logic on top via the same onEvent callback
// shape, rather than modifying the tested function itself.
//
// TODO(builders-api-sse-shape): confirm the exact JSON field names of a
// Minds SSE event payload against the official Hello Minds Builder API
// docs. The shape assumed below (an object with a top-level "alias" and
// a nested message.content) was carried over from the previous
// (now-deprecated) API guess. Parsed defensively — any event that
// doesn't match is logged and skipped rather than crashing the
// listener — but a real verification may require renaming the fields
// here once the Builder API SSE schema is known.
interface MindsSseEventPayload {
  alias?: string;
  // The current Minds Builder API emits the assistant's text at the top
  // level as `messageText` (not nested under `message.content` as the
  // earlier schema did). Both shapes are accepted here so the listener
  // works against either the current API or any older build that still
  // emits the nested shape.
  messageText?: string;
  message?: {
    role?: string;
    content?: string;
  };
}

// The Mind returns assistant text as a small HTML fragment
// (`<p>…</p>`, occasionally `<ul><li>…</li></ul>` or `<br>`). The
// dashboard and the in-app insight card render `content` as plain
// text, so without this conversion the user would see literal
// `<p>` / `</p>` characters in the UI. Block-level tags get
// converted to paragraph breaks; inline formatting is stripped; the
// final whitespace is normalized so the result fits cleanly in the
// React `<p>` that wraps it.
function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|h[1-6]|div)>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function handleMindsSseEvent(data: string): Promise<void> {
  let payload: MindsSseEventPayload;
  try {
    payload = JSON.parse(data) as MindsSseEventPayload;
  } catch {
    console.error('Received non-JSON Minds SSE event, skipping:', data);
    return;
  }

  const { alias, message } = payload;
  // Prefer the top-level `messageText` (current Minds API shape); fall
  // back to the older nested `message.content` so this listener remains
  // compatible with any older build of the API.
  const rawContent = payload.messageText ?? message?.content;
  // The Mind emits HTML; the dashboard renders plain text. Convert
  // before persisting so the DB stores clean text and any future
  // renderer (dashboard, future surfaces) gets a value it can
  // display directly.
  const content = rawContent ? htmlToText(rawContent) : undefined;

  if (!alias || !content) {
    console.error('Minds SSE event missing alias or message content, skipping:', payload);
    return;
  }

  const community = await prisma.community.findFirst({
    where: { mindsConversationId: alias },
  });

  if (!community) {
    console.error(`No Community found for Mind conversation alias "${alias}", skipping.`);
    return;
  }

  await prisma.insight.create({
    data: {
      communityId: community.id,
      source: 'autonomous',
      content,
    },
  });

  console.log(`Created autonomous Insight for community ${community.id}.`);
}

// Convenience wrapper for apps/agent/src/index.ts — starts the listener
// wired directly to the Insight-creation handler above.
export function startMindsInsightListener(): SseListenerHandle {
  return startMindsSseListener((data) => {
    void handleMindsSseEvent(data).catch((error: unknown) => {
      console.error('Failed to handle Minds SSE event:', error);
    });
  });
}
