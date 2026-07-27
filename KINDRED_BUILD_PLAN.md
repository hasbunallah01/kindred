# Kindred — Build Plan (Version 1, Frozen)

Derived directly from `KINDRED_IMPLEMENTATION_BLUEPRINT.md`. This document implements that architecture only — no redesign. If an issue surfaces during a checkpoint, the blocker must be explained before any architectural change is considered (see the standing rule at the end of this document).

Each checkpoint: ~30–60 minutes, independently testable, ends in one commit.

---

## Phase 0 — Repo & Tooling Setup

### Checkpoint 1 — Monorepo skeleton
**Goal:** Establish the workspace structure the entire build sits inside.
**Files:** `package.json` (root, workspaces config), `apps/`, `packages/`, `infra/` (empty dirs with `.gitkeep`).
**Expected output:** A root `package.json` declaring `apps/*` and `packages/*` as workspaces; empty folders committed.
**Verify:** `npm install` (or `pnpm install`) runs cleanly at root with no workspace errors.
**Commit:** `chore: initialize monorepo workspace structure`

### Checkpoint 2 — Shared tooling config
**Goal:** One set of compiler/lint rules shared by every package.
**Files:** `tsconfig.base.json`, root `.eslintrc` / `eslint.config.js`, `.prettierrc`, `.gitignore`.
**Expected output:** Shared TS config other packages will `extend`; lint/format rules defined once.
**Verify:** `npx tsc --noEmit -p tsconfig.base.json` runs without error on an empty base.
**Commit:** `chore: add shared TypeScript, lint, and format configuration`

### Checkpoint 3 — Scaffold apps/web
**Goal:** A bare Next.js + TypeScript + Tailwind app with no product pages yet.
**Files:** `apps/web/package.json`, `apps/web/next.config.ts`, `apps/web/tailwind.config.ts`, `apps/web/app/layout.tsx`, `apps/web/app/page.tsx` (placeholder landing).
**Expected output:** `next dev` serves a default page locally.
**Verify:** Visit `localhost:3000`, see the placeholder page render with Tailwind classes applied.
**Commit:** `feat(web): scaffold bare Next.js app with Tailwind`

### Checkpoint 4 — Scaffold apps/agent
**Goal:** A bare Node + TypeScript process that will later host all workers and the SSE listener.
**Files:** `apps/agent/package.json`, `apps/agent/src/index.ts` (logs "agent started" and exits/holds).
**Expected output:** A runnable script with no real logic yet.
**Verify:** `npm run start` inside `apps/agent` prints the startup log with no errors.
**Commit:** `feat(agent): scaffold bare Node/TypeScript agent process`

### Checkpoint 5 — packages/db skeleton
**Goal:** One Prisma project both apps will depend on.
**Files:** `packages/db/package.json`, `packages/db/schema.prisma` (empty datasource/generator block only, no models yet).
**Expected output:** `prisma generate` succeeds against a local `DATABASE_URL`.
**Verify:** Run `npx prisma generate` inside `packages/db`; confirm the client generates with zero models.
**Commit:** `chore(db): initialize empty Prisma project`

### Checkpoint 6 — Local dev infrastructure
**Goal:** Local Postgres + Redis so nothing in later checkpoints depends on cloud services yet.
**Files:** `infra/docker-compose.dev.yml`.
**Expected output:** `docker compose -f infra/docker-compose.dev.yml up` starts Postgres and Redis containers.
**Verify:** Connect to both with a local client (`psql`, `redis-cli PING`) and confirm they respond.
**Commit:** `chore(infra): add local Postgres and Redis via docker-compose`

### Checkpoint 7 — Environment variable manifest
**Goal:** Every variable name from Blueprint Section 11 exists as a documented placeholder before any feature needs one.
**Files:** `.env.example` (root).
**Expected output:** A complete list of variable names with one-line comments on source/timing, no real values.
**Verify:** Diff the file against Blueprint Section 11 — every variable present, nothing extra.
**Commit:** `docs: add complete .env.example from blueprint`

---

## Phase 1 — Database Schema

### Checkpoint 8 — Better Auth models
**Goal:** Add the four tables Better Auth requires (`user`, `session`, `account`, `verification`) exactly as it expects them.
**Files:** `packages/db/schema.prisma`.
**Expected output:** Schema compiles; migration not yet run.
**Verify:** `npx prisma validate` passes.
**Commit:** `feat(db): add Better Auth schema models`

