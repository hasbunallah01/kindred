# Kindred — Project Bible

**Version 1.0 — Permanent Foundation Document**
**Hackathon:** Creative Minds Jam #1: Hong Kong (Track 1 — Audience Growth & Engagement)
**Submission deadline:** August 28, 2026, 23:59 HKT

This document is the single source of truth for Kindred. Every file, README, architecture decision, and line of code must be consistent with it. Changes to this document require deliberate revision, not drift.

---

## 1. Identity

**Name:** Kindred
**Meaning:** People connected through relationships, belonging, and shared bonds.
**Tagline:** *Never let a loyal fan become a forgotten fan.*

**Founding belief:**

> Creators don't lose followers first — they lose relationships first.

As creators grow, human memory reaches its limit. Long-time supporters become indistinguishable from new followers. Loyal fans slowly feel invisible, while creators genuinely want to remember them but simply can't.

Kindred does not help creators create more content. It helps creators keep the people they already have.

---

## 2. What Kindred Is — and Is Not

Kindred **is** a persistent relationship memory for creators, embodied in a Mind.

Kindred is **not**:
- an AI chatbot
- a CRM
- an analytics dashboard
- a moderation bot
- a content generator

**Memory is the product.** If the Mind were removed, Kindred would stop existing: no loyal-fan recognition, no relationship continuity, no proactive reminders, no understanding of history.

---

## 3. Hackathon Fit

The hackathon requires every submission to demonstrate, via a Mind that is "integral… not optional or peripheral":

| Requirement | Kindred's demonstration |
|---|---|
| **Memory** | The Mind accumulates relationship memory about community members across weeks and months — in its own native persistent memory, not merely in our database. |
| **Continuity** | Sessions never restart from zero. The creator returns days later and the Mind still knows every person and every history. |
| **Autonomous follow-up** | The Mind privately notifies the creator — unprompted — when a loyal fan goes quiet, a fan returns after absence, a milestone passes, or a supporter is being forgotten. |

The hackathon explicitly permits hybrid architectures: *"You do not need to utilise Minds agents for the entirety of your design and build… just that the Minds agent should be integral to the operation of your project."* Kindred's architecture (Section 6) is designed so that removing the Mind removes recall, interpretation, and autonomous notification — the product genuinely ceases to function.

**Track:** Track 1 — Audience Growth & Engagement. Kindred is a retention product: keeping relationships alive is the strongest form of engagement.

---

## 4. What Kindred Remembers

Kindred stores **structured relationship memory, not chat logs**. It remembers people, not conversations.

Memory dimensions per community member:
- when they joined
- first interaction
- participation history (frequency, consistency)
- milestones (anniversaries, notable moments)
- recurring support and appreciation moments
- direct interactions with the creator
- inactivity periods
- returns after absence
- community contribution

---

## 5. Product Behavior

### 5.1 Reactive mode
The creator asks: *"Who is Sarah?"*
Kindred answers from the Mind's memory:

> "Sarah joined 18 months ago, attended your livestream launch, has consistently participated every week, but has recently become inactive."

### 5.2 Autonomous mode
Without being asked, the Mind notices and privately reports:
- a loyal fan has disappeared
- a fan returned after months away
- an anniversary is approaching
- an important supporter is being forgotten
- a newcomer deserves a welcome

### 5.3 Communication policy
Kindred almost never speaks in public conversations. It communicates privately through:
1. the Kindred dashboard
2. Telegram DM with the creator
3. optional email notifications

The Mind observes quietly. It speaks only when asked, or when a relationship genuinely needs attention. Never noisy. Never spammy.

### 5.4 Privacy stance
- Kindred never spies. It observes only public conversations inside communities where it has been added.
- The bot is visible. Everyone knows it exists. Transparency builds trust.
- Structured relationship facts are stored; raw chat logs are not retained beyond processing.

---

## 6. Architecture (Final)

### 6.1 Division of responsibility

**Backend (infrastructure):**
- Authentication and creator accounts
- Telegram ingestion (bot)
- Database of structured relationship facts
- Dashboard (web app)
- Scheduling and threshold detection (BullMQ)

