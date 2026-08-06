# Kindred Mind — Design Foundation

**Version 1.0 — Official visual foundation for every Kindred product surface.**
**Applies to:** `apps/web` (dashboard, marketing, onboarding, settings) and any future surface that represents Kindred to a human being.
**Source of truth:** this document. When the Build Plan, an existing component, or a future PR conflicts with this document, this document wins until revised.

> **Naming convention.** The product that users see is **Kindred**. Internally — in design notes, code comments, architecture notes, prompts, and marketing copy — we frequently refer to the project as **Kindred Mind**, **Kindred Minds**, or **Kindred-Mind**. The Mind is the intelligence. The product is the experience. Both are valid; both are the same project.
>
> Throughout this document, when we describe *what Kindred Mind is, what it does, how it works, or how it feels*, we use **Kindred Mind**. When we describe *the public surface, the user-facing product, the marketing message, the words on a button or a page*, we use **Kindred**.
>
> Examples:
> - *Kindred Mind remembers every relationship.* (internal — what it is)
> - *Kindred Mind continuously learns community relationships.* (internal — what it does)
> - *The Kindred Mind dashboard…* (internal — the product surface as a system)
> - *The Kindred-Mind onboarding flow…* (internal — the flow as a designed experience)
> - *Kindred — never let a loyal fan become a forgotten fan.* (public — the words on the page)
> - *"Get Started with Kindred."* (public — a button label)

---

## 1. Brand personality

Kindred Mind is the personality of a **thoughtful, attentive friend who happens to remember everything**. Not a corporate assistant, not a hype machine, not a robot. The user-facing product is Kindred, but the personality is the Mind — the same voice carries through every surface.

Six traits, in priority order. If a design decision conflicts with one of these, the higher-ranked trait wins.

1. **Calm.** Nothing on the screen should feel urgent unless it actually is. No pulsing, no badges screaming at the user, no "LIMITED TIME" energy.
2. **Trustworthy.** A creator's community is the most valuable thing they own. Every screen must look like it would treat that responsibility with care.
3. **Intelligent.** The Kindred Mind is the product. The interface should feel like a well-read colleague, not a chatbot — confident phrasing, no exclamation marks, no cheerful emojis in product copy.
4. **Modern.** Current SaaS aesthetic (Linear, Vercel, Notion AI, Stripe, OpenAI). Restrained color, generous whitespace, sharp typography.
5. **Human.** Warm in tone, never cold. Plain language, second person, contractions allowed. No corporate hedging.
6. **Premium.** Confident about its choices. Doesn't show off. Doesn't apologize.

### Voice in one sentence

> A calm, well-read friend who tells you what you need to know, not everything they know.

### Voice rules (apply to all copy)

- **Calm, not cheerful.** No exclamation marks in product UI. Emojis are limited to the brand sparkle (✨) and the heart (❤️) used as visual accents only — never in body copy.
- **Plain language, no jargon.** "Loyal fan," not "high-engagement cohort member." "Quiet for 7 days," not "inactivity state transition."
- **Second person.** Address the user as "you" and the creator's community as "your community." Avoid "the user," "the customer," "users."
- **Active voice.** "Kindred Mind remembers" not "Relationships are remembered."
- **Short sentences.** Under 20 words by default. If a sentence needs a comma, it probably needs to be two sentences.
- **No filler.** Cut "simply," "just," "easily," "powerful," "seamless." If a word doesn't add information, delete it.
- **One thought per line.** In lists, microcopy, and tooltips, one line of meaning per line of layout.

### Vocabulary