### Checkpoint 9 — Community model
**Goal:** Add the `Community` table per Blueprint §3.2.
**Files:** `packages/db/schema.prisma`, new migration in `packages/db/migrations/`.
**Expected output:** `Community` table exists in the local database with `creatorId` FK, unique `telegramChatId`.
**Verify:** `npx prisma migrate dev` succeeds; inspect the table via `psql \d "Community"`.
**Commit:** `feat(db): add Community model and migration`

### Checkpoint 10 — Member model
**Goal:** Add `Member` with the `(communityId, telegramUserId)` unique constraint and `(communityId, status)` index.
**Files:** `packages/db/schema.prisma` + migration.
**Expected output:** Table created; constraint and index present.
**Verify:** Attempt inserting two rows with the same `(communityId, telegramUserId)` via `psql` — second insert must fail.
**Commit:** `feat(db): add Member model with uniqueness constraint and index`

### Checkpoint 11 — RelationshipEvent model
**Goal:** Add `RelationshipEvent` with the `(memberId, occurredAt)` index and the partial index on `sentToMind = false`.
**Files:** `packages/db/schema.prisma` + migration.
**Expected output:** Table created with both indexes present.
**Verify:** `\d "RelationshipEvent"` in `psql` shows both indexes.
**Commit:** `feat(db): add RelationshipEvent model with batching index`

### Checkpoint 12 — Insight model
**Goal:** Add `Insight` with the `(communityId, createdAt)` index.
**Files:** `packages/db/schema.prisma` + migration.
**Expected output:** Table created.
**Verify:** `\d "Insight"` confirms index; insert a manual test row referencing an existing `Community`.
**Commit:** `feat(db): add Insight model`

### Checkpoint 13 — Notification model
**Goal:** Add `Notification` with FK to `Insight` and index on `insightId`.
**Files:** `packages/db/schema.prisma` + migration.
**Expected output:** Table created.
**Verify:** Insert a `Notification` row referencing the test `Insight` from Checkpoint 12; confirm FK enforcement by attempting an invalid reference.
**Commit:** `feat(db): add Notification model`

### Checkpoint 14 — NotificationPreference model
**Goal:** Add `NotificationPreference` with unique `creatorId`.
**Files:** `packages/db/schema.prisma` + migration.
**Expected output:** Table created; one row per creator enforced.
**Verify:** Attempt two `NotificationPreference` rows for the same `creatorId` — second must fail.
**Commit:** `feat(db): add NotificationPreference model`

### Checkpoint 15 — TelegramLinkRequest model
**Goal:** Add `TelegramLinkRequest` with unique `code`.
**Files:** `packages/db/schema.prisma` + migration.
**Expected output:** Table created.
**Verify:** Insert two rows with the same `code` — second must fail.
**Commit:** `feat(db): add TelegramLinkRequest model`

### Checkpoint 16 — Full schema verification
**Goal:** Confirm the schema exactly matches Blueprint Section 3 before any application code depends on it.
**Files:** None new — review only, plus `prisma generate` output in both `apps/web` and `apps/agent`.
**Expected output:** Prisma client available to both apps; schema-to-blueprint diff is clean.
**Verify:** Manually check every table/field/relationship in Section 3 against the running schema, one by one.
**Commit:** `chore(db): verify full schema against blueprint; generate clients for web and agent`

---

## Phase 2 — Authentication

### Checkpoint 17 — Install Better Auth
**Goal:** Wire Better Auth into `apps/web` against the Prisma adapter, no pages yet.
**Files:** `apps/web/app/api/auth/[...all]/route.ts`, Better Auth config file (e.g., `apps/web/lib/auth.ts`).
**Expected output:** The Better Auth handler responds to its own internal health/session-check endpoint.
**Verify:** `curl localhost:3000/api/auth/session` returns a valid (empty/unauthenticated) response, not a 500.
**Commit:** `feat(web): install and configure Better Auth with Prisma adapter`

### Checkpoint 18 — Resend email adapter
**Goal:** Register Resend as Better Auth's outbound email mechanism for verification.
**Files:** `apps/web/lib/auth.ts` (email hook), `apps/web/lib/email.ts` (Resend client wrapper).
**Expected output:** Calling the sign-up flow triggers a real (or logged, in dev) Resend send request.
**Verify:** Trigger sign-up in dev with a test address; confirm a Resend API call fires (Resend dashboard log or console output).
**Commit:** `feat(web): wire Resend as Better Auth email adapter`

### Checkpoint 19 — Sign-up page
**Goal:** Build the `/signup` page against Better Auth's sign-up call.
**Files:** `apps/web/app/(auth)/signup/page.tsx`.
**Expected output:** Submitting the form creates a `user` row with `emailVerified = false`.
**Verify:** Submit the form; confirm the row via `psql`; confirm a verification email was triggered (Checkpoint 18).
**Commit:** `feat(web): add sign-up page`