**The Kindred Mind (core intelligence):**
- Relationship memory (its native persistent memory accumulates every meaningful relationship event)
- Relationship reasoning and interpretation
- All creator-facing intelligence: reactive answers and autonomous insights
- Autonomous behavior via standing instructions

**Principle:** *The backend remembers facts. The Mind understands relationships.* Backend = senses. Mind = brain and voice.

**OpenAI policy:** OpenAI may be used only for subordinate preprocessing (e.g., extracting a structured event from a raw message) where necessary. It never produces creator-facing intelligence and never replaces the Mind. If the Mind can perform the preprocessing within cognition budget, OpenAI is removed entirely.

### 6.2 Data flow

```
Telegram group
     │  (bot observes public messages; privacy mode disabled)
     ▼
Ingestion service (VPS) ──► Event extraction ──► PostgreSQL (Neon)
     │                                               │
     │  meaningful relationship events               │  facts for dashboard
     ▼                                               ▼
Kindred Mind  ◄──────────────────────────────  Next.js dashboard (Vercel)
 (HelloMinds Messaging API:                          ▲
  SendMessage / GetMessageHistory /                  │
  SubscribeEvents)                                   │
     │                                               │
     │  reactive answers + autonomous insights ──────┘
     │
     └──► Private notifications: dashboard feed, Telegram DM to creator, optional email
              (BullMQ prompts threshold checks; the Mind judges and composes)
```

### 6.3 Mind integration
- A dedicated **Kindred Mind** is deployed on the Minds platform.
- The backend communicates with it via the **HelloMinds Messaging API** (Builder Access Key, `X-Access-Key` header): `CreateConversation`, `SendMessage`, `GetMessageHistory`, `SubscribeEvents` (SSE).
- **Ingestion:** each meaningful relationship event is streamed to the Mind (batched — see 6.6) so the Mind's own memory holds the relationship narratives.
- **Reactive:** creator questions route through the Messaging API; the Mind answers from its accumulated memory.
- **Autonomous:** the Mind carries standing instructions (e.g., *"Watch for loyal supporters going quiet. When one does, privately notify the creator with who they are and why they matter."*). BullMQ may detect threshold crossings and prompt the Mind, but the Mind judges significance and composes every notification.

### 6.4 Known platform constraints (accepted)
1. **Telegram privacy mode** must be disabled via BotFather (or the bot made admin) so the bot can observe regular group messages.
2. Bots receive **no message history** from before they joined. Cold start is real; demo seeding must occur with the bot present (Section 9).
3. The bot **cannot DM the creator** until the creator has /start-ed it. "Start a chat with the Kindred bot" is a mandatory onboarding step.
4. **Vercel cannot host long-running processes.** The Telegram ingestion service and BullMQ worker (plus Redis) run on a VPS under PM2. The Next.js app runs on Vercel.

### 6.5 Week-1 verification list
- Builder Access Key availability for hackathon participants; exact Messaging API access path.
- Whether the hackathon **cognition boost** covers projected usage.
- Full contents of hellominds.ai/docs (attend workshops/office hours if needed).
- Whether the Mind's own Telegram integration can observe groups (if so, evaluate; custom bot remains the default).

### 6.6 Cognition budget policy
Mind invocations cost cognition credits. Therefore:
- Relationship events are **batched** (e.g., per-member digests on an interval), not streamed message-by-message.
- Low-signal events (routine messages) update Postgres only; the Mind receives curated, meaningful events.
- Thresholds for what reaches the Mind are configurable.

---

## 7. Data Model (Core Entities)

- **Creator** — account, auth identity, connected communities, notification preferences.
- **Community** — a Telegram group linked to a creator.
- **Member** — a person in a community (keyed by Telegram user ID; display name history retained).
- **RelationshipEvent** — typed, structured event: `joined`, `first_interaction`, `participation`, `creator_interaction`, `milestone`, `absence_started`, `returned`, `contribution`, `appreciation`.
- **Insight** — a Mind-generated observation delivered to the creator (source: reactive | autonomous; status: unread/read/acted).
- **Notification** — delivery record (dashboard / Telegram DM / email).

Raw messages are processed into RelationshipEvents and not retained long-term.

---

## 8. User Experience

