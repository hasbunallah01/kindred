import type { Metadata } from 'next';
import {
  ArrowUpRight,
  Bell,
  Brain,
  Check,
  ChevronDown,
  Heart,
  MessageSquare,
  Send,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';

// Per-route metadata — overrides the root layout metadata for this page only.
export const metadata: Metadata = {
  title: 'Kindred Mind — relationship memory for Telegram communities',
  description:
    'Kindred Mind quietly observes your Telegram community, remembers relationships, and helps creators build stronger connections — without becoming another chatbot.',
};

// =====================================================================
// Kindred Mind — landing page
// =====================================================================
// Built per the Kindred Mind Design Foundation
// (docs/DESIGN_FOUNDATION.md) and the Landing Page Content Blueprint
// (Section 19 of the same document). One file, no nested components,
// no client-side JS, easy to edit top-to-bottom.
//
// Section order is the persuasion arc and is fixed. To reorder, also
// reorder the visual flow at the bottom of the file.
// =====================================================================

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it Works' },
  { href: '#faq', label: 'FAQ' },
];

const TRUSTED_BY = [
  { name: 'Telegram' },
  { name: 'Minds by Animoca Brands' },
  { name: 'Animoca Brands' },
  { name: 'Built with AI' },
];

const PROBLEMS = [
  {
    icon: Users,
    title: 'Loyal members go unnoticed',
    description: 'Someone who used to talk every day quietly disappears.',
  },
  {
    icon: Heart,
    title: 'Supporters become invisible',
    description: 'Your most loyal supporters get lost as your community grows.',
  },
  {
    icon: MessageSquare,
    title: 'Context is lost',
    description: 'You remember conversations. You forget people.',
  },
];

const STEPS = [
  {
    n: '01',
    icon: Send,
    title: 'Connect Telegram',
    body: 'Connect your Telegram group in less than one minute. Kindred Mind quietly begins observing relationship events.',
  },
  {
    n: '02',
    icon: Brain,
    title: 'Kindred Mind learns',
    body: 'Messages become structured relationship memories. No spam. No chatbot. Just understanding.',
  },
  {
    n: '03',
    icon: Bell,
    title: 'Receive insights',
    body: 'Get notified when something important happens. Then explore the full insight inside your dashboard.',
  },
];

const DASHBOARD_CALLOUTS = [
  'Recent Insights',
  'Community Overview',
  'Member Timeline',
  'Ask Kindred',
  'Notifications',
  'Relationship Events',
];

const FEATURES = [
  {
    icon: Brain,
    title: 'Relationship Memory',
    body: 'Kindred Mind remembers people — not messages.',
  },
  {
    icon: Sparkles,
    title: 'Autonomous Insights',
    body: 'Important moments appear automatically.',
  },
  {
    icon: MessageSquare,
    title: 'Ask Kindred',
    body: 'Ask anything about your community.',
  },
  {
    icon: Bell,
    title: 'Telegram Notifications',
    body: 'Short notifications. Full details stay on your dashboard.',
  },
  {
    icon: TrendingUp,
    title: 'Community Timeline',
    body: 'See relationships evolve over time.',
  },
  {
    icon: Sparkles,
    title: 'Built with Minds',
    body: 'Powered by persistent AI memory.',
  },
];

const ASK_EXAMPLES = [
  'Who quietly returned this month?',
  'Who has been consistently supporting us?',
  'Who have I not spoken with recently?',
  'Show members becoming inactive.',
];

const BUILT_FOR = [
  {
    title: 'Never lose track of loyal members',
    body: 'AI that remembers relationships, not just messages.',
  },
  {
    title: 'Understand people, not just posts',
    body: 'Autonomous community insights powered by Kindred Mind.',
  },
  {
    title: 'A calmer way to stay close to your community',
    body: 'Private notifications, never public noise.',
  },
];