### Checkpoint 20 — Login page
**Goal:** Build `/login` against Better Auth's sign-in call.
**Files:** `apps/web/app/(auth)/login/page.tsx`.
**Expected output:** Successful login sets a session cookie and redirects toward onboarding/dashboard.
**Verify:** Log in with the Checkpoint 19 account; inspect browser cookies for the session token.
**Commit:** `feat(web): add login page`

### Checkpoint 21 — Email verification flow
**Goal:** Build `/verify-email`, consuming the token sent in Checkpoint 18.
**Files:** `apps/web/app/(auth)/verify-email/page.tsx`.
**Expected output:** Clicking the emailed link sets `emailVerified = true`.
**Verify:** Click the real link from the test send; confirm the `user` row updates.
**Commit:** `feat(web): add email verification flow`

### Checkpoint 22 — Session middleware
**Goal:** Protect `/dashboard/*` and `/onboarding/*` behind a valid session.
**Files:** `apps/web/middleware.ts`.
**Expected output:** Unauthenticated requests to protected routes redirect to `/login`.
**Verify:** Visit `/dashboard` in an incognito window — confirm redirect; visit while logged in — confirm access.
**Commit:** `feat(web): add session-protection middleware`

### Checkpoint 23 — Password reset flow
**Goal:** Build `/reset-password` and `/reset-password/confirm`.
**Files:** `apps/web/app/(auth)/reset-password/page.tsx`, `apps/web/app/(auth)/reset-password/confirm/page.tsx`.
**Expected output:** Reset email sends via Resend; submitting a new password against a valid token updates credentials.
**Verify:** Full manual reset cycle with a test account; confirm old password no longer works.
**Commit:** `feat(web): add password reset flow`

### Checkpoint 24 — Full auth cycle test
**Goal:** Confirm every auth path works together before building anything on top of it.
**Files:** None new — test pass only; optionally a short `docs/manual-test-log.md` note.
**Expected output:** Documented pass of sign-up → verify → login → logout → reset.
**Verify:** Walk the full cycle manually end-to-end once more, back to back, with no skipped steps.
**Commit:** `test: verify full authentication cycle end-to-end`

---

## Phase 3 — Telegram Linking

### Checkpoint 25 — Bot creation and privacy mode
**Goal:** Create the Kindred Telegram bot and disable privacy mode — a one-time, bot-wide setting (Blueprint §5.2).
**Files:** None in-repo; `infra/deploy/vps-setup-notes.md` updated with the steps taken.
**Expected output:** A working bot token; privacy mode confirmed off via BotFather.
**Verify:** Add the bot to a private test group and send a plain message (no command/mention) — confirm via a temporary logging script that the bot's `getUpdates` receives it.
**Commit:** `docs: record Telegram bot creation and privacy-mode setup`

### Checkpoint 26 — Telegram link request route
**Goal:** Build `/api/telegram/link` to create a `TelegramLinkRequest`.
**Files:** `apps/web/app/api/telegram/link/route.ts`.
**Expected output:** POSTing to this route (as a logged-in creator) creates a row with a fresh code and expiry.
**Verify:** Call the route via an authenticated request; confirm the row in `psql`.
**Commit:** `feat(web): add Telegram link request API route`

### Checkpoint 27 — Onboarding step 1 (DM prompt)
**Goal:** Build the page prompting the creator to `/start` the bot.
**Files:** `apps/web/app/onboarding/page.tsx`.
**Expected output:** Page displays the bot's deep link/username and instructions; advances only after `/start` is confirmed (poll or manual "I've done this" continue for MVP).
**Verify:** Follow the instructions with a real Telegram account; confirm the bot receives the `/start` event (log only at this stage).
**Commit:** `feat(web): add onboarding step 1 — Telegram DM connection`

### Checkpoint 28 — Onboarding step 2 (linking code)
**Goal:** Display the linking code from Checkpoint 26 and instructions to post it in the group.
**Files:** `apps/web/app/onboarding/group/page.tsx`, `apps/web/components/settings/LinkingCodeDisplay.tsx`.
**Expected output:** Page renders a real code tied to the logged-in creator.
**Verify:** Confirm the displayed code matches the `TelegramLinkRequest` row created for that creator.
**Commit:** `feat(web): add onboarding step 2 — linking code display`

