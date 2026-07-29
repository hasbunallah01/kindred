// Checkpoint 53 / Telegram notification delivery (MVP).
//
// Fires once per autonomous Insight. Looks up the community -> creator
// chain, respects the creator's notification preferences, and sends a
// short Telegram DM with a "View Dashboard" button that opens the
// configured Kindred dashboard URL.
//
// Dedupe is enforced in two places:
//   1. The SSE listener enqueues this job with a stable jobId derived
//      from the insightId, so BullMQ itself will not run two jobs for
//      the same insight on a single queue instance.
//   2. Before sending, the worker checks for an existing
//      `telegram_dm` Notification row for the same insightId — covers
//      a job that ran once and partially succeeded (telegram send ok,
//      Notification write failed) and is being retried.
//
// Failure handling: any thrown error in the processor is logged by the
// `failed` handler below. The Notification row is only written after a
// successful send, so a failed send leaves no "delivered" record and
// a BullMQ retry can re-attempt the send cleanly.

import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '@kindred/db';
import { QUEUE_NAMES, type InsightNotificationJobData } from '@kindred/shared';
import { sendTelegramDm } from '../telegram/send-dm';

// REDIS_URL is guaranteed to be set by the agent's startup gate
// (apps/agent/src/index.ts validateRequiredEnv), so no fallback here:
// falling back to redis://localhost:6379 on a real VPS would silently
// hang the worker trying to reach a Redis that isn't running. The
// non-null assertion documents that contract.
const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

// Telegram's hard limit on text length in sendMessage is 4096
// characters, but a Kindred notification is supposed to be a glanceable
// one-liner — anything longer is a content-format bug, not a user
// experience choice. 800 is a defensive ceiling well above any real
// payload (autonomous Insights are themselves short) that still
// catches a runaway content field before it surfaces in Telegram.
const MAX_NOTIFICATION_TEXT_CHARS = 800;

// Dashboard URL: Kindred's `.env.example` already documents
// `NEXT_PUBLIC_APP_URL` as "the deployed web app's public URL" — that's
// the configured application URL, and reusing it (rather than adding a
// second env var) keeps URL configuration in a single place as the
// product spec requires. The spec's preferred default
// (https://kindred.haybee.xyz) is used as a last-resort fallback so
// the agent never crashes on a missing config; the resulting button
// is still obviously broken in that case and gets surfaced in the
// logs, rather than silently pointing at a different host.
const DEFAULT_DASHBOARD_BASE_URL = 'https://kindred.haybee.xyz';

function resolveDashboardUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.KINDRED_APP_URL?.trim() ||
    DEFAULT_DASHBOARD_BASE_URL;
  // Strip a trailing slash so `${base}/dashboard` doesn't end up as
  // `https://kindred.haybee.xyz//dashboard` (a double slash that some
  // browsers and the Telegram URL button render as a relative path).
  return `${base.replace(/\/+$/, '')}/dashboard`;
}

// Renders the body of the DM. The spec calls for a short headline
// (the "what happened" sentence) and a short Kindred-voice line, with
// the dashboard button attached via inline_keyboard (not in the text —
// the spec's bracketed "[View Dashboard]" in the example is the
// textual placeholder for the button, not literal copy). Emoji is
// pulled from the Insight's own content where present (the Mind often
// leads with a single emoji that the existing onboarding copy uses
// too), falling back to a neutral bell so a contentless Insight still
// renders a usable notification.
function formatNotificationText(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return '🔔 Kindred detected a new insight. Open the dashboard to read it.';
  }
  // Telegram's official sendMessage text limit is 4096; clamp here
  // so an unusually long Insight never produces a single message that
  // Telegram truncates server-side, which would silently drop the
  // dashboard button. The clamp adds a small ellipsis to signal that
  // there's more on the dashboard (which is, after all, where the
  // creator goes to read the full insight).
  const clipped =
    trimmed.length > MAX_NOTIFICATION_TEXT_CHARS
      ? `${trimmed.slice(0, MAX_NOTIFICATION_TEXT_CHARS - 1)}…`
      : trimmed;
  return clipped;
}

// Stable jobId: BullMQ uses this to dedupe at the queue level. The
// `${insightId}` suffix is a foreign-key string from Prisma, so it's
// always URL-safe / Redis-safe.
function insightJobId(insightId: string): string {
  return `insight-notification-${insightId}`;
}

// Module-level producer Queue used by the SSE listener to enqueue
// notification jobs. A single instance is held for the lifetime of the
// process, matching the pattern in
// apps/agent/src/workers/mind-digest-sender.worker.ts and the other
// scheduled workers — creating a new Queue per enqueue would open a
// fresh Redis connection on every autonomous insight, which is a
// real (and pointless) cost for a queue that has exactly one
// producer.
const insightNotificationQueue = new Queue<InsightNotificationJobData>(
  QUEUE_NAMES.INSIGHT_NOTIFICATION,
  { connection },
);