const FAQS = [
  {
    q: 'Does Kindred Mind read every message?',
    a: 'Kindred Mind observes public conversations in communities where the bot has been added. It extracts structured relationship facts, not raw chat logs. The bot is visible — everyone knows it is there.',
  },
  {
    q: 'Is it a chatbot?',
    a: 'No. Kindred Mind is not a chatbot. It speaks only when asked, or when a relationship genuinely needs attention. It never chats in your group.',
  },
  {
    q: 'Does it post in my group?',
    a: 'Never. The bot is a silent observer. It only communicates with the creator — through the dashboard, a private Telegram DM, or optional email.',
  },
  {
    q: 'Can I use channels?',
    a: 'No. Kindred Mind is built for Telegram Groups only — the surface where community conversations actually happen.',
  },
  {
    q: 'How does the AI work?',
    a: 'Kindred Mind is powered by Minds by Animoca Brands, a persistent AI agent with native memory. The backend stores facts; the Mind understands relationships.',
  },
  {
    q: 'Can I disable notifications?',
    a: 'Yes. Every channel — dashboard, Telegram DM, email — can be toggled independently, with per-channel quiet hours.',
  },
];

const FOOTER_COLUMNS = [
  {
    title: 'Product',
    links: [
      { href: '#features', label: 'Features' },
      { href: '#how-it-works', label: 'How it Works' },
      { href: '#faq', label: 'FAQ' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { href: '#', label: 'Documentation' },
      { href: 'https://github.com/hasbunallah01/kindred', label: 'GitHub' },
      { href: '#', label: 'Roadmap' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '#', label: 'About' },
      { href: '#', label: 'Contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '#', label: 'Privacy Policy' },
      { href: '#', label: 'Terms of Service' },
    ],
  },
];

// =====================================================================
// Subcomponents
// =====================================================================
// Each section is a small inline component. Sections are intentionally
// defined here, not in separate files, so the entire landing page can
// be read top-to-bottom in one place.
// =====================================================================

function Nav() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-marketing items-center justify-between px-6 sm:px-8">
        <a href="#top" className="flex items-center gap-2.5">
          <img
            src="/brand/kindred-logo.png"
            alt="Kindred Mind"
            className="h-7 w-auto"
          />
        </a>

        <ul className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-sm font-medium text-text-primary transition-colors hover:text-brand-primary"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          <a
            href="/login"
            className="hidden text-sm font-semibold text-text-primary transition-colors hover:text-brand-primary sm:inline"
          >
            Log in
          </a>
          <a
            href="/signup"
            className="inline-flex items-center gap-1.5 rounded-input bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-hover"
          >
            Get Started
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section
      id="top"
      className="mx-auto w-full max-w-marketing px-6 pb-24 pt-16 sm:px-8 sm:pt-20 lg:pb-32 lg:pt-24"
    >
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text-secondary">
            <Sparkles className="h-3.5 w-3.5 text-coral" />
            AI relationship memory for Telegram communities
          </span>

          <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight text-text-primary sm:text-5xl lg:text-[3.4rem]">
            Never let your most loyal community members become{' '}
            <span className="text-coral">forgotten</span>.
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-text-secondary sm:text-lg">
            Kindred Mind quietly observes your Telegram community, remembers
            relationships, discovers important moments, and helps you build
            stronger connections — without becoming another chatbot.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="/signup"
              className="inline-flex items-center gap-2 rounded-input bg-brand-primary px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-primary-hover"
            >
              Get Started
              <ArrowUpRight className="h-4 w-4" />
            </a>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-input border border-brand-primary bg-white px-6 py-3 text-sm font-semibold text-brand-primary transition-colors hover:bg-surface"
            >
              See How it Works
            </a>
          </div>

          <ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-text-secondary">
            <li className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-success" />
              No chatbot
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-success" />
              Telegram Groups
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-success" />
              AI-powered by Minds
            </li>
          </ul>
        </div>

        <div className="lg:pl-4">
          <DashboardMockup />
        </div>
      </div>
    </section>
  );
}