### Checkpoint 29 — Telegram webhook receiver
**Goal:** Build `/api/telegram/webhook`: validate the secret, enqueue the raw update, return immediately (Blueprint §5.3 step 1–2).
**Files:** `apps/web/app/api/telegram/webhook/route.ts`, `apps/agent/queues/definitions.ts` (queue name + payload type, shared).
**Expected output:** A valid Telegram update results in a job appearing on the `telegram-ingest` Redis queue; an invalid secret is rejected.
**Verify:** Send a manual POST mimicking a Telegram update; inspect the Redis queue (e.g., via `redis-cli` or a BullMQ UI) for the enqueued job.
**Commit:** `feat(web): add Telegram webhook receiver that enqueues raw updates`

### Checkpoint 30 — Register webhook, confirm delivery
**Goal:** Point the real Telegram bot at the deployed/tunneled webhook URL and confirm live updates flow through.
**Files:** None new — configuration step; note in `infra/deploy/vps-setup-notes.md`.
**Expected output:** Messages sent in the test group appear as queued jobs in near real time.
**Verify:** Send a message in the test group; confirm the corresponding job appears on the queue within seconds.
**Commit:** `docs: confirm live Telegram webhook registration and delivery`

### Checkpoint 31 — Ingest worker skeleton + Community creation
**Goal:** Build the first real `apps/agent` worker: consume the queue, match the linking code, create the `Community` row (Blueprint §5.1 step 4).
**Files:** `apps/agent/src/workers/telegram-ingest.worker.ts`, `apps/agent/src/index.ts` (boot the worker).
**Expected output:** Posting the linking code in the test group creates a `Community` row with the correct `telegramChatId`, and consumes the `TelegramLinkRequest`.
**Verify:** Run the agent locally, post the code in the group, confirm the `Community` row appears and the link request's `consumedAt` is set.
**Commit:** `feat(agent): add Telegram ingest worker with community linking`

### Checkpoint 32 — Onboarding step 3 (success)
**Goal:** Build the confirmation page, gated on `Community.status = active`.
**Files:** `apps/web/app/onboarding/success/page.tsx`.
**Expected output:** Page shows success only once the linked community exists for that creator.
**Verify:** Complete the flow end-to-end; confirm the success page renders with the correct community name.
**Commit:** `feat(web): add onboarding step 3 — success confirmation`

### Checkpoint 33 — Full connect flow test
**Goal:** Validate the entire onboarding → Telegram linking path as one continuous flow.
**Files:** None new — test pass.
**Expected output:** A brand-new test creator account can go from sign-up to a fully linked, active community without manual database intervention.
**Verify:** Run the full flow with a fresh account and a fresh test group, start to finish.
**Commit:** `test: verify full Telegram connection flow end-to-end`

---

## Phase 4 — Telegram Ingestion → Relationship Events

### Checkpoint 34 — Member upsert
**Goal:** Extend the ingest worker to create/update `Member` rows on every incoming message.
**Files:** `apps/agent/src/workers/telegram-ingest.worker.ts`.
**Expected output:** Every distinct Telegram user who messages in the group gets a `Member` row; `lastSeenAt` updates on repeat messages.
**Verify:** Message from two different test accounts; confirm two `Member` rows; message again from one and confirm `lastSeenAt` changes.
**Commit:** `feat(agent): upsert Member records from incoming Telegram messages`

### Checkpoint 35 — Join / first-interaction detection
**Goal:** Implement rule-based detection for `joined` and `first_interaction` event types.
**Files:** `apps/agent/src/telegram/extract-events.ts`.
**Expected output:** A new member's first message produces both a `joined` and a `first_interaction` `RelationshipEvent`.
**Verify:** Add a brand-new test account to the group and send one message; confirm both event rows.
**Commit:** `feat(agent): detect joined and first-interaction relationship events`

### Checkpoint 36 — Creator-interaction detection
**Goal:** Detect when the creator's own Telegram account replies/engages with a member.
**Files:** `apps/agent/src/telegram/extract-events.ts`.
**Expected output:** A message from the creator's linked Telegram identity produces a `creator_interaction` event tied to the relevant member.
**Verify:** Send a message from the creator's account in the test group; confirm the event row and correct `memberId` association.
**Commit:** `feat(agent): detect creator-interaction relationship events`

### Checkpoint 37 — Participation event writing
**Goal:** Write lightweight `participation` events on an interval basis rather than per message, to avoid flooding the ledger.
**Files:** `apps/agent/src/telegram/extract-events.ts`.
**Expected output:** A member active across a session produces one `participation` event per defined window, not one per message.
**Verify:** Send several messages from one account within a short window; confirm only one `participation` event is written for that window.
**Commit:** `feat(agent): write batched participation events`

