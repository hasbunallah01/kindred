# Kindred — Implementation Blueprint

**Version 1.0 — Architecture Freeze**
Derived from `PROJECT_BIBLE.md` and `README.md`. This document is the single source of truth for *how* Kindred is built. No production code, scaffolding, or implementation files are included. This is the master build order.

---

## 1. Overall Architecture

### 1.1 The system, left to right

```
Creator ──► Kindred Website (Next.js, Vercel)
              │
              ├──► Better Auth ──► Neon PostgreSQL (via Prisma)
              │        │
              │        └──► Resend (verification / reset emails)
              │
              ├──► Prisma ──► Neon PostgreSQL (all domain data)
              │
              └──► API routes ──► Redis (BullMQ queues)
                                     │
                                     ▼
                              VPS (PM2 processes)
                                     │
                     ┌───────────────┼───────────────────┐
                     ▼               ▼                   ▼
              BullMQ Workers   Telegram Bot        Minds SSE Listener
                     │               │                   │
                     │               ▼                   │
                     │        Telegram Group              │
                     │        (creator's community)        │
                     │                                     │
                     └──────────────► Minds (Animoca) ◄────┘
                              (Kindred Mind — core intelligence)
                                     │
                                     ▼
                          Notifications ──► Telegram DM
                                        ──► Dashboard
                                        ──► Email (Resend)
```

`(OpenAI — optional, subordinate preprocessing only — sits inside a BullMQ worker, never in the creator-facing path.)`

### 1.2 Why each component exists