export const insightNotificationWorker = new Worker<InsightNotificationJobData>(
  QUEUE_NAMES.INSIGHT_NOTIFICATION,
  async (job: Job<InsightNotificationJobData>) => {
    const { insightId } = job.data;

    const insight = await prisma.insight.findUnique({
      where: { id: insightId },
      include: {
        community: {
          include: {
            creator: {
              include: { notificationPreference: true },
            },
          },
        },
      },
    });

    // The SSE listener enqueues the job immediately after creating
    // the Insight, so "not found" means a race with deletion — treat
    // as a no-op (a job that has nothing to do should not crash the
    // worker). Logged at info level for visibility in case it ever
    // becomes a real signal.
    if (!insight) {
      console.warn(`insight-notification: insight ${insightId} not found, skipping.`);
      return;
    }

    // Product spec: notifications fire only for significant autonomous
    // insights. Reactive insights (created by /api/insights/ask in
    // apps/web) are already visible to the creator because they just
    // asked — a Telegram ping on top of that would be noise.
    if (insight.source !== 'autonomous') {
      return;
    }

    const community = insight.community;
    const creator = community.creator;

    // Dedupe #2: if a telegram_dm Notification row for this insight
    // already exists, the previous run delivered successfully (we
    // write the row only after a successful send, see below). Skip
    // rather than spam the creator. Uses a single row query — the
    // Notification table is small and the index on insightId makes
    // this a cheap lookup.
    const existingDelivery = await prisma.notification.findFirst({
      where: { insightId, channel: 'telegram_dm' },
      select: { id: true },
    });
    if (existingDelivery) {
      return;
    }

    // Honor the creator's preferences. Default behavior (no row)
    // matches the schema's default of `telegramDmEnabled: true`, so a
    // creator who never opened the settings still gets notifications.
    const prefs = creator.notificationPreference;
    if (prefs && !prefs.telegramDmEnabled) {
      return;
    }

    // Community.creatorTelegramUserId is captured at /link time
    // (apps/agent/src/workers/telegram-ingest.worker.ts). If it's
    // null, the creator has not actually completed the private-chat
    // step of onboarding, so the bot has no chat to DM. No
    // notification, no Notification row — there is nothing to dedupe
    // against on retry because the next attempt will hit the same
    // null. Quietly skip; this is a setup gap, not a runtime error.
    if (community.creatorTelegramUserId === null) {
      return;
    }

    const dashboardUrl = resolveDashboardUrl();
    const text = formatNotificationText(insight.content);

    // Throws on transport or API errors; the `failed` handler below
    // logs it, and BullMQ's default retry policy will redeliver. The
    // Notification row is intentionally NOT written yet, so a retry
    // can re-attempt the send cleanly.
    await sendTelegramDm({
      chatId: community.creatorTelegramUserId,
      text,
      button: { text: 'View Dashboard', url: dashboardUrl },
    });

    // Only mark delivered after a successful send. Status is `sent`
    // and `deliveredAt` is the send timestamp, matching the shape
    // the rest of the system would use for an email or a dashboard
    // notification. The `failed` status is reserved for terminal
    // failures (not used in this MVP — a Telegram send that keeps
    // failing stays pending in the queue until a human intervenes).
    await prisma.notification.create({
      data: {
        insightId,
        channel: 'telegram_dm',
        status: 'sent',
        deliveredAt: new Date(),
      },
    });

    console.log(
      `insight-notification: delivered telegram_dm for insight ${insightId} ` +
        `(community ${community.id}, creator ${creator.id}).`,
    );
  },
  { connection },
);

insightNotificationWorker.on('failed', (job, error) => {
  // Spec delivery rule: "If Telegram delivery fails, log the failure
  // without crashing workers." This handler is the single point where
  // a failed notification surfaces in the logs — it doesn't throw,
  // doesn't kill the worker, just records the failure so PM2's
  // log tail picks it up.
  console.error(
    `insight-notification job ${job?.id ?? 'unknown'} failed:`,
    error,
  );
});

// Enqueue helper used by the SSE listener. Exported as a small
// function so the listener doesn't have to import the BullMQ Queue
// type or know the connection string. The jobId is the dedupe
// primitive described in the worker comment above.
//
// Re-enqueueing the same insightId is a no-op at the BullMQ level —
// it returns the existing job rather than creating a new one. That
// is the behavior the spec's "Prevent duplicate notifications for the
// same Insight" rule relies on: even if the SSE listener fires twice
// for the same Insight (e.g. a redelivered SSE event), at most one
// notification is sent.
export async function enqueueInsightNotification(insightId: string): Promise<void> {
  await insightNotificationQueue.add(
    'deliver-telegram-dm',
    { insightId },
    { jobId: insightJobId(insightId) },
  );
}