### Checkpoint 38 — Optional OpenAI fallback (flagged off)
**Goal:** Add the ambiguous-case classification fallback, disabled by default (Blueprint §5.3, §14).
**Files:** `apps/agent/src/telegram/extract-events.ts`, a feature-flag constant in `packages/shared`.
**Expected output:** With the flag off, ambiguous messages are simply skipped/logged, never sent to OpenAI.
**Verify:** Confirm no OpenAI API calls occur with the flag at its default (off); flip it on in a local test only to confirm the code path exists.
**Commit:** `feat(agent): add optional OpenAI fallback for ambiguous event classification (default off)`

### Checkpoint 39 — Ingestion test pass
**Goal:** Confirm the whole ingestion pipeline produces correct, varied `RelationshipEvent`s under realistic mixed traffic.
**Files:** None new — test pass.
**Expected output:** A documented set of test messages produces the exact expected event rows.
**Verify:** Send a scripted sequence of varied messages (new member, repeat member, creator reply, quiet gap) and check every resulting row against expectation.
**Commit:** `test: verify relationship event extraction under mixed message traffic`

---

## Phase 5 — Minds Integration

### Checkpoint 40 — Builder Access Key & API confirmation
**Goal:** Resolve the single biggest open dependency before building anything downstream (Blueprint §6.6, §14). This is a **verification checkpoint, not a build checkpoint** — if blocked, stop and escalate rather than proceeding.
**Files:** None yet — research/account setup; update `.env.example` comment with confirmed base URL.
**Expected output:** A working Builder Access Key and a confirmed Messaging API base URL, tested with one manual request.
**Verify:** A manual `curl`/Postman call to `CreateConversation` succeeds and returns a conversation ID.
**Commit:** `docs: confirm Minds Builder Access Key and Messaging API base URL`

**If blocked here:** explain the blocker explicitly (e.g., "Builder Access Key not yet issued," "endpoint behavior undocumented for X") before considering any change to the Minds architecture in the frozen blueprint.

### Checkpoint 41 — Minds client wrapper
**Goal:** Build a thin, typed wrapper over `CreateConversation`, `SendMessage`, `GetMessageHistory`.
**Files:** `apps/agent/src/minds/client.ts`, `packages/minds-types/index.ts`.
**Expected output:** Three callable functions, each tested against the real API from Checkpoint 40.
**Verify:** Call each function once from a scratch script; confirm expected responses.
**Commit:** `feat(agent): add Minds Messaging API client wrapper`

