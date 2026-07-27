# Kindred

**Never let a loyal fan become a forgotten fan.**

Kindred is a persistent AI relationship memory for creators, built on **Minds by Animoca Brands** for **Creative Minds Jam #1: Hong Kong** (Track 1 — Audience Growth & Engagement).

---

## The Problem

Creators don't lose followers first — **they lose relationships first.**

As creators grow, human memory reaches its limit. Long-time supporters become indistinguishable from new followers. Loyal fans slowly feel invisible, while creators genuinely want to remember them but simply can't. Every interaction restarts from zero. The fan feels forgotten. The creator feels guilty. Relationships quietly disappear.

Today's creator tools help make, edit, schedule, and analyze **content**. Almost no tool helps creators remember **people**.

## The Solution

Kindred quietly observes a creator's community and builds **structured relationship memory that never disappears** — when someone joined, how they've participated, milestones, absences, returns, and moments of support.

It remembers **people, not conversations.**

Kindred is **not** a chatbot, a CRM, an analytics dashboard, a moderation bot, or a content generator.

**The Mind is the product.** Without the Mind, Kindred does not exist.

## What Kindred Does

**Reactive** — the creator asks *"Who is Sarah?"* and Kindred answers from memory:

> "Sarah joined 18 months ago, attended your livestream launch, has consistently participated every week, but has recently become inactive."

**Autonomous** — without being asked, Kindred privately notifies the creator when:

- a loyal fan has gone quiet
- a fan returns after months away
- a milestone or anniversary arrives
- an important supporter is being forgotten
- a newcomer deserves a welcome

Notifications arrive privately — via the Kindred dashboard, Telegram DM, or optional email. Kindred almost never interrupts public conversations.

## How It Demonstrates the Hackathon Requirements

| Requirement | Kindred |
|---|---|
| **Memory** | The Kindred Mind accumulates relationship memory about community members across weeks and months — in its own persistent memory. |
| **Continuity** | Sessions never restart from zero; the creator returns days later and the Mind still knows every person and every history. |
| **Autonomous follow-up** | The Mind, guided by standing instructions, notices relationship moments and privately notifies the creator unprompted. |

## Architecture

- **Backend (infrastructure):** authentication, Telegram ingestion, PostgreSQL database of structured relationship facts, web dashboard, scheduling.
- **Kindred Mind (core intelligence):** relationship memory, reasoning, and all creator-facing insight — reactive answers and autonomous notifications — integrated via the HelloMinds Messaging API and standing instructions.

> **The backend remembers facts. The Mind understands relationships.**
> Backend = senses. Mind = brain and voice.

OpenAI is used only for subordinate preprocessing where necessary and never replaces the Mind as the primary intelligence.

**Stack:** Next.js · Tailwind CSS · TypeScript · Better Auth · Resend · PostgreSQL (Neon) · Prisma · Vercel (web) · VPS/PM2 (agent runtime: Telegram bot, BullMQ, Redis) · Telegram Bot API · **Minds by Animoca Brands**

## Privacy

- Kindred never spies. It observes only **public conversations** in communities where it has been added.
- The bot is **visible** — everyone knows it exists. Transparency builds trust.
- Structured relationship facts are stored; raw chat logs are not retained.

## Project Documentation

The complete product vision, architecture, data model, demo plan, and roadmap live in the **[Project Bible](./PROJECT_BIBLE.md)** — the single source of truth for this project.

## Status

🚧 Pre-development. Vision and architecture finalized; build begins per the Project Bible.

---

*Built for Creative Minds Jam #1 by [@hasbunallah01](https://github.com/hasbunallah01).*