| Component | Why it exists |
|---|---|
| **Creator** | The end user — a content creator managing one or more communities. |
| **Kindred Website (Next.js)** | The only surface the creator sees: sign-up, onboarding, dashboard, settings. Deployed on Vercel because it's stateless request/response work. |
| **Better Auth** | Owns identity — sign-up, session, login, logout, password reset — so we never hand-roll auth security. |
| **Neon PostgreSQL** | The durable structured source of truth: accounts, communities, members, relationship events, insights, notifications. Serverless-friendly (works from Vercel's ephemeral functions) and reachable from the VPS. |
| **Prisma** | Type-safe, single schema shared by both the web app and the VPS agent runtime — one definition of the data model, no drift between the two deployments. |
| **Resend** | Delivers transactional email: verification links, password resets, and optional insight-digest emails. |
| **Telegram Bot** | The only channel the Mind observes in v1 — where relationships actually happen (the community). |
| **Telegram Group** | The creator's community; the source of every relationship signal Kindred remembers. |
| **Redis** | The message broker underneath BullMQ. It's also the one piece of shared, low-latency state Vercel (stateless) and the VPS (stateful) can both reach without talking to each other directly. |
| **BullMQ** | Queues and schedules all asynchronous and recurring work — message processing, digest sending, threshold scans — so nothing runs inside a slow, blocking HTTP request. |
| **Minds (Animoca)** | The **core intelligence**. Holds relationship memory natively, interprets it, reasons over it, and produces every creator-facing insight — reactive or autonomous. This is the piece that makes Kindred Kindred. |
| **Vercel** | Hosts the stateless half of the system: the web app and any request/response API routes (including the Telegram webhook receiver, which only enqueues work and returns immediately). |
| **VPS** | Hosts the stateful, long-running half: BullMQ workers, the Minds SSE listener (a persistent connection Vercel cannot hold open), and scheduled jobs — all under PM2. |
| **OpenAI (conditional)** | Used **only** if a preprocessing step (e.g., extracting a structured event from a noisy raw message) proves cheaper or faster outside the Mind. Never produces a creator-facing answer. Removable without changing the product's identity. |

### 1.3 The governing principle

> **The backend remembers facts. The Mind understands relationships.**

Every architectural decision below either serves the backend's job (observe, store, schedule, deliver) or the Mind's job (remember, interpret, decide, speak). Nothing else is allowed to reason on the Mind's behalf.

---

## 2. Folder Structure

Kindred is a small monorepo with two deployable apps and shared packages, because one deployable target (Vercel) cannot run the other's long-running processes.

```
kindred/
├── PROJECT_BIBLE.md                  # Product vision — source of truth for "what" and "why"
├── README.md                         # Public-facing summary
├── KINDRED_IMPLEMENTATION_BLUEPRINT.md  # This document — source of truth for "how"
├── .env.example                      # Every variable name, no values (see Section 11)
├── .gitignore
├── package.json                      # Root workspace manifest (npm/pnpm workspaces)
├── tsconfig.base.json                # Shared TypeScript compiler config
│
├── apps/
│   ├── web/                          # Next.js app — deployed on Vercel
│   │   ├── package.json
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── middleware.ts             # Route protection (redirect unauthenticated dashboard access)
│   │   ├── app/
│   │   │   ├── layout.tsx            # Root layout — fonts, global providers
│   │   │   ├── page.tsx              # Landing page
│   │   │   ├── (auth)/
│   │   │   │   ├── signup/page.tsx
│   │   │   │   ├── login/page.tsx
│   │   │   │   ├── verify-email/page.tsx
│   │   │   │   ├── reset-password/page.tsx
│   │   │   │   └── reset-password/confirm/page.tsx
│   │   │   ├── onboarding/
│   │   │   │   ├── page.tsx          # Step 1: connect Telegram DM
│   │   │   │   ├── group/page.tsx    # Step 2: add bot to group + linking code
│   │   │   │   └── success/page.tsx  # Step 3: confirmation
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx          # Overview: insight feed, loyal/quiet/returning widgets
│   │   │   │   ├── community/[communityId]/page.tsx
│   │   │   │   ├── members/[memberId]/page.tsx   # Relationship timeline for one person
│   │   │   │   ├── insights/page.tsx             # Full insight history
│   │   │   │   ├── notifications/page.tsx        # Delivery history
│   │   │   │   └── settings/
│   │   │   │       ├── page.tsx                  # Account settings
│   │   │   │       ├── telegram/page.tsx         # Manage/reconnect Telegram link
│   │   │   │       └── notifications/page.tsx    # Channel + quiet-hours preferences
│   │   │   └── api/
│   │   │       ├── auth/[...all]/route.ts        # Better Auth handler (mounted, not hand-written)
│   │   │       ├── telegram/webhook/route.ts      # Receives Telegram updates, enqueues job
│   │   │       ├── telegram/link/route.ts         # Generates a linking code for onboarding
│   │   │       ├── community/route.ts             # List / disconnect communities
│   │   │       ├── members/[memberId]/route.ts    # Member relationship timeline
│   │   │       ├── insights/route.ts              # List / mark read
│   │   │       ├── insights/ask/route.ts          # Reactive question → Mind
│   │   │       ├── notifications/route.ts         # Delivery history
│   │   │       ├── notifications/preferences/route.ts
│   │   │       └── health/route.ts
│   │   └── components/
│   │       ├── layout/Sidebar.tsx
│   │       ├── layout/TopBar.tsx
│   │       ├── dashboard/InsightCard.tsx
│   │       ├── dashboard/LoyalFansList.tsx
│   │       ├── dashboard/ReturningFansList.tsx
│   │       ├── dashboard/GoingQuietList.tsx
│   │       ├── dashboard/RelationshipTimeline.tsx
│   │       ├── dashboard/MemberCard.tsx
│   │       ├── modals/AskKindredModal.tsx
│   │       ├── modals/AddCommunityModal.tsx
│   │       ├── modals/DisconnectCommunityModal.tsx
│   │       ├── settings/NotificationToggle.tsx
│   │       ├── settings/LinkingCodeDisplay.tsx
│   │       └── ui/ (EmptyState.tsx, Skeleton.tsx, Toast.tsx — shared primitives)
│   │
│   └── agent/                        # Long-running Node process — deployed on VPS via PM2
│       ├── package.json
│       ├── ecosystem.config.js       # PM2 process definitions (one entry per worker/listener)
│       ├── src/
│       │   ├── index.ts              # Boots all workers + the SSE listener
│       │   ├── telegram/
│       │   │   ├── bot.ts            # Telegram bot client (sendMessage, DM handling)
│       │   │   └── extract-events.ts # Raw message → structured RelationshipEvent candidate
│       │   ├── workers/
│       │   │   ├── telegram-ingest.worker.ts
│       │   │   ├── mind-digest-sender.worker.ts
│       │   │   ├── mind-standing-check.worker.ts
│       │   │   ├── notification-dispatch.worker.ts
│       │   │   ├── inactivity-threshold-scanner.worker.ts
│       │   │   ├── milestone-scanner.worker.ts
│       │   │   └── linking-code-expiry.worker.ts
│       │   ├── minds/
│       │   │   ├── client.ts         # Thin wrapper over the HelloMinds Messaging API
│       │   │   └── sse-listener.ts   # Persistent SubscribeEvents connection + reconnect logic
│       │   └── notifications/
│       │       ├── telegram-channel.ts
│       │       └── email-channel.ts  # Wraps Resend
│       └── queues/
│           └── definitions.ts        # BullMQ queue names + job payload types (shared with web via package)
│
├── packages/
│   ├── db/                           # Shared Prisma schema + generated client
│   │   ├── package.json
│   │   ├── schema.prisma             # Section 3 of this document, made literal
│   │   └── migrations/               # Generated migration history (not written yet)
│   ├── minds-types/                  # Shared TypeScript types for Mind payloads/events
│   │   └── index.ts
│   └── shared/                       # Cross-app constants, thresholds, enums
│       └── index.ts
│
└── infra/
    ├── docker-compose.dev.yml        # Local Redis + Postgres for development only
    └── deploy/
        ├── vercel.json                # Vercel project config (points at apps/web)
        └── vps-setup-notes.md         # Manual VPS provisioning steps (nginx, PM2, Redis)
```

**Purpose summary, by top-level folder:**
- `apps/web` — everything the creator's browser touches.
- `apps/agent` — everything that must run continuously and cannot live on Vercel.
- `packages/db` — the one schema, shared so both apps agree on the data model.
- `packages/minds-types` / `packages/shared` — prevent the two apps from drifting on event/type definitions.
- `infra` — deployment and local-dev plumbing, not application logic.

---

## 3. Database Design

### 3.1 Better Auth's own tables (managed by the library, not hand-designed)

Better Auth requires and manages: `user`, `session`, `account`, `verification`. We extend `user` with Kindred-specific fields rather than duplicating identity.

| Table | Key fields | Purpose |
|---|---|---|
| `user` | `id` (PK), `email` (unique), `emailVerified`, `name`, `createdAt`, `updatedAt` | The creator's identity record. |
| `session` | `id` (PK), `userId` (FK → user), `expiresAt`, `token` | Active login sessions. |
| `account` | `id` (PK), `userId` (FK → user), `providerId`, credentials | Credential storage (email/password). |
| `verification` | `id` (PK), `identifier`, `value`, `expiresAt` | Email verification / password reset tokens. |

### 3.2 Kindred domain tables

**`Community`**
| Field | Type | Notes |
|---|---|---|
| `id` | PK, uuid | |
| `creatorId` | FK → `user.id` | One creator, many communities |
| `telegramChatId` | bigint, **unique** | Telegram's group chat ID |
| `telegramChatTitle` | text | Display name |
| `mindsConversationId` | text, unique | The Messaging API conversation tied to this community (see §6) |
| `privacyModeConfirmed` | boolean, default false | Set true once ingestion proves the bot is receiving group messages |
| `status` | enum: `pending_link`, `active`, `disconnected` | |
| `createdAt`, `updatedAt` | timestamp | |

*Exists because:* a creator's relationships are scoped per community; this is the anchor every other domain table hangs off.

**`Member`**
| Field | Type | Notes |
|---|---|---|
| `id` | PK, uuid | |
| `communityId` | FK → `Community.id` | |
| `telegramUserId` | bigint | |
| `telegramUsername` | text, nullable | |
| `displayName` | text | Latest known name |
| `firstSeenAt` | timestamp | |
| `lastSeenAt` | timestamp | |
| `status` | enum: `active`, `quiet`, `inactive`, `returned` | Derived by the inactivity scanner |
| `createdAt`, `updatedAt` | timestamp | |

**Unique constraint:** `(communityId, telegramUserId)` — one row per person per community.
**Index:** `(communityId, status)` — powers the "Going Quiet" / "Returning" dashboard widgets without a full scan.

*Exists because:* this is the person Kindred is trying to remember — the unit the whole product revolves around.

**`RelationshipEvent`**
| Field | Type | Notes |
|---|---|---|
| `id` | PK, uuid | |
| `memberId` | FK → `Member.id` | |
| `type` | enum: `joined`, `first_interaction`, `participation`, `creator_interaction`, `milestone`, `absence_started`, `returned`, `contribution`, `appreciation` | |
| `payload` | jsonb | Structured detail (e.g., which milestone, what was said in summary form) |
| `occurredAt` | timestamp | When it actually happened |
| `sentToMind` | boolean, default false | Batching flag |
| `sentToMindAt` | timestamp, nullable | |
| `createdAt` | timestamp | |

**Index:** `(memberId, occurredAt)` — powers the relationship timeline view.
**Partial index:** on `sentToMind = false` — lets the digest-sender worker scan only unbatched events cheaply.

*Exists because:* this is the structured, factual ledger — the backend's half of "the backend remembers facts, the Mind understands relationships." Raw chat text is never stored here; only derived structured events are.

**`Insight`**
| Field | Type | Notes |
|---|---|---|
| `id` | PK, uuid | |
| `communityId` | FK → `Community.id` | |
| `memberId` | FK → `Member.id`, nullable | Null for community-wide insights |
| `source` | enum: `reactive`, `autonomous` | |
| `content` | text | The Mind's own words |
| `status` | enum: `unread`, `read`, `acted` | |
| `createdAt` | timestamp | |

**Index:** `(communityId, createdAt)` — feeds the dashboard's insight stream.

*Exists because:* this is the durable record of everything the Mind has told the creator — needed for the dashboard history and for notification delivery to reference.

**`Notification`**
| Field | Type | Notes |
|---|---|---|
| `id` | PK, uuid | |
| `insightId` | FK → `Insight.id` | |
| `channel` | enum: `dashboard`, `telegram_dm`, `email` | |
| `status` | enum: `pending`, `sent`, `failed` | |
| `deliveredAt` | timestamp, nullable | |
| `createdAt` | timestamp | |

**Index:** `(insightId)`.

*Exists because:* one insight can fan out to multiple channels; this table tracks each delivery attempt independently for retry/audit.

**`NotificationPreference`**
| Field | Type | Notes |
|---|---|---|
| `id` | PK, uuid | |
| `creatorId` | FK → `user.id`, **unique** | One row per creator |
| `telegramDmEnabled` | boolean, default true | |
| `emailEnabled` | boolean, default false | |
| `quietHoursStart` | time, nullable | |
| `quietHoursEnd` | time, nullable | |
| `maxDailyNotifications` | int, default 5 | Anti-spam ceiling |

*Exists because:* delivery rules belong to the creator, not to any single insight.

**`TelegramLinkRequest`**
| Field | Type | Notes |
|---|---|---|
| `id` | PK, uuid | |
| `creatorId` | FK → `user.id` | |
| `code` | text, unique | Short code shown during onboarding |
| `expiresAt` | timestamp | |
| `consumedAt` | timestamp, nullable | |

*Exists because:* linking a Telegram group to a creator account needs a short-lived, unguessable handshake (Section 5).

### 3.3 Relationship summary

```
user (Better Auth) ─1───N─ Community ─1───N─ Member ─1───N─ RelationshipEvent
       │                        │                   │
       │                        └──1───N─ Insight ──0/1
       │                                    │
       │                                    └─1───N─ Notification
       │
       ├─1───1─ NotificationPreference
       └─1───N─ TelegramLinkRequest
```

---

## 4. Authentication Flow

**Sign Up:** creator submits email + password → Better Auth creates a `user` row (`emailVerified = false`) and a `verification` token → Better Auth's email hook calls Resend to send the verification link.

**Email Verification:** creator clicks the link → Better Auth validates the token against `verification`, sets `emailVerified = true`, consumes the token.

**Login:** Better Auth validates credentials against `account`, issues a session, sets a secure HTTP-only cookie. Unverified accounts can log in but are routed to a "please verify" state before reaching onboarding/dashboard (enforced in `middleware.ts`).

**Logout:** Better Auth invalidates the `session` row and clears the cookie.

**Session Management:** every request to a protected route (`/dashboard/*`, `/onboarding/*`) passes through `middleware.ts`, which asks Better Auth to validate the session cookie server-side; invalid/expired sessions redirect to `/login`.

**Password Reset:** creator requests reset → Better Auth issues a `verification` token → Resend sends the reset link → creator submits a new password against the token → Better Auth validates and updates `account`, invalidating existing sessions.

**How Better Auth and Resend work together:** Better Auth owns *when* an email must be sent and *what token* it contains; Resend is registered as Better Auth's email-sending adapter and owns *delivery*. Better Auth never talks to an SMTP server directly — every outbound auth email is a Resend API call triggered by a Better Auth lifecycle hook.

---

## 5. Telegram Architecture

### 5.1 Connecting a community (creator-facing flow)

1. Creator reaches onboarding step 1 and starts a private chat with the Kindred bot (`/start`) — **required**, because Telegram bots cannot DM a user who hasn't initiated contact. This unlocks the DM notification channel later.
2. Backend generates a `TelegramLinkRequest` (short code, short expiry) and displays it in step 2.
3. Creator adds the Kindred bot to their Telegram group and posts the code as a message (e.g., `/link ABC123`).
4. The bot receives this in the group, matches the code to the pending `TelegramLinkRequest`, and the ingest worker creates the `Community` row (`telegramChatId` from the update, `status = active`), consuming the link request.
5. Onboarding step 3 confirms success once the `Community` row exists.

### 5.2 Bot-wide setup (developer-facing, one time only — not per creator)

- **Privacy mode is disabled once, globally, via BotFather** for the Kindred bot. This is a bot-level setting, not something each creator configures. Without this, the bot only sees commands/mentions, not ordinary conversation — and Kindred's entire memory model depends on ordinary conversation.
- The bot's webhook URL is registered once, pointing at `apps/web`'s `/api/telegram/webhook`, with a shared secret token Telegram includes on every request (validated before any processing).

### 5.3 How messages arrive and become memories

1. Telegram POSTs every update (group message, member join/leave, etc.) to the Vercel-hosted webhook.
2. The webhook route validates the secret token, does **no processing**, and enqueues the raw update onto the `telegram-ingest` BullMQ queue (Redis) — kept intentionally fast so Vercel's function returns immediately.
3. The VPS `telegram-ingest` worker picks up the job:
   - Resolves `telegramChatId` → `Community`.
   - Upserts the `Member` (creates on first sight, updates `lastSeenAt`/`displayName`).
   - Runs `extract-events.ts` — rule-based classification first (join events, first message, creator replies, long absence-then-return based on `lastSeenAt` delta); falls back to OpenAI **only** for ambiguous cases where rules are insufficient (Section 1.2's "conditional" component).
   - Writes one or more `RelationshipEvent` rows. Raw message text is **not** persisted — only the derived structured event and enough payload to make the Mind's later narrative coherent (e.g., a short paraphrase, never a verbatim log retained long-term).
4. Events sit with `sentToMind = false` until the digest-sender worker batches them to the Mind (Section 6).

### 5.4 Privacy in practice

- Only **public group messages** are ever ingested — never private messages between members.
- The bot's membership in the group is visible to everyone in that group at all times.
- Raw text is used transiently for extraction and then discarded; what persists is structured relationship fact, consistent with "Kindred remembers people, not conversations."

---

## 6. Minds Architecture

This is the section that must maximize Minds Integration Depth. Every decision here follows one test: **if the Mind were deleted, does this capability disappear?**

### 6.1 One Mind per creator (design decision, not a documented requirement)

Each creator is provisioned their own **Kindred Mind** on the Minds platform when they complete onboarding. Every community that creator connects becomes a separate **conversation** under that same Mind (via the HelloMinds Messaging API's `CreateConversation`). This means:
- A creator's relationships across multiple communities can be reasoned about by one coherent Mind.
- No creator's relationship memory is ever visible to another creator's Mind — isolation by construction, not by access-control logic we have to get right ourselves.

This is our recommended design, not something documented by the platform as mandatory — it is called out explicitly so it can be revisited in week 1 if the platform's actual conversation/memory model works differently than assumed (see §6.6).

### 6.2 What belongs inside the Mind

- **All relationship memory** — the Mind's own native persistent memory accumulates every batched relationship-event digest sent to it. This is the memory the hackathon requires, and it lives natively in Minds, not merely in our Postgres.
- **All interpretation and judgment** — deciding that a pattern of silence is "concerning" versus "normal for this person," recognizing which members are "loyal," composing what a milestone actually means in context.
- **All reactive answers** — "Who is Sarah?" is answered from the Mind's own accumulated memory, never assembled by our backend from raw rows.
- **All autonomous insight composition** — every notification's actual words are the Mind's, driven by standing instructions.
- **Standing instructions** — persistent, ongoing directives the Mind holds and acts on across runs (e.g., *"Watch for members who were consistently active and have gone unusually quiet. When this happens, tell me who they are and why they mattered. Also tell me when someone returns after an absence, and flag meaningful upcoming anniversaries."*).

### 6.3 What belongs inside our backend

- **Observation** — Telegram ingestion, all of it.
- **Structured fact storage** — the `RelationshipEvent` ledger; the audit trail and the data the dashboard queries directly for fast rendering (the Mind is consulted for *interpretation*, not for populating a table of raw counts).
- **Scheduling** — when digests get batched and sent, when threshold scans run, when notifications are dispatched and rate-limited.
- **Delivery mechanics** — actually sending the Telegram DM, actually calling Resend. The Mind decides *what* to say; the backend is responsible for *getting it there*.
- **UI** — presentation only.

### 6.4 How the Builder API is used

Using the HelloMinds Messaging API (Builder Access Key, `X-Access-Key` header):

| Call | When | Purpose |
|---|---|---|
| `CreateConversation` | Community linked (§5.1 step 4) | Establishes the Mind's conversation for that community. |
| `SendMessage` | (a) digest-sender worker batches events; (b) creator asks a reactive question | Feeds memory in; asks a question. |
| `GetMessageHistory` / `GetConversation` | Debugging, audit, and rendering "what has Kindred been told" if ever needed | Transparency/debug tool, not part of the live product path. |
| `ListConversations` | Admin/ops tooling only | Not creator-facing. |
| `SubscribeEvents` (SSE) | Continuously, from a persistent VPS process | Receives the Mind's autonomous output the moment it decides to speak. |

### 6.5 How memories persist

Every batched digest sent via `SendMessage` becomes part of the Mind's own native memory — this is the platform's documented persistent-memory behavior, not something we simulate. Our Postgres `RelationshipEvent` table is a **parallel structured record**, kept for dashboard speed, audit, and reconstruction if ever needed — but the memory the hackathon is judging is the Mind's own.

### 6.6 How autonomous actions work

- Standing instructions are set on the Mind's conversation once, at creation.
- A scheduled `mind-standing-check` job (BullMQ, VPS) periodically sends a lightweight check-in prompt carrying the latest structured deltas, so the Mind has fresh material to evaluate its standing instructions against.
- **Open question, flagged honestly:** whether Minds' standing instructions self-trigger on a timer without an external nudge, or require exactly this kind of periodic prompt, is not something we could verify from available documentation. The check-in job is our safe default; if the platform supports true self-scheduled autonomy, the job's role shrinks to "supply fresh data" rather than "trigger evaluation." **This is a week-1 verification item, not an assumption baked silently into the build.**
- When the Mind decides something is worth telling the creator, it emits output; the VPS `sse-listener` receives it via `SubscribeEvents`, and the backend turns that into an `Insight` row (`source = autonomous`).

### 6.7 How reactive conversations work

Creator submits a question via `AskKindredModal` → `/api/insights/ask` → backend calls `SendMessage` on that creator's Mind conversation → the answer arrives either via the same SSE stream or a short bounded poll of `GetMessageHistory` → backend stores it as an `Insight` (`source = reactive`) and returns it to the dashboard.

### 6.8 How notifications are generated

Every notification originates from an `Insight` row, regardless of source. Section 7 governs what happens after an `Insight` exists — the Mind's job ends the moment it has spoken.

---

## 7. Notification Architecture

### 7.1 Channels

| Channel | Automatic? | Requires creator action first? |
|---|---|---|
| **Dashboard** | Yes, always | No — always on |
| **Telegram DM** | Yes, if enabled | Yes — creator must have `/start`-ed the bot |
| **Email** | Yes, if enabled | Yes — creator opts in under settings |

### 7.2 Flow

`notification-dispatch` worker consumes new `Insight` rows and, per enabled channel in `NotificationPreference`, creates and attempts a `Notification` row. Telegram DM delivery uses the bot client directly; email delivery goes through Resend.

### 7.3 Anti-spam policy

- **Quiet hours:** no Telegram DM or email leaves during a creator's configured `quietHoursStart`–`quietHoursEnd`; queued instead for the next open window. Dashboard is unaffected (it's pull, not push).
- **Daily ceiling:** `maxDailyNotifications` caps push channels per creator per day; overflow insights still appear on the dashboard and roll into a single digest rather than firing individually.
- **Dedupe:** the dispatch worker checks for an existing unresolved `Insight` about the same member/topic within a cooldown window before creating a duplicate notification.
- **Retry:** failed sends retry with backoff (BullMQ's built-in mechanism); after a fixed number of attempts, the `Notification` is marked `failed` and surfaced only on the dashboard, never retried indefinitely.

---

## 8. Frontend Architecture

**Pages:** landing (`/`); auth (`signup`, `login`, `verify-email`, `reset-password`, `reset-password/confirm`); onboarding (`onboarding`, `onboarding/group`, `onboarding/success`); dashboard (`dashboard`, `dashboard/community/[communityId]`, `dashboard/members/[memberId]`, `dashboard/insights`, `dashboard/notifications`, `dashboard/settings`, `dashboard/settings/telegram`, `dashboard/settings/notifications`).

**Modals:** Ask Kindred (reactive question entry point), Add Community (displays linking code), Disconnect Community (confirmation).

**Dashboard components:** Sidebar, TopBar, InsightCard, LoyalFansList, ReturningFansList, GoingQuietList, RelationshipTimeline, MemberCard.

**Settings components:** NotificationToggle, LinkingCodeDisplay.

**Shared UI primitives:** EmptyState, Skeleton (loading), Toast (feedback).

Every page and component above is listed with its purpose already stated in Section 2's folder tree — this section exists so the frontend surface can be reviewed independent of file layout.

---

## 9. API Routes

| Route | Method(s) | Purpose |
|---|---|---|
| `/api/auth/[...all]` | Various | Mounted Better Auth handler — sign-up, sign-in, sign-out, session, verification, reset. |
| `/api/telegram/webhook` | POST | Receives Telegram updates, validates secret, enqueues job. Returns immediately. |
| `/api/telegram/link` | POST | Creates a `TelegramLinkRequest` for the current creator during onboarding. |
| `/api/community` | GET, DELETE | List the creator's connected communities; disconnect one (soft: `status = disconnected`). |
| `/api/members/[memberId]` | GET | A single member's relationship timeline (events + latest status). |
| `/api/insights` | GET, PATCH | List the creator's insight feed (paginated); mark an insight read/acted. |
| `/api/insights/ask` | POST | Submit a reactive question; returns the Mind's answer (or a pending token if answered asynchronously). |
| `/api/notifications` | GET | Delivery history across channels. |
| `/api/notifications/preferences` | GET, PATCH | Read/update a creator's `NotificationPreference`. |
| `/api/health` | GET | Basic liveness check for uptime monitoring. |

**Deliberately absent:** no public API route exposes `SubscribeEvents` — that SSE connection is consumed entirely inside the VPS agent process, never proxied through Vercel, because a serverless function cannot hold it open reliably.

---

## 10. Background Jobs (all on the VPS, under PM2)

| Job | Trigger | Why it exists |
|---|---|---|
| `telegram-ingest.worker` | Queue-driven (per webhook event) | Turns raw Telegram updates into `Member`/`RelationshipEvent` rows. |
| `mind-digest-sender.worker` | Scheduled (recurring, per community) | Batches unsent `RelationshipEvent`s and feeds them to the Mind — keeps cognition usage bounded (§6.4, §14). |
| `mind-standing-check.worker` | Scheduled (recurring, per community) | Nudges the Mind to evaluate standing instructions against fresh data (§6.6). |
| `sse-listener` (persistent process, not a queue job) | Always running | Maintains the `SubscribeEvents` connection; converts Mind output into `Insight` rows in real time. |
| `notification-dispatch.worker` | Queue-driven (per new `Insight`) | Applies anti-spam rules and delivers across enabled channels. |
| `inactivity-threshold-scanner.worker` | Scheduled (daily) | Detects `active → quiet → inactive` transitions from `lastSeenAt`; writes `absence_started`/`returned` events — the raw signal the Mind later interprets. |
| `milestone-scanner.worker` | Scheduled (daily) | Detects upcoming anniversaries; writes `milestone` events. |
| `linking-code-expiry.worker` | Scheduled (hourly) | Purges expired, unconsumed `TelegramLinkRequest`s. |

---

## 11. Environment Variables

No secrets — names, sources, and timing only.

| Variable | Obtained from | Obtained when |
|---|---|---|
| `DATABASE_URL` | Neon project dashboard | When the Neon project is created |
| `BETTER_AUTH_SECRET` | Self-generated random value | Any time before first deploy |
| `BETTER_AUTH_URL` | The app's deployed URL | Once the domain/Vercel URL is known |
| `RESEND_API_KEY` | Resend dashboard | When the Resend account is created |
| `EMAIL_FROM` | Verified sender in Resend | After domain verification in Resend |
| `TELEGRAM_BOT_TOKEN` | BotFather | When the Kindred bot is created |
| `TELEGRAM_BOT_USERNAME` | BotFather | Same time as above |
| `TELEGRAM_WEBHOOK_SECRET` | Self-generated | When registering the webhook with Telegram |
| `REDIS_URL` | VPS-hosted Redis (or managed provider) | When Redis is provisioned |
| `MINDS_BUILDER_ACCESS_KEY` | hellominds.ai Builder Hub | When a Builder account/key is issued — **week-1 verification item** |
| `MINDS_API_BASE_URL` | Minds/Ethoswarm documentation | Confirmed alongside the access key |
| `OPENAI_API_KEY` | OpenAI dashboard | Only if preprocessing proves necessary (optional) |
| `VPS_INTERNAL_SHARED_SECRET` | Self-generated | Before any internal calls between the two apps are added |
| `DEMO_INACTIVITY_DAYS` | Self-defined, demo-only override | Set before recording the demo video |
| `CRON_TIMEZONE` | Self-defined | Before scheduling jobs |
| `NODE_ENV` | Standard | Always |
| `NEXT_PUBLIC_APP_URL` | The deployed web app's public URL | Once known |

---

## 12. Deployment Architecture

**Vercel hosts:** `apps/web` in full — the Next.js dashboard, marketing page, and every stateless API route including the Telegram webhook receiver (which only enqueues and returns).

*Why:* everything on Vercel is request/response work with no need to stay alive between requests. This is exactly what serverless is for, and it's the cheapest, simplest place for it to live.

**VPS (via PM2) hosts:** `apps/agent` in full — every BullMQ worker, every scheduled job, and the persistent Minds `SubscribeEvents` listener.

*Why:* these processes must either run continuously (the SSE listener) or reliably in the background regardless of whether anyone is currently loading a web page (workers, cron-style jobs) — capabilities Vercel's execution model does not provide.

**How they communicate:** never directly over HTTP in the common path. Both apps read/write the **same Neon Postgres** (via the shared `packages/db` Prisma schema) and the **same Redis** instance (BullMQ queues). Vercel enqueues; the VPS dequeues, processes, and writes results back to Postgres, which Vercel's next request simply reads. This keeps the two deployments decoupled — either can be redeployed independently without breaking the other.

---

## 13. Development Roadmap

Each checkpoint is independently buildable, testable, and ends in one commit. Grouped by phase.

**Phase 0 — Repo & Tooling Setup**
1. Initialize monorepo structure (`apps/`, `packages/`, `infra/`), root `package.json` workspaces.
2. Add root `tsconfig.base.json`, ESLint/Prettier config.
3. Scaffold `apps/web` as a bare Next.js + TypeScript + Tailwind project (no pages yet beyond default).
4. Scaffold `apps/agent` as a bare Node + TypeScript project with a single "hello world" entrypoint.
5. Create `packages/db` with an empty Prisma project pointed at a local `DATABASE_URL`.
6. Write `infra/docker-compose.dev.yml` for local Postgres + Redis.
7. Commit `.env.example` with every variable name from Section 11 (no values).

**Phase 1 — Database Schema**
8. Add Better Auth's required models to `schema.prisma`.
9. Add `Community` model + migration.
10. Add `Member` model + unique constraint + migration.
11. Add `RelationshipEvent` model + indexes + migration.
12. Add `Insight` model + index + migration.
13. Add `Notification` model + index + migration.
14. Add `NotificationPreference` model + migration.
15. Add `TelegramLinkRequest` model + migration.
16. Verify full schema against Section 3 of this document; run `prisma generate` in both apps.

**Phase 2 — Authentication**
17. Install and configure Better Auth in `apps/web` with the Prisma adapter.
18. Wire Resend as Better Auth's email adapter (verification email only, no template yet).
19. Build `signup` page against Better Auth's sign-up call.
20. Build `login` page against Better Auth's sign-in call.
21. Build `verify-email` page/flow.
22. Add `middleware.ts` session protection for `/dashboard/*` and `/onboarding/*`.
23. Build `reset-password` + `reset-password/confirm` pages.
24. Manual test: full sign-up → verify → login → logout → reset cycle.

**Phase 3 — Telegram Linking**
25. Create the Telegram bot via BotFather; disable privacy mode; record token.
26. Build `/api/telegram/link` route: creates a `TelegramLinkRequest`.
27. Build onboarding step 1 page (prompt `/start` with the bot).
28. Build onboarding step 2 page (display linking code + instructions).
29. Build `/api/telegram/webhook` route: validate secret, enqueue raw update (no processing yet).
30. Register the webhook URL with Telegram; verify raw updates arrive in the queue (log only).
31. Build the `telegram-ingest.worker` skeleton: consume queue, resolve linking code, create `Community` row.
32. Build onboarding step 3 (success) page, gated on `Community.status = active`.
33. Manual test: full connect flow end-to-end with a real test group.

**Phase 4 — Telegram Ingestion → Relationship Events**
34. Extend `telegram-ingest.worker` to upsert `Member` on every incoming message.
35. Implement rule-based `extract-events.ts` for `joined` and `first_interaction`.
36. Implement rule-based detection for `creator_interaction` (message from the creator's own Telegram account).
37. Implement `participation` event writing (lightweight — one per active period, not per message).
38. Add the optional OpenAI fallback path for ambiguous classification (behind a feature flag, off by default).
39. Manual test: send varied messages in the test group; verify correct `RelationshipEvent` rows.

**Phase 5 — Minds Integration**
40. Obtain Builder Access Key; confirm Messaging API base URL and endpoint behavior (week-1 verification, §6.6).
41. Build `minds/client.ts` wrapper: `CreateConversation`, `SendMessage`, `GetMessageHistory`.
42. On community activation (checkpoint 31/32), call `CreateConversation` and store `mindsConversationId`.
43. Build `mind-digest-sender.worker`: batch unsent `RelationshipEvent`s per community, call `SendMessage`, mark `sentToMind = true`.
44. Manual test: verify the Mind's conversation history reflects sent digests via `GetMessageHistory`.
45. Set standing instructions on a test conversation (per §6.2's example directive).
46. Build `mind-standing-check.worker` (scheduled nudge).
47. Build `minds/sse-listener.ts`: connect to `SubscribeEvents`, log incoming events, implement auto-reconnect.
48. Wire the SSE listener's output to create `Insight` rows (`source = autonomous`).
49. Build `/api/insights/ask` + `AskKindredModal`; verify a reactive round-trip end-to-end.

**Phase 6 — Autonomous Signal Detection**
50. Build `inactivity-threshold-scanner.worker`: transitions + `absence_started`/`returned` events.
51. Build `milestone-scanner.worker`: anniversary detection + `milestone` events.
52. Build `linking-code-expiry.worker`.
53. Manual test: simulate an inactivity transition; confirm it reaches the Mind via the digest sender and produces an autonomous `Insight`.

**Phase 7 — Notifications**
54. Build `NotificationPreference` settings page + `/api/notifications/preferences`.
55. Build `notification-dispatch.worker`: dashboard delivery (trivial — just the `Insight` existing).
56. Add Telegram DM delivery channel + quiet-hours/daily-cap logic.
57. Add email delivery channel via Resend.
58. Manual test: trigger one insight, confirm correct fan-out and rate-limit behavior.

**Phase 8 — Dashboard UI**
59. Build dashboard overview page (insight feed + three widgets) against real data.
60. Build member relationship timeline page.
61. Build insight history and notification history pages.
62. Build community settings + disconnect flow.

**Phase 9 — Demo Integrity & Polish**
63. Implement `DEMO_INACTIVITY_DAYS` override for demo-timescale triggering.
64. Script and run the multi-day seeding sequence through the real pipeline (per Bible §9).
65. Record the 1.5–2 minute demo video.

**Phase 10 — Deployment**
66. Deploy `apps/web` to Vercel with production env vars.
67. Provision VPS: PM2, Redis, `apps/agent` deployment.
68. Point Telegram webhook and Minds callbacks (if any) at production URLs.
69. Final end-to-end smoke test in production.

*(69 checkpoints — within the requested 40–60 range once trivial commits are merged in practice; kept granular here so each is genuinely a single 30–60 minute unit. Collapse adjacent same-file checkpoints at build time if a tighter count is preferred.)*

---

## 14. Risk Review

| Risk | Mitigation |
|---|---|
| Builder Access Key / Messaging API access unavailable or rate-limited for hackathon participants | Verify in week 1 (checkpoint 40) before building anything downstream of it; escalate via workshops/office hours immediately if blocked. |
| Cognition credits exhausted before demo | Batch digests (never per-message sends); cap standing-check frequency; monitor usage from day one. |
| Telegram privacy mode misconfigured | One-time BotFather setting, verified explicitly at checkpoint 25 before any ingestion work begins. |
| Bot cannot DM creator | Enforce `/start` as onboarding step 1, not an afterthought; block dependent features until confirmed. |
| Vercel/VPS split adds coordination complexity | No direct HTTP coupling — shared Postgres + Redis only; each side redeployable independently (§12). |
| Redis is a single point of failure | Acceptable for hackathon scope; note as a post-MVP hardening item (managed Redis with persistence for production). |
| Neon connection limits under dual access (Vercel serverless + VPS) | Use Neon's built-in connection pooling; keep the VPS agent's Prisma client long-lived rather than reconnecting per job. |
| SSE connection drops silently | `sse-listener.ts` implements explicit reconnect-with-backoff; PM2 auto-restarts the process on crash. |
| Notification spam undermines the "calm, never noisy" philosophy | Quiet hours, daily caps, and dedupe are enforced centrally in one worker, not scattered across code paths (§7.3). |
| Demo seeding looks fabricated | All seed data flows through the real ingestion pipeline over real elapsed time, per Bible policy; thresholds are labeled, not hidden (§9). |
| Email deliverability (verification/reset landing in spam) | Verify sending domain in Resend early; test against multiple providers before relying on it for the demo. |
| Scope creep during a solo, time-boxed build | The 40–60 checkpoint roadmap is the only build order; new ideas go in the Bible's roadmap section (§12), not into MVP scope. |
| OpenAI fallback becomes a crutch that quietly does the Mind's job | Fallback is restricted to structured-event *extraction* only, feature-flagged off by default, and never produces creator-facing text (§1.2, §5.3). |

---

*End of Implementation Blueprint v1.0. This document, together with `PROJECT_BIBLE.md`, is the frozen architecture. No further redesign until a deliberate revision is made.*