### Checkpoint 42 — Conversation creation on community activation
**Goal:** Call `CreateConversation` when a `Community` becomes active; persist `mindsConversationId`.
**Files:** `apps/agent/src/workers/telegram-ingest.worker.ts` (extend Checkpoint 31's logic).
**Expected output:** Every newly linked `Community` gets a real Minds conversation ID stored.
**Verify:** Link a new test community; confirm `mindsConversationId` is populated and non-null.
**Commit:** `feat(agent): create Minds conversation on community activation`

### Checkpoint 43 — Digest sender worker
**Goal:** Build `mind-digest-sender.worker`: batch unsent `RelationshipEvent`s per community, `SendMessage`, mark `sentToMind = true`.
**Files:** `apps/agent/src/workers/mind-digest-sender.worker.ts`.
**Expected output:** Accumulated events for a community are sent to the Mind as one structured digest on a scheduled interval; events are marked sent.
**Verify:** Let events accumulate, trigger the worker manually, confirm `sentToMind` flips and the Mind's conversation receives the digest.
**Commit:** `feat(agent): add mind-digest-sender worker for batched relationship events`

### Checkpoint 44 — Digest verification
**Goal:** Confirm the Mind's memory actually reflects what was sent.
**Files:** None new — test pass, possibly a small debug script using `GetMessageHistory`.
**Expected output:** A documented confirmation that the conversation history contains the expected digest content.
**Verify:** Call `GetMessageHistory` after a digest send; manually compare content.
**Commit:** `test: verify Mind conversation history reflects sent digests`

### Checkpoint 45 — Standing instructions
**Goal:** Set the Mind's standing instructions on a test conversation per Blueprint §6.2's example directive.
**Files:** `apps/agent/src/minds/client.ts` (a `setStandingInstructions`-style call if the API supports it directly, else via an initial `SendMessage`), documented in `infra/deploy/vps-setup-notes.md`.
**Expected output:** The Mind holds an explicit, persistent directive to watch for silence, returns, and milestones.
**Verify:** Inspect via `GetConversation`/`GetMessageHistory` that the instruction is present and durable across a fresh call.
**Commit:** `feat(agent): set Kindred Mind standing instructions`

### Checkpoint 46 — Standing-check worker
**Goal:** Build `mind-standing-check.worker`: scheduled nudge supplying fresh deltas (Blueprint §6.6).
**Files:** `apps/agent/src/workers/mind-standing-check.worker.ts`.
**Expected output:** On schedule, the Mind receives a check-in prompt with recent structured changes.
**Verify:** Trigger manually; confirm a message reaches the Mind's conversation and (if the platform surfaces it) any resulting reasoning.
**Commit:** `feat(agent): add mind-standing-check scheduled worker`

**Note:** if week-1 verification (Checkpoint 40) reveals standing instructions self-trigger without this nudge, this checkpoint's job scope shrinks to "supply fresh data only" — that is an implementation detail adjustment within the existing architecture, not a redesign, and should be noted here when it happens.

### Checkpoint 47 — SSE listener
**Goal:** Build `minds/sse-listener.ts`: persistent connection to `SubscribeEvents`, with reconnect-with-backoff.
**Files:** `apps/agent/src/minds/sse-listener.ts`.
**Expected output:** A long-running connection that logs every event received; survives a forced disconnect via reconnect logic.
**Verify:** Start the listener, force-kill the connection (e.g., network interruption simulation), confirm it reconnects and resumes logging.
**Commit:** `feat(agent): add persistent Minds SSE listener with reconnect logic`

### Checkpoint 48 — SSE → Insight pipeline
**Goal:** Convert Mind-originated events into `Insight` rows (`source = autonomous`).
**Files:** `apps/agent/src/minds/sse-listener.ts` (extend).
**Expected output:** Any autonomous output from the Mind results in a new `Insight` row within seconds.
**Verify:** Prompt a scenario likely to trigger the Mind's standing instructions (e.g., simulate a long silence, see Checkpoint 53); confirm the resulting `Insight` row.
**Commit:** `feat(agent): create Insight rows from autonomous Mind output`

### Checkpoint 49 — Reactive question flow
**Goal:** Build `/api/insights/ask` and `AskKindredModal`, completing the reactive round trip end to end.
**Files:** `apps/web/app/api/insights/ask/route.ts`, `apps/web/components/modals/AskKindredModal.tsx`.
**Expected output:** A creator can ask "Who is [member]?" and receive the Mind's answer in the UI.
**Verify:** Ask about a known test member; confirm the answer reflects real accumulated history (names, dates, patterns) rather than a generic response.
**Commit:** `feat(web): add reactive Ask Kindred flow end-to-end`

---

## Phase 6 — Autonomous Signal Detection

### Checkpoint 50 — Inactivity threshold scanner
**Goal:** Build the scheduled scanner that detects `active → quiet → inactive` transitions and writes `absence_started`/`returned` events.
**Files:** `apps/agent/src/workers/inactivity-threshold-scanner.worker.ts`.
**Expected output:** A member who stops messaging past the configured threshold gets `status` updated and a corresponding event written.
**Verify:** Manually backdate a test member's `lastSeenAt` past threshold, run the scanner, confirm status change and event row.
**Commit:** `feat(agent): add inactivity-threshold-scanner worker`

### Checkpoint 51 — Milestone scanner
**Goal:** Build the scheduled scanner detecting upcoming anniversaries and writing `milestone` events.
**Files:** `apps/agent/src/workers/milestone-scanner.worker.ts`.
**Expected output:** A member approaching a join-date anniversary produces a `milestone` event.
**Verify:** Manually set a test member's `firstSeenAt` to trigger an imminent anniversary; run the scanner; confirm the event.
**Commit:** `feat(agent): add milestone-scanner worker`

### Checkpoint 52 — Linking code expiry cleanup
**Goal:** Build the scheduled cleanup job purging expired, unconsumed `TelegramLinkRequest` rows.
**Files:** `apps/agent/src/workers/linking-code-expiry.worker.ts`.
**Expected output:** Expired rows are deleted on schedule; consumed or still-valid rows are untouched.
**Verify:** Insert a manually expired test row; run the job; confirm deletion; confirm a valid row survives.
**Commit:** `feat(agent): add linking-code-expiry cleanup worker`

### Checkpoint 53 — Autonomous detection integration test
**Goal:** Prove the full signal chain: threshold detection → digest → Mind interpretation → autonomous `Insight`.
**Files:** None new — test pass.
**Expected output:** A documented pass showing a simulated inactivity transition surfaces as a Mind-authored insight without manual prompting.
**Verify:** Simulate the transition (Checkpoint 50), allow the digest sender and standing-check jobs to run, confirm an `Insight` row appears referencing that member.
**Commit:** `test: verify end-to-end autonomous insight generation from inactivity signal`

---

## Phase 7 — Notifications

### Checkpoint 54 — Notification preferences UI + API
**Goal:** Build the settings page and API route for `NotificationPreference`.
**Files:** `apps/web/app/dashboard/settings/notifications/page.tsx`, `apps/web/app/api/notifications/preferences/route.ts`.
**Expected output:** A creator can view and update channel toggles, quiet hours, and daily cap.
**Verify:** Change a preference in the UI; confirm the `NotificationPreference` row updates in Postgres.
**Commit:** `feat(web): add notification preferences settings page and API`

### Checkpoint 55 — Dashboard delivery
**Goal:** Build `notification-dispatch.worker`'s simplest path: dashboard delivery, which requires no external send.
**Files:** `apps/agent/src/workers/notification-dispatch.worker.ts`.
**Expected output:** Every new `Insight` produces a `Notification` row with `channel = dashboard`, `status = sent` immediately.
**Verify:** Trigger a test `Insight`; confirm the `Notification` row appears with correct status.
**Commit:** `feat(agent): add notification-dispatch worker with dashboard delivery`

### Checkpoint 56 — Telegram DM channel
**Goal:** Add Telegram DM delivery with quiet-hours and daily-cap enforcement.
**Files:** `apps/agent/src/notifications/telegram-channel.ts`, extend `notification-dispatch.worker.ts`.
**Expected output:** An enabled creator receives a real Telegram DM for a new insight, respecting quiet hours and the daily ceiling.
**Verify:** Trigger an insight inside allowed hours — confirm DM arrives; trigger one during configured quiet hours — confirm it queues instead of sending immediately.
**Commit:** `feat(agent): add Telegram DM notification channel with quiet hours and rate limiting`

### Checkpoint 57 — Email channel
**Goal:** Add email delivery via Resend for creators who opt in.
**Files:** `apps/agent/src/notifications/email-channel.ts`, extend `notification-dispatch.worker.ts`.
**Expected output:** An opted-in creator receives an email for a new insight.
**Verify:** Enable email in preferences; trigger an insight; confirm receipt.
**Commit:** `feat(agent): add email notification channel via Resend`

### Checkpoint 58 — Notification fan-out test
**Goal:** Confirm dedupe, rate-limiting, and multi-channel fan-out all work together correctly.
**Files:** None new — test pass.
**Expected output:** A documented pass showing correct behavior under: normal delivery, quiet hours, daily cap exceeded, and a duplicate insight within the dedupe window.
**Verify:** Run each of the four scenarios manually and confirm the expected `Notification` outcomes.
**Commit:** `test: verify notification dispatch rules across all channels`

---

## Phase 8 — Dashboard UI

### Checkpoint 59 — Dashboard overview page
**Goal:** Build the main dashboard: insight feed plus the three relationship widgets.
**Files:** `apps/web/app/dashboard/page.tsx`, `apps/web/components/dashboard/InsightCard.tsx`, `LoyalFansList.tsx`, `ReturningFansList.tsx`, `GoingQuietList.tsx`.
**Expected output:** Real data from Postgres renders correctly for a test creator with seeded activity.
**Verify:** Load the dashboard as the test creator; confirm each widget reflects actual `Member`/`Insight` state.
**Commit:** `feat(web): add dashboard overview page with insight feed and relationship widgets`

### Checkpoint 60 — Member relationship timeline
**Goal:** Build the per-member timeline page.
**Files:** `apps/web/app/dashboard/members/[memberId]/page.tsx`, `apps/web/components/dashboard/RelationshipTimeline.tsx`, `apps/web/app/api/members/[memberId]/route.ts`.
**Expected output:** A chronological view of one member's full `RelationshipEvent` history.
**Verify:** Open a test member's page; confirm every event from earlier checkpoints appears in correct order.
**Commit:** `feat(web): add member relationship timeline page`

### Checkpoint 61 — Insight and notification history pages
**Goal:** Build full-history views beyond the dashboard's summarized feed.
**Files:** `apps/web/app/dashboard/insights/page.tsx`, `apps/web/app/dashboard/notifications/page.tsx`, `apps/web/app/api/insights/route.ts`, `apps/web/app/api/notifications/route.ts`.
**Expected output:** Paginated, filterable history of all insights and all notification deliveries.
**Verify:** Confirm counts match the underlying tables; confirm "mark read/acted" updates via the insights PATCH endpoint.
**Commit:** `feat(web): add insight history and notification history pages`

### Checkpoint 62 — Community settings and disconnect flow
**Goal:** Build community management, including the disconnect modal.
**Files:** `apps/web/app/dashboard/settings/telegram/page.tsx`, `apps/web/components/modals/DisconnectCommunityModal.tsx`, `apps/web/app/api/community/route.ts`.
**Expected output:** A creator can view connected communities and disconnect one (soft: `status = disconnected`).
**Verify:** Disconnect a test community; confirm its status changes and it stops appearing as active, without deleting historical data.
**Commit:** `feat(web): add community settings and disconnect flow`

---

## Phase 9 — Demo Integrity & Polish

### Checkpoint 63 — Demo threshold override
**Goal:** Implement `DEMO_INACTIVITY_DAYS` as an explicit, labeled override for demo-timescale triggering.
**Files:** `apps/agent/src/workers/inactivity-threshold-scanner.worker.ts` (read override if present), `.env.example` (already documented in Checkpoint 7).
**Expected output:** With the override set, inactivity triggers fire on a compressed timescale suitable for a short demo.
**Verify:** Set the override to a small value locally; confirm a test member transitions to `quiet` far faster than production thresholds would allow.
**Commit:** `feat(agent): add labeled demo inactivity threshold override`

### Checkpoint 64 — Seed the demo scenario
**Goal:** Script and run the multi-day seeding sequence through the real pipeline (Blueprint §9's integrity policy — no direct database inserts).
**Files:** A seeding script (location TBD at implementation time, outside product code — e.g., `infra/deploy/demo-seed-notes.md` documenting the exact message sequence and timing used).
**Expected output:** A test community with realistic relationship history built entirely by sending real messages over real elapsed time (or compressed via the Checkpoint 63 override), never by inserting rows directly.
**Verify:** Confirm every `RelationshipEvent` in the demo community traces back to an actual ingested Telegram message.
**Commit:** `chore: seed demo community through real ingestion pipeline`

### Checkpoint 65 — Record the demo video
**Goal:** Produce the 1.5–2 minute submission video per Blueprint §9's sequence.
**Files:** None in the app repo; the recorded video file itself, stored per submission requirements.
**Expected output:** A video showing sign-in → dashboard → reactive question → return in a later session, still remembered → autonomous inactivity notification.
**Verify:** Watch the full recording back; confirm it matches the required sequence within the time limit.
**Commit:** `docs: add demo video reference/link to README`

---

## Phase 10 — Deployment

### Checkpoint 66 — Deploy apps/web to Vercel
**Goal:** Production deployment of the web app with real environment variables.
**Files:** `infra/deploy/vercel.json`.
**Expected output:** The dashboard is reachable at a production URL with working auth against production Postgres.
**Verify:** Sign up a fresh account against the production deployment; confirm the full auth cycle works there too.
**Commit:** `chore(deploy): configure and deploy web app to Vercel`

### Checkpoint 67 — Provision the VPS
**Goal:** Set up PM2, Redis, and deploy `apps/agent` to the VPS.
**Files:** `apps/agent/ecosystem.config.js`, `infra/deploy/vps-setup-notes.md` (finalized).
**Expected output:** All agent workers and the SSE listener running under PM2, auto-restarting on crash.
**Verify:** `pm2 list` shows every process online; force-kill one and confirm PM2 restarts it.
**Commit:** `chore(deploy): provision VPS and deploy agent processes under PM2`

### Checkpoint 68 — Point production endpoints at real URLs
**Goal:** Register the Telegram webhook and confirm Minds integration against production, not local/tunnel URLs.
**Files:** None new — configuration step; update `infra/deploy/vps-setup-notes.md`.
**Expected output:** Telegram delivers updates to the production webhook; the agent on the VPS processes them correctly.
**Verify:** Send a message in the production test group; confirm it flows through the full production pipeline to an `Insight`.
**Commit:** `chore(deploy): point Telegram webhook and verify production Minds integration`

### Checkpoint 69 — Final production smoke test
**Goal:** One last full pass of the entire product in production before submission.
**Files:** None new — test pass.
**Expected output:** A documented, successful run of the complete demo sequence against the live production deployment.
**Verify:** Repeat the exact sequence from Checkpoint 65 against production URLs, start to finish, with no local fallbacks.
**Commit:** `test: final end-to-end production smoke test before submission`

---

## Standing Rule for the Remainder of the Build

If any checkpoint above surfaces a genuine blocker — something the frozen blueprint assumed that turns out to be false, or something the official Minds documentation or hackathon rules require differently — the response is:

1. **Stop.** Do not silently redesign.
2. **State the blocker plainly:** what was assumed, what was found instead, and why it prevents this checkpoint from completing as written.
3. **Only then** propose the minimal architectural change required — scoped to the blocker, not a broader redesign — and wait for confirmation before proceeding.

This applies for the rest of the build. Version 1 of the architecture stays frozen otherwise.
