import { EventSource } from 'eventsource';
import { prisma } from '@kindred/db';
import { sanitizeEnvValue } from '@kindred/minds-client';

// Persistent connection to SubscribeEvents (Blueprint Section 6.4/6.6),
// the sixth documented tool confirmed at Checkpoint 40/41. Node.js has no
// native EventSource (that's a browser-only API — the Bazaar listing
// itself notes "Frontend apps should use EventSource API directly"),
// hence the 'eventsource' npm package, which supports Node via a
// fetch-override for custom headers (its default constructor has no
// headers option, unlike browser EventSource's cookie-based auth model).
//
// NOT CONFIRMED: the exact URL path below — same caveat as
// packages/minds-client/index.ts (no OpenAPI spec, SDK, or rendered docs
// page was reachable from this sandbox). Isolated here as the one place
// to fix if it differs from what your own logged-in dashboard shows.
const BASE_URL = process.env.HELLOMINDS_API_URL ?? 'https://hellominds.ai';
const SUBSCRIBE_EVENTS_PATH = '/api/messaging/events';

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
  let reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
  let closedByCaller = false;
  let eventSource: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect(): void {
    const rawAccessKey = process.env.MINDS_BUILDER_API_KEY;
    if (!rawAccessKey) {
      console.error('MINDS_BUILDER_API_KEY is not set — cannot start Minds SSE listener.');
      return;
    }
    // Same fix as packages/minds-client/index.ts's authHeaders() — a
    // confirmed real production bug, not hypothetical: an env var value
    // copied from a dashboard can carry invisible Unicode formatting
    // characters that fetch's Headers rejects with "Cannot convert
    // argument to a ByteString".
    const accessKey = sanitizeEnvValue(rawAccessKey);

    eventSource = new EventSource(url, {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          headers: { ...init?.headers, 'X-Access-Key': accessKey },
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
// NOT CONFIRMED: the exact JSON shape of an SSE event payload. No
// OpenAPI spec or rendered docs page was reachable from this sandbox —
// same caveat as every other unconfirmed detail in packages/minds-client
// and this file. The shape assumed below (an object with an "alias" and
// a nested message.content) is a reasonable construction from the
// Bazaar listing's description ("real-time message updates... filter by
// alias"), not a verified schema. Parsed defensively — any event that
// doesn't match is logged and skipped rather than crashing the listener.
interface MindsSseEventPayload {
  alias?: string;
  message?: {
    role?: string;
    content?: string;
  };
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
  const content = message?.content;

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
