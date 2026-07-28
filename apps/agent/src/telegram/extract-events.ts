// Raw message context -> structured RelationshipEvent candidates.
//
// Kept as pure functions (no Prisma, no I/O) so the extraction rules
// themselves stay testable in isolation from the worker's DB/queue
// plumbing — the worker (telegram-ingest.worker.ts) is what actually
// persists whatever this returns.

export interface ExtractedEvent {
  type: 'joined' | 'first_interaction' | 'creator_interaction' | 'participation';
  payload: Record<string, unknown>;
  occurredAt: Date;
  // Only set for creator_interaction, where the event belongs to the
  // member being replied to, not the message's own sender (Checkpoint 36).
  memberIdOverride?: string;
}

export interface ExtractContext {
  isNewMember: boolean;
  messageText: string;
  occurredAt: Date;
}

function truncate(text: string, maxLength = 200): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

// Checkpoint 35: a brand-new member's first message produces both a
// 'joined' and a 'first_interaction' event — two distinct facts (they
// arrived; they said something) even though they happen at the same
// instant.
export function extractEvents(context: ExtractContext): ExtractedEvent[] {
  const events: ExtractedEvent[] = [];

  if (context.isNewMember) {
    events.push({
      type: 'joined',
      payload: {},
      occurredAt: context.occurredAt,
    });
    events.push({
      type: 'first_interaction',
      payload: { messagePreview: truncate(context.messageText) },
      occurredAt: context.occurredAt,
    });
  }

  return events;
}
