// This file used to define a BullMQ Worker for the digest-sender
// scheduled job. After the BullMQ removal (agent refactor), the
// function body lives in apps/agent/src/handlers.ts (runDigest) and
// is invoked on a setInterval from apps/agent/src/index.ts. The
// re-export below is the only thing left here so any future caller
// that still imports from the old path (`import { runDigest } from
// '../workers/mind-digest-sender.worker'`) keeps resolving to a
// working symbol — no caller exists today (index.ts uses handlers.ts
// directly), but the shim is cheap insurance against an unmerged
// branch or a stale import. Safe to delete this file once the
// scheduled-job migration has been on production for >1 week.
export { runDigest } from '../handlers';