| Use | Avoid |
|---|---|
| loyal fan | power user |
| community | group, channel, server (when describing a creator's audience) |
| remember | track, log, store (when describing what Kindred does) |
| insight | notification, alert, ping (when describing what the Mind produces) |
| relationship | interaction, engagement, touchpoint |
| creator | user, customer, admin (when describing the person who owns the community) |
| Kindred Mind | AI assistant, chatbot, model (when describing the intelligence) |

---

## 2. Color palette

### 2.1 Core tokens

These are the **only** colors any Kindred product surface is allowed to use. New colors are not added without revising this document.

| Token | Hex | Use |
|---|---|---|
| **Primary** | `#5B3CC4` | Primary action buttons, links, active states, focus rings, brand-emphasis highlights |
| **Secondary** | `#FF7A6B` | One-line headline accent ("forgotten fan."), warm data viz series, secondary CTAs only when a primary is already on screen |
| **Accent (Gold)** | `#F6B73C` | **Sparingly.** The brand sparkle, small "anniversary" or "milestone" markers, nothing structural |
| **Background** | `#FFFFFF` | Default page background, card surfaces |
| **Surface** | `#F8F9FC` | Subtle gray for side panels, table headers, code blocks, secondary cards |
| **Border** | `#E5E7EB` | Hairline dividers, card borders, input borders |
| **Primary Text** | `#111827` | Headings, body text, default state |
| **Secondary Text** | `#6B7280` | Captions, helper text, table metadata |
| **Muted Text** | `#9CA3AF` | Placeholders, disabled text, very low-emphasis labels |
| **Success** | `#22C55E` | Success toasts, "active" status, positive deltas |
| **Warning** | `#F59E0B` | Warning toasts, "approaching threshold" states |
| **Danger** | `#EF4444` | Error toasts, destructive actions, "disconnected" status |
| **Info** | `#3B82F6` | Informational toasts, neutral highlight (not brand) |

### 2.2 Usage rules

- **Default page background is white.** `#F8F9FC` is for surfaces *inside* a white page (side panels, table headers), never for the page itself.
- **White dominates every screen.** The Kindred Mind interface is overwhelmingly white. On any given page, white should be the visually dominant color — easily 80%+ of the surface area. Brand colors are accents, not the background. If a screen feels colorful, the design is wrong.
- **Brand color appears on at most ~10% of any given screen.** The reference system is overwhelmingly white with a single purple element pulling the eye (a button, a link, an active tab, the small sparkle).
- **Purple is for action and emphasis only.** Buttons, links, icons, focus rings, active states, and small highlights. Purple is never a large background, a section fill, a card chrome, or a hero block. No purple hero sections. No purple page sections. No purple dividers. No purple card backgrounds.
- **Coral is rarer than purple.** One line in a hero headline, one data series in a chart, one secondary CTA, one accent on a small illustration. Never coral and purple on the same element.
- **Gold is decoration only.** Sparkle, divider accent, "milestone reached" badge fill. Never a primary action, never a background.
- **No gradients, no glows, no neon.** The Kindred Mind product does not have a dark-mode neon variant. If a design needs more visual weight, use a stronger type size, a heavier shadow, or a more generous radius — not more color.
- **No purple-on-purple or coral-on-coral text.** Always pair brand color with white or `#111827`.
- **Text contrast:** Primary Text on Background is 16.8:1 (AAA). Secondary Text on Background is 4.83:1 (AA). Muted Text is for non-essential content only.

### 2.3 The "minimal by default" rule

Every Kindred Mind surface, by default, looks like this: a white page, a single column or grid of white cards with hairline borders and a soft shadow, one or two purple interactive elements, and a single line of coral in the headline. That's the system. Anything more — colored backgrounds, gradient hero sections, dense use of brand color, decorative shapes — is the exception, and the exception needs a written reason.

When reviewing a screen, ask: *"Could I make this 30% more white?"* Usually the answer is yes. Remove the decorative color before you add the explanatory copy.

---

## 3. Typography

### 3.1 Font stack

**One font family across the entire product: Inter.** Simplicity and consistency win over editorial flourish. Every surface — headings, sub-headings, body, buttons, labels, code — uses Inter. The fallback is `system-ui`. There is no second typeface in the Kindred Mind system.

| Role | Font | Fallback | Weight |
|---|---|---|---|
| **Headings (H1, H2, H3)** | Inter | system-ui | 700 (bold) |
| **Sub-headings (H4, H5, H6)** | Inter | system-ui | 600 (semibold) |
| **Body** | Inter | system-ui | 400 (regular) |
| **Buttons** | Inter | system-ui | 600 (semibold) |
| **Small labels, badges, table headers** | Inter | system-ui | 500 (medium) |
| **Code, monospace** | ui-monospace, SFMono-Regular, Menlo, monospace | — | 400 |

Inter is the system that lets the rest of the design do the work. Headings earn hierarchy from **size and weight**, not from a different typeface.

### 3.2 Type scale

A single modular scale, ratio 1.25 (major third), anchored at 16px body.

| Token | Size (px) | Use |
|---|---|---|
| `text-xs` | 12 | Eyebrow labels, microcopy, helper text |
| `text-sm` | 14 | Buttons, table cells, secondary text |
| `text-base` | 16 | Body text (default) |
| `text-lg` | 20 | Card titles |
| `text-xl` | 24 | Section headings |
| `text-2xl` | 30 | Page sub-titles |
| `text-3xl` | 36 | Page titles (H1) |
| `text-4xl` | 48 | Hero headlines |
| `text-5xl` | 60 | Marketing hero (desktop only) |

### 3.3 Line height

| Use | Line height |
|---|---|
| Headings (any size) | 1.1 |
| Body text | 1.5 |
| Buttons / labels | 1.25 |

### 3.4 Letter spacing

- **Default:** normal (0).
- **Eyebrow text and badges** (small labels above a heading): `tracking-wider` (0.05em), all caps.
- **Brand wordmark** (the literal "KINDRED" text in the logo): wide tracking (`0.2em`).

### 3.5 The "forgotten fan." moment

A signature element of the brand: in any long headline, **one line** — and only one — is rendered in `#FF7A6B` (Secondary) while the rest of the headline is `#111827` (Primary Text). This is the only place coral appears in body copy, and it always marks a moment of emotional emphasis tied to the brand promise.

Example: *"Never let a loyal fan become a **forgotten fan.**"*

This pattern is reserved for marketing headlines, hero copy, and one-line taglines inside product surfaces (e.g. empty-state copy on the dashboard). It is **never** used in two lines of the same headline, and it is **never** used in body paragraphs.

---

## 4. Spacing

### 4.1 Base unit: 4px

Every margin, padding, and gap in the product is a multiple of 4px. There are no 6px or 10px values. Designers and developers both work from the same scale.

### 4.2 Scale

| Token | Value (px) | Use |
|---|---|---|
| `space-1` | 4 | Icon-to-label gap inside a chip |
| `space-2` | 8 | Tight icon spacing, badge padding |
| `space-3` | 12 | Form field internal padding (small) |
| `space-4` | 16 | Default element padding, gap between adjacent inline elements |
| `space-6` | 24 | Card internal padding (small), gap between list items |
| `space-8` | 32 | Card internal padding (default), section sub-gap |
| `space-12` | 48 | Section padding (compact) |
| `space-16` | 64 | Section padding (default) |
| `space-24` | 96 | Hero section vertical padding, large vertical rhythm |

### 4.3 Rules

- **Use generous whitespace.** Sections breathe. The reference design has visibly more empty space than content space on most pages. When in doubt, double the gap.
- **Never cram components together.** If two cards look like they need a hairline divider to be distinguishable, they actually need more space.
- **Vertical rhythm.** Section-to-section vertical padding is at least `space-12` (48px), and at least `space-16` (64px) for top-level page sections.
- **Container max-width.** Marketing pages: 1200px. Dashboard: 1280px. Forms: 480px. Reading content (legal, docs): 720px.
- **Side gutter on mobile:** 16px. Tablet: 24px. Desktop: 32px.

---

## 5. Border radius

| Element | Radius |
|---|---|
| **Inputs** | 14px |
| **Buttons** | 14px |
| **Cards** | 20px |
| **Large containers** (modals, sheets, hero blocks) | 24px |
| **Pills, badges, tags, chips** | 9999px (full round) |
| **Avatars** | 9999px (full round for circular), 12px (rounded square variant) |
| **Code blocks, table cells** | 8px |

**Two scales, not five.** Inputs and buttons share 14px so they feel like one family. Cards and large containers share the 20–24 family. Anything in between is a sign the design isn't following the system.

---

## 6. Shadows

Very soft. Never the heavy floating cards of 2018-era SaaS.

| Token | Value | Use |
|---|---|---|
| `shadow-sm` | `0 1px 2px rgba(0, 0, 0, 0.04)` | Hairline elevation, hover state on flat surfaces |
| `shadow-md` | `0 4px 12px rgba(0, 0, 0, 0.05)` | Default card elevation, dropdown menus |
| `shadow-lg` | `0 8px 30px rgba(0, 0, 0, 0.06)` | Modal, sheet, popover, elevated card on hover |
| `shadow-xl` | `0 16px 48px rgba(0, 0, 0, 0.08)` | Reserved for hero product mockups only |

**Rules**

- Default rest state of a card is `shadow-sm` or `shadow-md`, not `shadow-none`. A flat card looks unfinished.
- Hovering a clickable card elevates it to the next shadow in the scale (sm → md → lg), never by more than one step.
- Shadows never have color tint (no purple shadow, no coral shadow). They are always neutral black at low alpha.
- Never combine two shadows on the same element. Never use a shadow as a border substitute.

---

## 7. Icons

**Library:** [Lucide](https://lucide.dev) (outline variant). Already familiar to the open-source ecosystem, regular in weight, and matches the calm visual language.

### 7.1 Rules

- **Default weight:** 1.5px stroke (Lucide's `stroke-width` token). Heavier than Lucide's default 2px so icons feel proportional to Inter at body size.
- **Default size:** 16px inline, 20px in buttons, 24px in feature blocks, 32px in hero spots. Never larger than 48px in any UI context.
- **Rounded corners.** Lucide's outline variant already does this; do not add additional `border-radius` to icons.
- **Minimal.** Do not stack two icons to create a new one. If a Lucide icon doesn't exist for the concept, use the closest match and adjust microcopy rather than inventing a new glyph.
- **Color follows text.** Icons inherit the text color of their parent unless the icon is itself a brand element (a purple "send" icon on a primary button). Never apply color to an icon that isn't carrying semantic meaning.
- **No filled variants in product UI.** Filled icons are reserved for marketing/illustration contexts only. Product surfaces use outline only.

### 7.2 Common icon set

The following are the default icons for repeated concepts. Components reference these by name, never by inline SVG.

| Concept | Lucide name |
|---|---|
| Send | `send` |
| Settings | `settings` |
| Insights | `sparkles` |
| Members | `users` |
| Community | `messages-square` |
| Notifications | `bell` |
| Back / close | `x` |
| Confirm | `check` |
| External link | `arrow-up-right` |
| New / add | `plus` |
| Time | `clock` |
| Telegram (brand) | `send` with coral fill, OR the official Telegram SVG (preferred in production) |

---

## 8. Buttons

Three button styles, in priority order. The hierarchy is the order; do not introduce a fourth style.

### 8.1 Primary button

The dominant action on any given screen. There is **at most one** primary button per visible region (a card, a section, a modal). If a screen has two competing primary actions, the less-important one becomes a secondary button.

- Background: `#5B3CC4` (Primary)
- Text: `#FFFFFF`
- Hover: `#5B3CC4` at 90% lightness, or `#4A2FA8` (darker purple)
- Active (pressed): `#3F278F` (darkest purple)
- Focus ring: 2px `#5B3CC4` at 40% alpha, 4px offset
- Disabled: 40% opacity, no hover
- Padding: 12px vertical, 24px horizontal
- Radius: 14px
- Font: Inter 600, 14px
- Text style: title case ("Get Started"), sentence case for multi-word actions ("Save changes"). Never all caps.

### 8.2 Secondary button

For every other action. Visually equal weight to a primary in a different role — they live on the same row but only one is primary.

- Background: `#FFFFFF`
- Border: 1.5px `#5B3CC4`
- Text: `#5B3CC4`
- Hover: background `#F8F9FC`
- Active: background `#E5E7EB`
- Padding / radius / font: same as primary
- Text style: same casing rule

### 8.3 Ghost button

For tertiary actions, in-card links, and low-emphasis navigation. Never used for a destructive action or a primary CTA.

- Background: transparent
- Text: `#111827` (or `#5B3CC4` if it's a "see more" / "view details" link)
- Hover: background `#F8F9FC`
- Padding: 8px vertical, 12px horizontal (slightly tighter than primary/secondary)
- No border
- Font: Inter 600, 14px

### 8.4 Destructive variant (only when needed)

Used for "Disconnect community," "Delete insight," etc. Same shape as a primary button but in `#EF4444` (Danger). Confirmation is required for any destructive action — never a one-click delete.

### 8.5 Icon buttons

Square, 40×40, 14px radius. Icon centered, 20px. Same hover and focus treatment as the corresponding text button style.

### 8.6 Loading state

Primary and secondary buttons replace their label with a spinner (`Loader2` from Lucide, animated) and become disabled. Never change the button's width during loading.

---

## 9. Inputs

### 9.1 Text input

- Background: `#FFFFFF`
- Border: 1.5px `#E5E7EB` (Border)
- Text: `#111827`
- Placeholder: `#9CA3AF` (Muted Text)
- Padding: 14px vertical, 16px horizontal — generous, never cramped
- Radius: 14px
- Font: Inter 400, 16px (matches body, avoids iOS auto-zoom on focus)
- Focus: border `#5B3CC4`, 2px focus ring `#5B3CC4` at 40% alpha
- Error: border `#EF4444`, helper text in `#EF4444` below
- Disabled: background `#F8F9FC`, text `#9CA3AF`, no border highlight

### 9.2 Label

- Above the input, not inside
- Inter 500, 14px, `#111827`
- Optional helper text: Inter 400, 12px, `#6B7280`, below the input

### 9.3 Other input types

- **Textarea:** same style as text input, min-height 96px, resizable vertically
- **Select / dropdown:** styled native or shadcn `Select`. Same border, padding, radius.
- **Checkbox / radio:** custom-built. 20×20, 4px radius (checkbox) or full-round (radio). Checked state uses `#5B3CC4`. Never use browser default styles.
- **Toggle / switch:** 40×22 pill. Track `#E5E7EB` (off) / `#5B3CC4` (on). Thumb `#FFFFFF` with subtle shadow.
- **Search:** input with leading `search` icon. Same style as text input.

### 9.4 Forms

- Max width 480px.
- Field spacing 24px (`space-6`).
- Submit button is a primary button, full-width on mobile, right-aligned on desktop.
- Error summary at the top of the form for any global errors.

---

## 10. Cards

The dominant content container. Used for: dashboard widgets, member rows, insight cards, feature blocks in marketing, community tiles.

### 10.1 Default card

- Background: `#FFFFFF`
- Border: 1px `#E5E7EB`
- Shadow: `shadow-sm` (or `shadow-md` if the card is the focal point of its region)
- Radius: 20px
- Padding: 24px (`space-6`) by default. Use 32px (`space-8`) for hero-sized cards.

### 10.2 Interactive card (clickable)

Same default style, with:
- Hover: `shadow-md` (one step up), `border-color: #D1D5DB` (slightly darker hairline)
- Active (pressed): `shadow-sm`, `border-color: #5B3CC4`
- Cursor: pointer
- Optional: subtle 1px translate on hover (`translateY(-1px)`) — never more than 1px

### 10.3 Card composition

- **Title:** Inter 600, 20px, `#111827`
- **Subtitle / metadata:** Inter 400, 14px, `#6B7280`
- **Body:** Inter 400, 16px, `#111827`
- **Card footer** (when present): separated by 1px `#E5E7EB` border-top, 16px padding
- **Eyebrow / category label** (when present above title): Inter 500, 12px, uppercase, `#6B7280`, `tracking-wider`

### 10.4 Card grid

- Desktop: 3–4 columns max
- Tablet: 2 columns
- Mobile: 1 column
- Gap: 24px (`space-6`)

---

## 11. Layout rules

### 11.1 Page regions

Every page is composed of four regions, in this order top to bottom:

1. **Top nav.** Sticky. 64px tall. White background, 1px bottom border, contains logo, primary nav links, and a primary CTA on the right. On scroll, no shadow — the border alone is enough.
2. **Page header.** Optional. Contains a page title (H1, `text-3xl`), optional subtitle, and a row of page-level actions on the right. Padding `space-12` top, `space-8` bottom.
3. **Main content.** The body of the page. Default padding `space-12` vertical. Background is white.
4. **Footer.** Marketing pages only. Dashboard pages do not have a global footer — each section has its own metadata. Marketing footer: muted background, simple text links in columns, copyright line, social icons.

### 11.2 Navigation

- **Primary nav links:** Inter 500, 14px, `#111827` (rest) / `#5B3CC4` (active). Active state has no underline — the purple text alone is enough.
- **Section dividers in nav:** use spacing, not lines, between nav groups.
- **Breadcrumbs:** Inter 500, 14px. Current page in `#111827`, ancestors in `#6B7280` with hover-to-purple.

### 11.3 Empty / loading / error states

Every list view, every page that fetches data, every form that submits — must have all four states designed:

- **Default (with data):** the screen as designed.
- **Loading:** skeleton placeholders that match the eventual content's shape (not spinners that block the whole page). 1.5s max perceived load; if longer, show a thin progress bar at the top.
- **Empty:** friendly copy in Inter 500, an illustration or icon in `#E5E7EB`, a single primary action. Empty-state copy explains what would go here and how to get started.
- **Error:** calm red banner at the top, a one-line explanation in plain language, a retry button. Never a full-page error. Never a stack trace.

### 11.4 Density

Dashboard pages prioritize information density — the user is here to do work. Marketing pages prioritize whitespace — the user is here to evaluate. Pick the right density for the surface.

- **Dashboard density:** 14px body, 24px row padding, 4–6 widgets per page.
- **Marketing density:** 16px body, 48–96px section padding, 1–2 focal elements per screen.

---

## 12. Illustration style

**Minimal. Flat. Clean. Professional SaaS.**

- **No 3D.** No isometric, no depth, no perspective, no drop shadows on illustrations.
- **No cartoon.** No mascots, no characters with faces (the brand "figures" in the logo are abstract silhouettes, not characters — that line stops at the logo).
- **No bright gradients.** If a gradient is used, it is between two adjacent brand tokens (Primary → a slightly lighter purple), at most 8% lightness difference, used as a soft fill, never as a decorative effect.
- **No neon, no glow, no glow halos.**
- **Line work is preferred over filled shapes.** When a filled shape is used, it is in a single muted color (`#E5E7EB` or a 20% brand tint) — never in `#FF7A6B` or `#F6B73C`.
- **Photography is allowed in marketing contexts** (creator headshots, community screenshots) but never in product UI. Product UI uses illustrations or no imagery.
- **The brand sparkle (✨) is a permitted decorative element.** It appears in marketing hero copy and on milestone badges in product UI. It is the only "decoration" the brand permits.

---

## 13. Accessibility

The product is a tool for creators managing real human relationships. Accessibility is not optional.

- **Color contrast** (verified at the color-palette section above): all text against its background meets WCAG 2.1 AA at minimum. Primary text on white is AAA.
- **Color is never the only signal.** Status indicators include both color and an icon or label. A "disconnected" community is not just red — it has a disconnected icon and the word "Disconnected."
- **Focus is always visible.** Every interactive element has a focus ring on keyboard navigation. The focus ring is always the Primary color, never browser default.
- **Keyboard navigation works everywhere.** Tab order matches visual order. Modals trap focus. Esc closes overlays.
- **Screen reader labels.** Every icon-only button has an `aria-label`. Every form field has a visible label (no placeholder-only labels). Every image has alt text or empty alt for decorative.
- **Touch targets** are at least 44×44px on mobile.
- **Motion.** Respect `prefers-reduced-motion`. All transitions have a 0ms variant. No essential information is conveyed by motion alone.
- **Language.** Use semantic HTML (`<button>`, `<a>`, `<main>`, `<nav>`, `<article>`). Don't build a button out of a div.

---

## 14. Responsive rules

### 14.1 Breakpoints

| Token | Min width | Typical device |
|---|---|---|
| `sm` | 640px | Large phone, small tablet portrait |
| `md` | 768px | Tablet portrait |
| `lg` | 1024px | Tablet landscape, small laptop |
| `xl` | 1280px | Laptop |
| `2xl` | 1536px | Desktop |

The product is **desktop-first** for the dashboard (creators work at their desks) and **mobile-first** for the marketing site and the onboarding flow (creators discover and set up on their phones).

### 14.2 Rules

- **The dashboard layout collapses to a single column below `lg` (1024px).** Sidebars become top bars; multi-column widgets stack.
- **Marketing pages reflow freely** at every breakpoint. The hero section, in particular, reflows from two-column (text + product mockup) on desktop to single-column (text, then mockup) on mobile.
- **No horizontal scroll on mobile.** Ever. The single most common mobile bug.
- **Touch targets ≥ 44×44px on mobile.**
- **The mobile nav is a hamburger that opens a full-screen sheet.** Never a dropdown menu on mobile.
- **The brand wordmark "KINDRED" never reflows to two lines.** It is one word, always.

---

## 15. Animation rules

Motion is for **feedback**, not decoration. Every animation answers "what just happened?"

### 15.1 Principles

- **Fast.** Default duration 150ms for state changes, 250ms for content reveals. Never more than 400ms.
- **Calm.** Easing is `cubic-bezier(0.4, 0, 0.2, 1)` (Material "standard") or `cubic-bezier(0, 0, 0.2, 1)` (Material "decelerate") for entrances. Linear is for spinners only.
- **Subtle.** No bouncy springs, no overshoots, no rubber-banding. Linear progress bars, not playful ones.
- **Optional.** Respect `prefers-reduced-motion`. Every transition has a 0ms equivalent.

### 15.2 Specific patterns

| Interaction | Animation |
|---|---|
| Button press | Scale to 0.98 for 100ms, then back. |
| Card hover | Shadow elevation one step up + 1px translateY, 150ms. |
| Modal open | Backdrop fade 200ms; content scale 0.96 → 1.0 + fade 200ms. |
| Toast | Slide in from top 250ms, hold, fade out 150ms. |
| Page transition | Cross-fade only, 150ms. No slide. |
| Loading skeleton | Pulse animation 1.5s, `opacity 0.6 → 1.0 → 0.6`. |
| Dropdown / popover | Fade + 4px translateY, 150ms. |

### 15.3 What not to animate

- **No parallax.** No scroll-driven movement.
- **No auto-playing carousels.** The marketing hero is static.
- **No loading spinners that block the whole screen.** Skeleton only.
- **No animated illustrations in product UI.** Marketing only, and even there, sparingly.

---

## 16. UI principles

Twelve rules. Every screen should pass all twelve.

1. **One primary action per region.** If a card has two CTAs, one is primary, the rest are secondary or ghost.
2. **Hierarchy by size and weight, not color.** The most important thing on the screen is the largest, boldest text — not the most colorful.
3. **Whitespace is content.** If a region feels empty, it is correctly empty.
4. **The user is one step ahead.** Show them what they need to do next, before they look for it.
5. **Trust the data shape.** Don't repeat labels that the data already implies. A "Member" card doesn't need to say "Member" if it's in the Members section.
6. **Reveal, don't dump.** A dashboard is a summary. Details are one click away. The full data is a page, not the homepage.
7. **Consistent iconography for consistent concepts.** "Insights" is always `sparkles`. "Members" is always `users`. Never two different icons for the same concept across the product.
8. **Copy is UI.** Treat every word on the screen as a designed element. Cut every word that doesn't earn its place.
9. **Empty states are first-class.** An empty dashboard is a moment to teach, not a moment of absence.
10. **Errors are calm.** A red banner is fine. A red full-page error is not. A stack trace in production is a bug, not a feature.
11. **Loading is honest.** A skeleton that looks like the data is more honest than a spinner that blocks the screen.
12. **Mobile is the same product, not a different one.** No "mobile-only" features. No "desktop-only" features. The product works everywhere it renders.

---

## 17. Design Dos

- Use Inter for everything. One font family, every surface.
- Use one line of `#FF7A6B` per headline, as the brand emphasis moment.
- Use generous whitespace. When in doubt, double the gap.
- Use the brand sparkle (✨) on milestone moments — never as decoration elsewhere.
- Use the official Kindred logo on every page that represents the product. The logo never reflows, never recolors, and never animates.
- Use Lucide icons at 1.5px stroke weight.
- Use `tracking-wider` on eyebrow text and badges.
- Use empty states to teach.
- Use skeleton loaders, not blocking spinners.
- Use Inter at body size, never smaller than 14px.
- Use `rounded-[14px]` for inputs and buttons, `rounded-[20px]` for cards, `rounded-[24px]` for modals.
- Use the brand wordmark with the small heart/sparkle accent, never stripped down.

---

## 18. Design Don'ts

- No gradients. No neon. No glows. No drop shadows on illustrations.
- No purple as a section background or a card chrome.
- No two lines of coral in the same headline.
- No emojis in body copy. (Sparkle and heart are the only allowed emoji, and they are visual accents, not punctuation.)
- No exclamation marks in product UI.
- No all-caps button text.
- No "Easy," "Simple," "Just," "Powerful," "Seamless" in any copy.
- No "limited time," "don't miss out," urgency language anywhere in the product.
- No illustrations with faces, characters, or 3D rendering.
- No filled icons in product UI.
- No 6px or 10px spacing values.
- No 8px or 12px border radius on inputs, buttons, or cards. (Use 8px only on code blocks and table cells.)
- No shadows with color tint. Shadows are always neutral black at low alpha.
- No horizontal scroll on mobile. No exceptions.
- No "Coming soon" placeholder pages. If a feature isn't ready, it isn't listed.
- No browser-default form controls. Every checkbox, radio, select is custom.
- No placeholder text as a label. Labels live above the input, always.
- No "AI assistant" or "chatbot" in copy. The Mind is the product; it gets its name.
- No second logo variant. There is one Kindred logo, with documented dark-background and icon-only variations for contexts that require them.

---

## 19. Landing Page Content Blueprint

This section is the **content and structure blueprint** for Kindred's public marketing landing page (`/`). It is a documentation artifact, not implementation. The implementation lives in `apps/web/app/page.tsx` and ships in a separate, future task.

The page is read top to bottom and each section answers one question the visitor is asking. The visitor is a creator who has heard about Kindred Mind from a community thread, a hackathon post, a friend, or a search result. They are skeptical, busy, and scanning.

### 19.1 Top navigation

**Goal:** orient the visitor, let them explore without leaving the page, get them to "Get Started."

- **Left:** Kindred logo (icon + wordmark, dark-background variant not needed on a white page).
- **Center:** primary nav links — Features, How it Works, Pricing, FAQ.
- **Right:** "Log in" (ghost button) and **"Get Started"** (primary button).
- **Sticky** on scroll. 64px tall. 1px bottom border on scroll, no border at top of page. No background tint, no shadow.
- **Mobile:** hamburger that opens a full-screen sheet. Same link order.

### 19.2 Hero

**Goal:** in five seconds, tell the visitor what Kindred Mind is, who it's for, and what to do next.

- **Eyebrow pill** (above the headline, small): "AI relationship memory for Telegram communities." Subtle border, no fill, `tracking-wider` text.
- **Headline (H1, `text-4xl` desktop / `text-3xl` mobile):** *Never let a loyal fan become a **forgotten fan**.* The final two words are in `#FF7A6B`. This is the only place on the page coral appears in body copy.
- **Subheadline (one sentence, max ~20 words):** "Kindred Mind quietly remembers every relationship in your Telegram community, so you can focus on creating, not remembering."
- **Two CTAs side by side:** primary "Get Started Free →" (purple) and secondary "Watch Demo" (white with purple border).
- **Trust microcopy** below the CTAs: a small "Trusted by 2,000+ community builders" line with five small star icons and a row of four small avatar placeholders. (Real numbers and real avatars replace these in production.)
- **Right side (desktop only):** a static product mockup of the Kindred Mind dashboard — the same dashboard the creator will see after sign-up. No animation, no carousel. A single, polished screenshot.
- **No background tint. No gradient. No decorative shapes.** The hero is white with one purple button, one secondary button, and the coral moment in the headline.

### 19.3 Problem

**Goal:** make the visitor feel seen. They are here because the problem is real to them.

- **Section title (H2, `text-2xl`):** "Creators don't lose followers first. They lose relationships first." Or a variant the same shape: a two-sentence truth that names the pain without lecturing.
- **Three short paragraphs (or three small cards, your choice — cards are more visually scannable):**
  1. *As your community grows, your memory stops working.* Long-time supporters become indistinguishable from new followers.
  2. *Loyal fans slowly feel invisible.* Even when you genuinely want to remember them, you can't.
  3. *Every interaction restarts from zero.* The relationship quietly disappears.
- **No CTA in this section.** The section earns trust by naming the problem, not by asking for anything.

### 19.4 How Kindred Mind Works

**Goal:** demystify. Three steps, plain language, no jargon. The visitor should be able to explain it back to a friend in one sentence.

- **Section title (H2):** "How Kindred Mind works."
- **Three numbered steps, each in a white card with a small icon and a 01/02/03 numeral in the top-right corner:**
  1. **Connect your Telegram community.** Link your Telegram group in seconds. Kindred Mind joins as a silent observer.
  2. **Kindred Mind learns.** Our AI remembers interactions, tracks relationships, and detects meaningful moments.
  3. **Get insights when they matter.** Receive private notifications and answers to your most important questions.
- **Arrows between the cards** (desktop only) showing the flow. The arrows are thin, `#E5E7EB`, never purple.
- **No animated diagrams. No video. No interactive demo.** Static visuals that load instantly.

### 19.5 Features

**Goal:** show, don't tell. Three or four short feature blocks that map to the value the visitor already feels.

- **Section title (H2):** "What Kindred Mind does."
- **Four feature cards, each with a single icon, a one-line title, and a two-sentence description:**
  1. 🔔 **Quiet, private insights.** Kindred Mind tells you when relationships need attention — never publicly, never noisily.
  2. 🧠 **Remembers every person.** Members, milestones, participation, returns. The Mind builds a relationship ledger you can ask.
  3. 💬 **Ask Kindred anything.** "Who is Sarah?" "Who went quiet this month?" Plain questions, plain answers.
  4. 🔒 **Built for trust.** Privacy-first by design. The bot is visible. You see exactly what it observes.
- **Two-column layout on desktop** (2×2 grid), single column on mobile.
- **Icons are Lucide** at the documented color and size; the colored circles in the reference are an illustration choice, not a UI choice — in product, use the Lucide icon in `#5B3CC4` on a soft purple-tinted circle, not a coral or gold fill.

### 19.6 Dashboard Preview

**Goal:** the strongest visual proof. A larger, unmissable look at the actual product.

- **Section title (H2):** "Your community, remembered."
- **Subheadline:** "The Kindred Mind dashboard shows you what matters — the people, the moments, the quiet ones, the returning ones."
- **Large product screenshot** centered, max-width 1080px, with `shadow-lg`. Slightly tilted at -1° to feel less like a flat product card. Rounded corners (20px).
- **No carousel. No "before/after" toggle.** One screenshot, well-lit, well-composed.
- **No CTA in this section** — let the visual do the work. The next section's CTA picks up the conversion.

### 19.7 Social proof (optional but recommended)

**Goal:** borrowed credibility.

- **"Trusted by creators worldwide"** label.
- **Row of 4–6 small creator avatars** (real photos when available, neutral placeholder initials otherwise) with a name and a one-line role below each: "Sarah, Educator" / "David, Streamer" / etc.
- **One short testimonial** (one or two sentences) in a single card. A real quote from a real user, attributed. If no real testimonial is available, this section is omitted — placeholder quotes are worse than no section.

### 19.8 FAQ

**Goal:** handle the last objections before the final CTA.

- **Section title (H2):** "Common questions."
- **5–7 questions, each a `<details>` element that expands on click** (no animation, no library):
  1. *What does Kindred Mind actually do?*
  2. *Is my community data private?*
  3. *Do I need to install anything?*
  4. *Will the bot chat in my group?*
  5. *Can I disconnect a community?*
  6. *What does it cost?*
  7. *Which platforms are supported?*
- **Each answer is 2–3 sentences max.** Plain language, no marketing voice. The FAQ is the most honest page on the site.
- **No "still have questions? Contact us"** line. The contact form lives in the footer.

### 19.9 Final CTA

**Goal:** the last ask.

- **Section is one centered block on a white background with a soft-tinted surface (a single `#F8F9FC` panel, not a purple block).**
- **Headline (H2):** "Ready to remember every relationship in your community?"
- **Subheadline:** "Join thousands of creators using Kindred Mind."
- **Single primary CTA:** "Get Started" (purple).
- **No secondary CTA here.** The visitor has read the whole page. One clear path.

### 19.10 Footer

**Goal:** the supporting links, the legal text, the brand mark. Quiet.

- **Background:** `#F8F9FC` (the only place a tinted surface is allowed — it visually separates the footer from the white body).
- **Top row:** Kindred logo + tagline ("Never let a loyal fan become a forgotten fan.") on the left.
- **Four link columns:**
  - **Product:** Features, How it Works, Pricing, FAQ.
  - **Company:** About, Privacy Policy, Terms of Service.
  - **Resources:** Documentation, Contact.
  - **Follow us:** X, YouTube, GitHub (icons only, no labels).
- **Bottom row:** "© 2026 Kindred Mind. All rights reserved."
- **The footer never has a CTA. It never has a newsletter signup.** Those are mid-page elements if used at all; the footer is the close.

### 19.11 Page composition rules (for the landing page specifically)

- **Total sections:** 8–10, no more. A landing page that tries to do everything does nothing.
- **Section order is fixed.** Hero → Problem → How it Works → Features → Dashboard Preview → Social proof → FAQ → Final CTA → Footer. The order is the persuasion arc; do not reorder it.
- **Each section has one job.** If a section has two jobs, split it or remove one.
- **Every section gets the same generous vertical padding** (`space-16`, 64px) on top and bottom. Tight sections feel cheap.
- **Backgrounds:** white on every section, except the footer (`#F8F9FC`) and the optional social-proof block (also `#F8F9FC`). No other background color appears on the landing page.
- **Brand color appears on the page at most five times:** the primary "Get Started" in the nav, the primary "Get Started Free →" in the hero, the "Get Started" in the final CTA, the active link state in the nav, and the four feature icons. That's it. Less is more.
- **Coral appears on the page exactly once:** the final two words of the hero headline. That is the brand's signature moment on the marketing site.

### 19.12 Implementation handoff (for the next task)

When implementation begins, the work is:

- Build each section as its own component in `apps/web/components/landing/`.
- Compose them in `apps/web/app/page.tsx` in the order above.
- Use real, optimized product screenshots for the Hero and Dashboard Preview sections.
- Wire the "Get Started" CTAs to `/signup` (auth flow).
- Wire the "Watch Demo" CTA to a video modal (or `/demo` page if the demo is long-form).
- Wire the nav "Log in" to `/login`.
- Replace placeholder testimonials, avatars, and creator names with real content before submission.

This blueprint is the contract. The implementation must follow it.

---

## 20. Brand assets

### 20.1 Logo

The official Kindred logo lives in the repository at:

- **Primary logo (full, on light):** `.github/brand/kindred-logo.png`
- **Email-safe logo:** `apps/web/public/brand/kindred-logo-email.png`
- **GitHub social preview:** `.github/brand/github-social-preview.png`
- **App icons:** `apps/web/app/icon.png`, `apps/web/app/apple-icon.png`, `apps/web/app/opengraph-image.png`

**Rules:**

- Never redesign the logo. Never recreate the logo. Use the existing assets.
- Never recolor the logo. The purple and coral in the mark are the canonical brand colors.
- Never apply drop shadows, glows, or outlines to the logo. The logo is a flat mark.
- Minimum clear space around the logo: the height of the small heart/sparkle accent. Never less.
- Minimum size: 24px tall for the icon-only variant, 96px wide for the full wordmark. Below that, use the wordmark only.
- On dark backgrounds, use the dark-background variant of the logo. Do not invert the primary logo.
- The logo is always preceded or followed by a "®" or "™" symbol only when legally required. For the hackathon MVP, neither is required.

### 20.2 Sparkle and heart

The two small marks that appear within and around the logo — the **gold sparkle (✨)** and the **small heart (❤️)** — are part of the brand vocabulary. They are the only emojis permitted in any Kindred surface, and they are used as visual accents only:

- **Sparkle:** on milestone badges, on "Powered by Kindred Mind" footers, on the success state of any "you did it!" moment.
- **Heart:** on the brand wordmark divider, on anniversary insights, on the Kindred-Mind social signature.

Neither appears in body copy. Both appear only as visual decoration tied to a meaningful moment.

---

## 21. Token reference (for implementers)

A flat, copy-paste-ready reference of every token in this document, in the order they should appear in a Tailwind config, CSS variables file, or design token JSON.

```ts
// Colors
primary:        "#5B3CC4"   // Primary action, links, active states
secondary:      "#FF7A6B"   // Brand emphasis moment (one line per headline)
accent:         "#F6B73C"   // Sparkle, milestone markers (sparingly)
background:     "#FFFFFF"   // Default page background
surface:        "#F8F9FC"   // Side panels, table headers, secondary cards
border:         "#E5E7EB"   // Hairlines, card borders, input borders
textPrimary:    "#111827"   // Headings, body text
textSecondary:  "#6B7280"   // Captions, helper text
textMuted:      "#9CA3AF"   // Placeholders, disabled text
success:        "#22C55E"
warning:        "#F59E0B"
danger:         "#EF4444"
info:           "#3B82F6"

// Typography
fontFamily:     "Inter, system-ui, sans-serif"
fontMono:       "ui-monospace, SFMono-Regular, Menlo, monospace"
weightBold:     700
weightSemi:     600
weightMedium:   500
weightRegular:  400

// Spacing (4px base)
space1:  "4px"
space2:  "8px"
space3:  "12px"
space4:  "16px"
space6:  "24px"
space8:  "32px"
space12: "48px"
space16: "64px"
space24: "96px"

// Radius
radiusInput:    "14px"   // inputs + buttons
radiusCard:     "20px"   // cards
radiusContainer:"24px"   // modals, sheets, hero blocks
radiusPill:     "9999px" // badges, tags, avatars
radiusCode:     "8px"    // code blocks, table cells

// Shadows
shadowSm: "0 1px 2px rgba(0, 0, 0, 0.04)"
shadowMd: "0 4px 12px rgba(0, 0, 0, 0.05)"
shadowLg: "0 8px 30px rgba(0, 0, 0, 0.06)"
shadowXl: "0 16px 48px rgba(0, 0, 0, 0.08)"  // hero only
```

---

## 22. How to use this document

- **Before designing a screen:** read Sections 1 (personality), 11 (layout), 16 (UI principles), and 17/18 (dos/don'ts).
- **Before choosing a color, type size, or spacing value:** read Sections 2, 3, 4.
- **Before building a component:** read the section for that component (Sections 8–10).
- **Before adding a new token:** don't. Extend the existing scale first. If you can't, this document needs to be revised.
- **Before shipping a screen:** run the accessibility checklist in Section 13 and the responsive checklist in Section 14.

If a section of this document is missing something you need, raise it before designing around the gap. The document is meant to be **complete**, not a starting point.

---

*This is the official Design Foundation of Kindred Mind, Version 1.0. It becomes effective on merge to `main` and supersedes any prior visual decisions for the product.*