function DashboardMockup() {
  return (
    <div className="overflow-hidden rounded-container border border-border bg-white shadow-lg">
      <div className="flex items-center gap-1.5 border-b border-border bg-surface px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
        <span className="ml-3 text-[11px] font-medium text-text-muted">
          Kindred Mind
        </span>
      </div>

      <div className="grid grid-cols-[44px_1fr]">
        <aside className="flex flex-col items-center gap-4 border-r border-border bg-surface py-4">
          {/* Dashboard mockup brand mark — the icon-only crop of the
              official Kindred logo. The full wordmark (used in the real
              nav and footer above and below this section) is too wide for
              the 44px sidebar; this icon-only variant carries the same
              brand at sidebar size. */}
          <img
            src="/brand/kindred-mark.png"
            alt=""
            aria-hidden="true"
            className="h-5 w-auto"
          />
          <span className="h-1 w-1 rounded-full bg-text-muted" />
          <span className="h-1 w-1 rounded-full bg-text-muted" />
          <span className="h-1 w-1 rounded-full bg-text-muted" />
          <span className="h-1 w-1 rounded-full bg-text-muted" />
        </aside>

        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          <div className="rounded-card border border-border bg-white p-4">
            <p className="text-[11px] font-medium text-text-muted">
              Community Health
            </p>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-bold text-text-primary">87%</span>
              <span className="text-[11px] font-medium text-success">Healthy</span>
            </div>
            <p className="mt-1 text-[11px] text-text-muted">+12% vs last 30 days</p>
          </div>

          <div className="rounded-card border border-border bg-white p-4">
            <p className="text-[11px] font-medium text-text-muted">
              Recent Insights
            </p>
            <ul className="mt-2 space-y-1.5 text-[12px] text-text-secondary">
              <li className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-coral" />
                Sarah has been quiet for 7 days
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-coral" />
                David returned after 1 month away
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-coral" />
                Top supporter reached anniversary
              </li>
            </ul>
          </div>

          <div className="rounded-card border border-border bg-white p-4">
            <p className="text-[11px] font-medium text-text-muted">
              Returning Members
            </p>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-bold text-text-primary">12</span>
            </div>
            <p className="mt-1 text-[11px] text-text-muted">+4 this week</p>
            <div className="mt-2 flex -space-x-1.5">
              {['bg-coral', 'bg-brand-primary', 'bg-accent-gold', 'bg-info'].map(
                (c, i) => (
                  <span
                    key={i}
                    className={`h-5 w-5 rounded-full border-2 border-white ${c}`}
                  />
                ),
              )}
            </div>
          </div>

          <div className="rounded-card border border-border bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-text-muted">
                Relationship Timeline
              </p>
              <span className="text-[10px] text-brand-primary">View all insights</span>
            </div>
            <svg viewBox="0 0 100 30" className="mt-2 h-12 w-full">
              <polyline
                points="0,22 12,18 24,20 36,12 48,16 60,8 72,14 84,6 100,10"
                fill="none"
                stroke="#5B3CC4"
                strokeWidth="1.5"
              />
              {[0, 12, 24, 36, 48, 60, 72, 84, 100].map((x, i) => (
                <circle key={i} cx={x} cy={[22, 18, 20, 12, 16, 8, 14, 6, 10][i]} r="1.5" fill="#5B3CC4" />
              ))}
            </svg>
          </div>

          <div className="col-span-1 sm:col-span-2">
            <div className="flex items-center gap-2 rounded-input border border-border bg-white px-3 py-2">
              <MessageSquare className="h-4 w-4 text-text-muted" />
              <span className="text-[12px] text-text-muted">
                Who is Sarah? Ask Kindred anything…
              </span>
              <span className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-md bg-brand-primary text-white">
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrustedBy() {
  return (
    <section className="border-y border-border bg-surface py-10">
      <div className="mx-auto max-w-marketing px-6 sm:px-8">
        <p className="text-center text-xs font-medium uppercase tracking-wider text-text-secondary">
          Trusted by community builders
        </p>
        <ul className="mt-6 grid grid-cols-2 items-center justify-items-center gap-x-6 gap-y-4 sm:grid-cols-4">
          {TRUSTED_BY.map((brand) => (
            <li
              key={brand.name}
              className="flex items-center gap-2 text-sm font-semibold text-text-secondary"
            >
              {brand.name === 'Telegram' ? (
                <Send className="h-4 w-4 text-info" />
              ) : brand.name === 'Built with AI' ? (
                <Sparkles className="h-4 w-4 text-coral" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-coral" />
              )}
              <span>{brand.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Problem() {
  return (
    <section className="mx-auto w-full max-w-marketing px-6 py-24 sm:px-8">
      <h2 className="text-center text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
        The problem every creator faces
      </h2>

      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
        {PROBLEMS.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="rounded-card border border-border bg-white p-6 shadow-sm"
          >
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface">
              <Icon className="h-5 w-5 text-brand-primary" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-text-primary">
              {title}
            </h3>
            <p className="mt-1.5 text-sm text-text-secondary">{description}</p>
          </div>
        ))}
      </div>

      <p className="mt-10 text-center text-base text-text-secondary sm:text-lg">
        Kindred Mind <span className="font-semibold text-brand-primary">remembers</span> them for you.
      </p>
    </section>
  );
}

function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="bg-surface py-24"
    >
      <div className="mx-auto max-w-marketing px-6 sm:px-8">
        <p className="text-center text-xs font-semibold uppercase tracking-wider text-brand-primary">
          How Kindred Mind works
        </p>
        <h2 className="mt-3 text-center text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
          Three simple steps
        </h2>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {STEPS.map(({ n, icon: Icon, title, body }) => (
            <div
              key={n}
              className="relative rounded-card border border-border bg-white p-6 shadow-sm"
            >
              <span className="absolute right-6 top-6 text-sm font-semibold text-text-muted">
                {n}
              </span>
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface">
                <Icon className="h-5 w-5 text-brand-primary" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-text-primary">
                {title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DashboardShowcase() {
  return (
    <section className="mx-auto w-full max-w-marketing px-6 py-24 sm:px-8">
      <p className="text-center text-xs font-semibold uppercase tracking-wider text-brand-primary">
        Your community, remembered
      </p>
      <h2 className="mt-3 text-center text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
        Everything your community remembers.
        <br />
        In one beautiful dashboard.
      </h2>

      <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.4fr]">
        <ul className="space-y-4 self-center">
          {DASHBOARD_CALLOUTS.map((item) => (
            <li
              key={item}
              className="flex items-center gap-3 rounded-input border border-border bg-white px-4 py-3 shadow-sm"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-surface text-brand-primary">
                <Check className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm font-medium text-text-primary">{item}</span>
            </li>
          ))}
        </ul>

        <div className="lg:-rotate-1">
          <DashboardMockup />
        </div>
      </div>
    </section>
  );
}

function FeaturesGrid() {
  return (
    <section id="features" className="bg-surface py-24">
      <div className="mx-auto max-w-marketing px-6 sm:px-8">
        <p className="text-center text-xs font-semibold uppercase tracking-wider text-brand-primary">
          Powerful features for stronger relationships
        </p>
        <h2 className="mt-3 text-center text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
          Built for creators who care about people
        </h2>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-card border border-border bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface">
                <Icon className="h-5 w-5 text-brand-primary" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-text-primary">
                {title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AskKindred() {
  return (
    <section className="bg-text-primary py-24 text-white">
      <div className="mx-auto max-w-marketing px-6 sm:px-8">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-coral">
              Ask Kindred
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Ask anything about your community.
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-neutral-300">
              Kindred Mind understands relationships, not just data.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-neutral-300">
              {ASK_EXAMPLES.map((q) => (
                <li key={q} className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-coral" />
                  {q}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-input border border-neutral-700 bg-neutral-900 px-3 py-2.5">
              <MessageSquare className="h-4 w-4 text-neutral-400" />
              <span className="text-sm text-neutral-400">
                Who quietly returned this month?
              </span>
              <span className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md bg-brand-primary text-white">
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </div>

            <div className="rounded-card border border-neutral-700 bg-neutral-900 p-5">
              <p className="text-xs text-neutral-400">
                Here are members who quietly returned this month:
              </p>
              <ul className="mt-4 space-y-3">
                {[
                  { name: 'David', meta: 'Returned 5 days ago' },
                  { name: 'Aisha', meta: 'Returned 1 week ago' },
                  { name: 'Mike', meta: 'Returned 2 weeks ago' },
                ].map((m) => (
                  <li
                    key={m.name}
                    className="flex items-center gap-3 rounded-input bg-neutral-800 p-3"
                  >
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-coral text-xs font-semibold text-white">
                      {m.name[0]}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">{m.name}</p>
                      <p className="text-[11px] text-neutral-400">{m.meta}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-neutral-400">
                These members haven’t been very active yet. Consider reaching out.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function BuiltFor() {
  return (
    <section className="mx-auto w-full max-w-marketing px-6 py-24 sm:px-8">
      <h2 className="text-center text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
        Built for creator communities
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-center text-base text-text-secondary">
        Everything Kindred Mind does starts with one promise: remember the
        people, not the messages.
      </p>

      <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
        {BUILT_FOR.map((card) => (
          <div
            key={card.title}
            className="rounded-card border border-border bg-white p-6 shadow-sm"
          >
            <h3 className="text-lg font-semibold text-text-primary">
              {card.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              {card.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FAQ() {
  return (
    <section id="faq" className="bg-surface py-24">
      <div className="mx-auto max-w-3xl px-6 sm:px-8">
        <p className="text-center text-xs font-semibold uppercase tracking-wider text-brand-primary">
          Frequently asked questions
        </p>
        <h2 className="mt-3 text-center text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
          Common questions, honest answers
        </h2>

        <div className="mt-12 space-y-3">
          {FAQS.map((item) => (
            <details
              key={item.q}
              className="group rounded-card border border-border bg-white p-5 shadow-sm [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-text-primary">
                <span>{item.q}</span>
                <ChevronDown className="h-5 w-5 text-text-muted transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="mx-auto w-full max-w-marketing px-6 py-24 sm:px-8">
      <div className="rounded-container border border-border bg-surface p-10 sm:p-14">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
              Ready to build stronger relationships?
            </h2>
            <p className="mt-3 text-base text-text-secondary sm:text-lg">
              Start remembering every relationship, not just every message.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <a
              href="/signup"
              className="inline-flex items-center gap-2 rounded-input bg-brand-primary px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-primary-hover"
            >
              Get Started
              <ArrowUpRight className="h-4 w-4" />
            </a>
            <a
              href="/login"
              className="inline-flex items-center gap-2 rounded-input border border-brand-primary bg-white px-6 py-3 text-sm font-semibold text-brand-primary transition-colors hover:bg-white"
            >
              Log in
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-marketing px-6 py-12 sm:px-8">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <a href="#top" className="flex items-center gap-2.5">
              <img
                src="/brand/kindred-logo.png"
                alt="Kindred Mind"
                className="h-7 w-auto"
              />
            </a>
            <p className="mt-3 max-w-xs text-sm text-text-secondary">
              Never let a loyal fan become a forgotten fan. Built with Minds.
              Made for community builders.
            </p>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                {col.title}
              </p>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-text-primary transition-colors hover:text-brand-primary"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-text-muted">
            © 2026 Kindred Mind. All rights reserved.
          </p>
          <p className="inline-flex items-center gap-1.5 text-xs text-text-muted">
            <Sparkles className="h-3.5 w-3.5 text-coral" />
            Built with Minds
          </p>
        </div>
      </div>
    </footer>
  );
}

// =====================================================================
// Page composition — fixed order
// =====================================================================

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-text-primary">
      <Nav />
      <Hero />
      <TrustedBy />
      <Problem />
      <HowItWorks />
      <DashboardShowcase />
      <FeaturesGrid />
      <AskKindred />
      <BuiltFor />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}
