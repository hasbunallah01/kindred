# AGENTS.md — Binding directives for any coding agent working in this repo

> **Read this first.** These rules override default behavior. They apply to every agent
> (human or AI) asked to make changes in this repository, including Mavis and any other
> MiniMax instance the user spins up. If a later instruction from a user contradicts a
> rule below, stop and confirm before acting.

---

## 🚧 Backend feature freeze (effective immediately)

**Backend feature development is FROZEN.** No new backend features should be added
unless the user explicitly requests one in the same task.

### What counts as "backend" (frozen)

- `apps/agent/` — every file: workers, Minds SSE listener, Telegram ingest, BullMQ
  jobs, recurring schedules, the runtime entrypoint, anything that runs on the VPS.
- `apps/web/app/api/` — every server route (API endpoints).
- `apps/web/middleware.ts`, `apps/web/next.config.ts` (where it touches server behavior).
- `packages/` — every package, including `@kindred/db`, `@kindred/minds-client`,
  `@kindred/shared`, and any new shared package.
- `infra/` — deployment scripts, docker-compose, VPS setup notes, CI workflows.
- Database schema (`packages/db/prisma/schema.prisma`) — schema changes are a
  schema redesign and are not a "bug fix".
- Prisma migrations.
- Environment variable contracts (`.env.example`, anything that adds/renames/removes
  a variable consumed by backend code).
- Anything that increases the call rate to the Hello Minds Builder API, adds a new
  scheduled job, adds a new BullMQ queue, or changes how often a worker runs.

### What is NOT frozen

- **Frontend only** is the new development surface. The following are fair game:
  - `apps/web/components/`
  - `apps/web/app/**/page.tsx`, `layout.tsx`, client components, styles, Tailwind
    config (visual only), public assets, copy.
  - Read-only calls from client components to existing `apps/web/app/api/...` routes
    are fine. **Adding new API routes is not.**
- Documentation updates (`README.md`, `PROJECT_BIBLE.md`, `KINDRED_*.md`,
  `infra/deploy/vps-setup-notes.md`).
- Bug fixes anywhere — frontend or backend.

### What counts as a "bug fix" (still allowed)

A backend change qualifies as a bug fix only if all of the following are true:

1. There is a **concrete, reproducible failure** (wrong status code, wrong field
   name, broken auth, miscompiled types, runtime error, etc.).
2. The user is **not** asking for new behavior — they are asking to restore intended
   behavior that is already broken.
3. The fix is **the smallest change** that resolves the failure, with no refactor
   of unrelated code.

If any of these is unclear, stop and ask the user. Do not improvise.

### When in doubt

**Stop and ask.** This is the default for any agent in this repo. Specifically:

- "The user wants X but X requires a new worker." → ask before adding it.
- "The user wants X but X requires a new column." → ask before changing the schema.
- "The user wants X but X requires a new endpoint." → ask before adding the route.
- "The user wants X but X touches the Minds client signature." → ask before changing
  the public surface of `@kindred/minds-client`.
- "I think I can do this in the frontend with the existing API." → do that, instead
  of reaching for the backend.

### How to phrase an ask

If you need to confirm, say exactly what you need from the user and why, then stop
and wait. Do not start the change on a "best guess" basis.

---

## Other standing rules (carried over from the existing repo)

These are not new — they are the rules the project has always followed. They are
pinned here so any agent can see them in one place.

1. **Do not modify the Minds client (`packages/minds-client/index.ts`) unless the
   user explicitly asks in the current task.** The contract is pinned to the
   official Hello Minds Builder API and the call sites are pinned to it.
2. **Do not remove or modify `apps/web/app/api/test-minds/route.ts` without the
   user's explicit instruction.** It is a temporary diagnostic; its removal is
   gated on verified working integration.
3. **Do not deploy anything new** without the user's explicit instruction.
4. **One task = one commit** (unless the user specifies a different commit
   structure). No drive-by refactors in a bug-fix commit.
5. **Typecheck before committing.** The Minds client and the affected app package
   must pass `tsc --noEmit` cleanly. A pre-existing unrelated error in a file
   you did not touch is acceptable to mention in the report but not to fix.
6. **Never paste, log, or echo secret env values.** `MINDS_BUILDER_API_KEY`,
   `RESEND_API_KEY`, `TELEGRAM_BOT_TOKEN`, `BETTER_AUTH_SECRET`, etc. are
   sensitive. Report presence/length/character issues only.

---

## When this file changes

If the user lifts or modifies the backend freeze, update this file in the same
change. The README's "Development Freeze" section should stay in sync with this one.