### 8.1 Onboarding flow
1. Creator signs up on the Kindred website.
2. Verifies email (Resend).
3. Signs in.
4. Starts a private chat with the Kindred bot (/start) — required for DM notifications.
5. Adds the Kindred bot to their Telegram community (privacy mode disabled).
6. Kindred quietly begins building relationship memory.

### 8.2 Dashboard
Not an analytics dashboard. Its purpose: help creators never lose meaningful people.

Sections:
- **Loyal Fans** — longest-standing, most consistent supporters
- **Returning Fans** — recently back after absence
- **Fans Going Quiet** — loyal members drifting away
- **Relationship Timeline** — per-member history
- **Community Activity** — light context, people-first
- **Recent Insights** — the Mind's observations
- **Notifications** — delivery history and preferences

### 8.3 Design language
Calm. Professional. Trustworthy. Warm. Minimal. Never noisy. The interface emphasizes people and relationships, not AI.

---

## 9. Demo Plan

**Video length:** 1.5–2 minutes.

**Sequence:**
1. Creator signs in and opens the dashboard.
2. The Telegram community already contains seeded conversations (see integrity policy below).
3. Creator asks Kindred about a fan → the Mind answers with her full relationship history. *(Memory)*
4. Creator leaves and returns in a later session → the Mind still remembers everything. *(Continuity)*
5. The Mind autonomously notifies the creator that a loyal fan has become inactive. *(Autonomous follow-up)*

**Seeding integrity policy:**
- Seed data is produced by the **real pipeline**: scripted messages sent into the live group while the bot observes, over multiple days. No direct database inserts masquerading as memory.
- Demo thresholds are configurable and **openly labeled** (e.g., `DEMO_INACTIVITY_DAYS=2`) in code and docs. Judges see honest engineering, not magic.

---

## 10. Technology Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js, Tailwind CSS, TypeScript |
| Auth | Better Auth + Resend (email verification) |
| Database | PostgreSQL (Neon) + Prisma ORM |
| Web deployment | Vercel |
| Agent runtime host | VPS (PM2): Telegram ingestion service, BullMQ worker, Redis |
| Bot | Telegram Bot API |
| Scheduling | BullMQ (+ Redis) |
| Core intelligence | **Kindred Mind** (Minds by Animoca Brands) via HelloMinds Messaging API |
| Optional preprocessing | OpenAI (subordinate only; removable) |

---

## 11. Judging Criteria Mapping

| Criterion | Kindred's answer |
|---|---|
| **Minds Integration Depth** | The Mind holds the relationship memory natively, performs all interpretation, and drives all autonomous behavior. Remove it and the product ceases to exist. |
| **Creator-Economy Problem Fit** | Retention through relationship memory — squarely inside Track 1's "find, grow, and retain your audience." |
| **Innovation & Creativity** | A relationship-memory category: no content tool, CRM, or analytics product remembers *people* for creators. |
| **Execution & Completeness** | Full working loop: onboarding → observation → memory → reactive recall → autonomous notification, with honest demo engineering. |
| **Viability & Scalability** | Platform-independent core (Telegram first; Discord/Slack/X later). Every growing creator hits the memory ceiling; Kindred scales as text + structured data. |

---

## 12. Roadmap Beyond MVP

- Additional platforms: Discord, Slack, X, WhatsApp.
- Multi-community identity: one person recognized across a creator's communities.
- Richer milestone detection and creator-defined "people I never want to lose" lists.
- Fan-visible value experiments (always transparent, never surveillant).

The MVP does one thing exceptionally well: **helping creators remember the people who matter.**

---

## 13. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Messaging API access or cognition budget insufficient | Week-1 verification (6.5); batching policy (6.6); hackathon cognition boost; office hours escalation. |
| "Surveillance" optics | Visible bot, public-conversations-only, structured facts not chat logs, people-first framing (Section 5.4). |
| Cold start weakens demo | Multi-day scripted seeding through the real pipeline (Section 9). |
| Autonomy feels scripted to judges | Standing instructions live in the Mind; BullMQ only prompts checks; the Mind composes every insight; thresholds labeled honestly. |
| Vercel/worker mismatch | Split deployment: web on Vercel, agent runtime on VPS (6.4). |

---

*End of Project Bible v1.0. All subsequent artifacts — README, architecture docs, code — derive from this document.*
