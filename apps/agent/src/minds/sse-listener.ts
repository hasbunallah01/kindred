import { EventSource } from 'eventsource';

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
    const accessKey = process.env.MINDS_BUILDER_API_KEY;
    if (!accessKey) {
      console.error('MINDS_BUILDER_API_KEY is not set — cannot start Minds SSE listener.');
      return;
    }

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
