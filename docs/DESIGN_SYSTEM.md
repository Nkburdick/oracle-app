---
doc: DESIGN_SYSTEM
project: Oracle (Pennyworth front-end)
owner: Nick Burdick
status: Implementation-ready
target: Forge dispatch
stack: SvelteKit 2 + TypeScript + TailwindCSS 4 + shadcn-svelte
theme: Darkmatter (tweakcn)
font: Geist Mono (UI) / JetBrains Mono (code blocks only)
---

# Oracle Design System — Darkmatter

This document is the single source of truth for Oracle's visual language. A Forge agent should be able to read this doc end-to-end and implement the MVP Shell without guessing. Every color, size, radius, transition, and interaction rule is spelled out. When in doubt, the rule here wins over instinct — Darkmatter is opinionated and that opinion is the product.

The companion PRD is at `app/docs/PRD.md`. Read it for scope; read this for _how it looks and feels_.

---

## 1. Philosophy

Oracle is Nick's personal operations surface. It renders his ORACLE PARA repo (PROJECT.md / AREA.md files) as a living, navigable wiki. It is _not_ a consumer app, not a marketing site, not a CRM. It is a terminal for a single power user who wants his data to feel like `cat PROJECT.md` with a perfect typography pass on top.

**Three design commitments:**

1. **Warm copper on slate.** Darkmatter isn't grayscale — it's a restrained monochrome-leaning palette built around a single warm copper/terracotta accent (`#D87943`) on a slightly purple-tinted near-black (`oklch(0.1797 0.0043 308)`), with a muted teal/sage secondary (`#527575`). The copper is used sparingly: primary buttons, focus rings, active states, brand marks. Everything else is neutral. Restraint with one warm accent is the whole move.

2. **Monospace everywhere.** Geist Mono is the UI font at every size — headings, body, labels, buttons, metadata, everything. JetBrains Mono is permitted inside `<pre><code>` blocks only. This is a deliberate aesthetic choice: the grid regularity of monospace reinforces the terminal/developer vibe and forces the layout to breathe. Proportional fonts are forbidden.

3. **Borders over shadows.** Depth comes from 1px borders and background shifts, never from drop shadows. Cards are delineated by a `border` token, not by elevation. Hover is a luminance shift, not a lift. This keeps the UI flat, sharp, and legible at any zoom.

**What makes this distinctive (not gimmicky):** the terminal aesthetic is honored through typography and hierarchy, but the layout is modern app-shell — two-panel desktop (sidebar + main), bottom tab bar on mobile, shadcn-svelte components underneath. Section labels use `[BRACKETS]` as a wink to `ls`-style output, but we don't fake a CRT, don't add scanlines, don't animate a blinking cursor. The copper accent gives the UI warmth without sacrificing focus. Restraint is the point. If a design decision feels "cute", delete it.

---

## 2. Color Tokens

All colors are expressed in OKLCH. Tailwind 4 consumes them via CSS custom properties on `:root` and `.dark`.

### 2.1 CSS Custom Properties

Place in `src/app.css`:

```css
@import 'tailwindcss';

@custom-variant dark (&:where(.dark, .dark *));

:root {
	/* Light mode — Darkmatter (tweakcn) */
	--background: oklch(1 0 0);
	--foreground: oklch(0.2101 0.0318 264.6645);
	--card: oklch(1 0 0);
	--card-foreground: oklch(0.2101 0.0318 264.6645);
	--popover: oklch(1 0 0);
	--popover-foreground: oklch(0.2101 0.0318 264.6645);
	--primary: oklch(0.6716 0.1368 48.513); /* copper #D87943 */
	--primary-foreground: oklch(1 0 0);
	--secondary: oklch(0.536 0.0398 196.028); /* teal #527575 */
	--secondary-foreground: oklch(1 0 0);
	--muted: oklch(0.967 0.0029 264.5419);
	--muted-foreground: oklch(0.551 0.0234 264.3637);
	--accent: oklch(0.9491 0 0);
	--accent-foreground: oklch(0.2101 0.0318 264.6645);
	--destructive: oklch(0.6368 0.2078 25.3313);
	--destructive-foreground: oklch(0.9851 0 0);
	--border: oklch(0.9276 0.0058 264.5313);
	--input: oklch(0.9276 0.0058 264.5313);
	--ring: oklch(0.6716 0.1368 48.513); /* copper focus ring */
	--radius: 0.75rem;
}

.dark {
	/* Dark mode — Darkmatter (tweakcn) */
	--background: oklch(0.1797 0.0043 308.1928); /* slate-tinted near-black */
	--foreground: oklch(0.8109 0 0); /* warm off-white */
	--card: oklch(0.2101 0.0318 264.6645);
	--card-foreground: oklch(0.8109 0 0);
	--popover: oklch(0.2101 0.0318 264.6645);
	--popover-foreground: oklch(0.8109 0 0);
	--primary: oklch(0.7214 0.1337 49.9802); /* copper (lighter for dark mode) */
	--primary-foreground: oklch(0.1797 0.0043 308.1928);
	--secondary: oklch(0.594 0.0443 196.0233); /* teal (lighter for dark mode) */
	--secondary-foreground: oklch(0.9851 0 0);
	--muted: oklch(0.252 0 0);
	--muted-foreground: oklch(0.683 0 0);
	--accent: oklch(0.252 0 0);
	--accent-foreground: oklch(0.8109 0 0);
	--destructive: oklch(0.6368 0.2078 25.3313);
	--destructive-foreground: oklch(0.9851 0 0);
	--border: oklch(0.252 0 0);
	--input: oklch(0.252 0 0);
	--ring: oklch(0.7214 0.1337 49.9802); /* copper focus ring */
}

@theme inline {
	--color-background: var(--background);
	--color-foreground: var(--foreground);
	--color-card: var(--card);
	--color-card-foreground: var(--card-foreground);
	--color-popover: var(--popover);
	--color-popover-foreground: var(--popover-foreground);
	--color-primary: var(--primary);
	--color-primary-foreground: var(--primary-foreground);
	--color-secondary: var(--secondary);
	--color-secondary-foreground: var(--secondary-foreground);
	--color-muted: var(--muted);
	--color-muted-foreground: var(--muted-foreground);
	--color-accent: var(--accent);
	--color-accent-foreground: var(--accent-foreground);
	--color-destructive: var(--destructive);
	--color-destructive-foreground: var(--destructive-foreground);
	--color-border: var(--border);
	--color-input: var(--input);
	--color-ring: var(--ring);
	--radius-sm: calc(var(--radius) - 4px);
	--radius-md: calc(var(--radius) - 2px);
	--radius-lg: var(--radius);
	--radius-xl: calc(var(--radius) + 4px);
	--font-mono: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
	--font-code: 'JetBrains Mono', 'Geist Mono', ui-monospace, monospace;
}

html,
body {
	font-family: var(--font-mono);
	font-feature-settings: 'ss01', 'cv11';
}
code,
pre,
kbd,
samp {
	font-family: var(--font-code);
}
```

### 2.2 Token Reference (hex approximations)

| Token              | Dark hex  | Light hex | Notes                                |
| ------------------ | --------- | --------- | ------------------------------------ |
| background         | `#15141B` | `#FFFFFF` | Dark is slate-tinted, not pure black |
| foreground         | `#CECECE` | `#1E2238` | Dark fg is warm off-white            |
| card               | `#1E2238` | `#FFFFFF` |                                      |
| primary            | `#E28856` | `#D87943` | **COPPER** — the brand accent        |
| primary-foreground | `#15141B` | `#FFFFFF` |                                      |
| secondary          | `#6A9091` | `#527575` | **TEAL/SAGE** — used sparingly       |
| muted              | `#303030` | `#F4F3F5` |                                      |
| muted-foreground   | `#A8A8A8` | `#767A87` |                                      |
| accent             | `#303030` | `#EFEFEF` | Subtle neutral hover/pressed         |
| border             | `#303030` | `#EBEAED` |                                      |
| input              | `#303030` | `#EBEAED` |                                      |
| ring               | `#E28856` | `#D87943` | **COPPER focus ring**                |
| destructive        | `#DC2626` | `#DC2626` |                                      |

### 2.3 Accent Usage Rules

The copper (`primary`) and teal (`secondary`) are precious. Do not sprinkle them everywhere. Rules:

**Copper (`--primary` / #D87943):**

- Primary buttons (the "submit" / "save" / "create" action on any view — one per view maximum)
- Focus rings on inputs, buttons, and keyboard-focused elements
- Active route indicator in sidebar (left border 3px)
- Brand mark (the `[O]` logo)
- Progress bar fill
- Link underlines on hover (optional — muted copper, not full)

**Teal (`--secondary` / #527575):**

- Secondary buttons (outlined or subtle fill)
- Chart series 1 (when data viz arrives)
- Meta tags or badges that need to feel "cool" against warm copper
- NEVER used for the main CTA — copper owns that slot

**Never colored:** body text, borders, card backgrounds, icons in nav, checkboxes, status dots (see 2.4), destructive (uses `--destructive` red).

### 2.4 Status Semantics

Projects have four states. Encode them with _shape + luminance_, not hue — status colors stay neutral so the copper stays meaningful:

| State    | Glyph               | Color token        | Meaning                |
| -------- | ------------------- | ------------------ | ---------------------- |
| Active   | filled disc `●`     | `foreground`       | work happening now     |
| Planning | outlined circle `○` | `foreground`       | defined, not started   |
| Paused   | filled disc `●`     | `muted-foreground` | deferred               |
| Complete | checkmark `✓`       | `muted-foreground` | done, archived-ready   |
| Area     | outlined square `▢` | `muted-foreground` | ongoing, not a project |

Implement as 6px glyphs in the sidebar and 10px glyphs inline in headers. Never use `--destructive` for project state — red is reserved strictly for destructive confirm buttons. Never use `--primary` (copper) for status — that would dilute the accent's meaning as "the active CTA".

---

## 3. Typography

**Font family:** `Geist Mono` everywhere except `<code>` / `<pre>` which use `JetBrains Mono`. Load via `@fontsource-variable/geist-mono` and `@fontsource-variable/jetbrains-mono`.

**Global tracking:** `letter-spacing: 0em`. Darkmatter specifies zero tracking at every size. Do not tighten headings, do not loosen labels. The only exception: section labels (see below) which use `tracking: 0.08em` to compensate for uppercase.

**Font weights available:** Geist Mono Variable ships 100–900. Use only these four: `400` (body), `500` (emphasis), `600` (headings, labels), `700` (page titles only).

### 3.1 Type Scale

| Role                       | Size             | Line-height | Weight | Case              | Tailwind                                                |
| -------------------------- | ---------------- | ----------- | ------ | ----------------- | ------------------------------------------------------- |
| Display (page title h1)    | 28px / 1.75rem   | 1.2         | 700    | Sentence          | `text-[1.75rem] leading-[1.2] font-bold`                |
| Section title (h2)         | 20px / 1.25rem   | 1.3         | 600    | Sentence          | `text-xl leading-snug font-semibold`                    |
| Subsection (h3)            | 16px / 1rem      | 1.4         | 600    | Sentence          | `text-base font-semibold`                               |
| Body                       | 14px / 0.875rem  | 1.65        | 400    | Sentence          | `text-sm leading-relaxed`                               |
| Meta / small               | 12px / 0.75rem   | 1.5         | 400    | Sentence          | `text-xs`                                               |
| Section label `[BRACKETS]` | 11px / 0.6875rem | 1           | 600    | UPPERCASE + `[ ]` | `text-[11px] font-semibold uppercase tracking-[0.08em]` |
| Code (inline)              | 12.5px           | 1.5         | 400    | as-is             | `font-code text-[0.78rem]`                              |
| Code (block)               | 12.5px           | 1.6         | 400    | as-is             | `font-code text-[0.78rem]`                              |

**Why these sizes matter in monospace:** Geist Mono has wider advance width than a proportional font at the same point size. A 14px monospace body reads like ~15.5px Inter. Do not bump sizes up to "compensate" — the increased horizontal rhythm is the feature. Keep line lengths narrow: `max-w-[68ch]` for body content, never wider.

**Case rules — UPDATED 2026-04-06:**

The terminal aesthetic comes from **monospace + bracket labels + status glyphs**, not from forced lowercase. Use proper capitalization to keep the UI readable and softened.

- **Brand and headings: proper capitalization.** "Oracle" not "oracle". "Pennyworth" not "pennyworth". "Dashboard" not "dashboard". The H1 of a project page is "StrideMind AI", not "stridemind-ai".
- **UI labels and buttons: sentence case.** "Edit in GitHub", "New thread", "Send message". Not "edit in github" or "EDIT IN GITHUB".
- **Tab labels: proper case.** "Chats" / "Artifacts" / "SOW".
- **Section labels (the only UPPERCASE allowed): bracket-wrapped uppercase.** `[PROJECTS]`, `[AREAS]`, `[THREADS]`, `[KEY DECISIONS]`. The square brackets + uppercase signal "section header" in the terminal aesthetic.
- **Project/area slugs: lowercase + kebab-case** but ONLY when shown as identifiers (inside metadata cards, in URLs, in code blocks, in the small "slug:" line under a project title). When the project is referenced as a name in normal text, use the proper title from frontmatter ("StrideMind AI", not "stridemind-ai").
- **Sidebar items: show the title, not the slug.** The sidebar lists "StrideMind AI", "Pennyworth", "AptoForge", etc. — the human-readable titles. The slug is metadata, not the display name.
- **Code blocks, inline code, file paths, terminal commands: as-is.** Never modify case in code.

**Why this changed:** The original spec leaned heavily on lowercase everything for "developer feel", but it made the UI feel monotonous and harder to scan. The terminal aesthetic is carried by the monospace font + bracket labels + status glyphs + spacing — capitalization should follow normal conventions so things read naturally.

### 3.2 Visual weight handling

Monospace has heavier visual presence than proportional type. To keep the UI from feeling heavy:

- Body text uses `muted-foreground` (not `foreground`) by default. Reserve full-contrast `foreground` for headings, active nav items, and emphasized values.
- Avoid bolding inside body prose. Use italic for emphasis (`<em>`) or an inline code span. Bold inside a monospace paragraph shouts.
- Keep paragraph max width tight (68ch) and let whitespace do the work.

---

## 4. Spacing Scale

Base unit is **4px**. Use Tailwind's default scale (`space-1` = 4px, `space-2` = 8px, `space-3` = 12px, `space-4` = 16px, `space-6` = 24px, `space-8` = 32px, `space-12` = 48px). Do not invent arbitrary values except at the component edges documented below.

**Rhythm rules:**

- Section-to-section gap: `space-y-8` (32px)
- Heading-to-body gap: `space-y-3` (12px) for h3, `space-y-4` (16px) for h2
- List-item vertical gap: `space-y-1.5` (6px) for DoD checklists, `space-y-2` (8px) for prose bullets
- Card internal padding: `p-5` (20px) on desktop, `p-4` (16px) on mobile
- Sidebar row vertical padding: `py-1.5` (6px) — tight, because monospace rows are already tall
- Panel gutters: `px-8` (32px) desktop, `px-6` (24px) tablet, `px-4` (16px) mobile

---

## 5. Component Design Principles

All components are shadcn-svelte primitives restyled via the token layer above. Never fork a component's markup — extend through `class` props and variants.

### 5.1 Radius

`--radius: 0.75rem` (12px). Applied consistently:

- Cards, inputs, buttons, popovers: `rounded-lg` (10px)
- Small controls (checkbox, sidebar hover): `rounded-md` (8px)
- Tag chips: `rounded-sm` (6px)
- **Status badges (active/paused/planning/complete) — pill allowed:** `rounded-full` is permitted for the project state badge in headers because the pill shape reinforces the "label" semantic. This is an explicit carve-out. (Decided 2026-04-06)
- **Never** `rounded-full` on **buttons** or **inputs**. No pill buttons. No circular avatars (there are no avatars — single user).
- Status indicator dots in the sidebar are always circular (`rounded-full` on the 6px disc).

### 5.2 Borders

1px solid `border` token on every delineated surface. Borders must be visible in both modes — the token values above are tuned for this. If a card sits on `background` without a border, it disappears. Always border cards, inputs, the sidebar, and panel separators.

Never use `border-2`. Never use dashed or dotted borders except for drag-drop targets (not in MVP).

### 5.3 Elevation / shadow

**Near-zero shadows.** The only permitted shadow is on `popover` and `dropdown-menu` floating surfaces:

```css
box-shadow:
	0 1px 2px oklch(0 0 0 / 0.4),
	0 8px 24px oklch(0 0 0 / 0.24);
```

Dark mode only. In light mode, popovers use a stronger `border` and no shadow. Everywhere else: flat. Cards have no shadow. Modals have no shadow (they have a backdrop).

### 5.4 Hover states

Subtle luminance shift only. Never change hue. Never scale. Never lift.

- Sidebar row hover: `bg-muted` (dark: `#444`, light: `#F7F7F7`)
- Button hover: luminance shift of primary by ~5%
- Link / tab hover: text shifts from `muted-foreground` → `foreground`

All hovers transition in **120ms** with `ease-out`.

### 5.5 Focus rings

Focus uses the copper `--ring` token for an unmistakable 2px outline offset ring:

```css
:focus-visible {
	outline: 2px solid var(--ring);
	outline-offset: 2px;
	border-radius: inherit;
}
```

`--ring` is `oklch(0.556 0 0)` dark / `oklch(0.708 0 0)` light. Both pass 3:1 contrast against their backgrounds for non-text UI per WCAG 2.2 SC 1.4.11. Tailwind equivalent: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`.

Never remove focus rings. Never replace with a box-shadow glow (that's an accent-color idiom).

### 5.6 Selected / active states

The active sidebar row is the most important signal in the app. It uses three stacked cues:

1. Background shifts to `accent` (dark: `#5F5F5F`, light: `#F7F7F7`)
2. Text shifts from `muted-foreground` → `foreground`
3. A 2px left border in `foreground` color (`border-l-2 border-l-foreground`)

This triple-cue is legible even at low contrast settings and works without color.

### 5.7 Disabled states

`opacity-50 cursor-not-allowed pointer-events-none`. Do not re-color. Do not remove the border. The muted look is sufficient.

---

## 6. Key Component Specs

### 6.1 Sidebar

**Width:** `260px` desktop, collapsible drawer on mobile (`<640px`). Background: `background` (same as main — no contrast panel). Right border: 1px `border`.

**Structure:**

```
┌─────────────────────────────┐
│  oracle            [⌘K]     │  ← logo row, 56px tall, border-bottom
├─────────────────────────────┤
│  [search…]                  │  ← 12px padding, disabled in MVP
├─────────────────────────────┤
│  [PROJECTS]                 │  ← section label
│  ● pennyworth               │  ← active row
│  ● stridemind-ai            │
│  ○ aptoforge                │
│  ● psi-odoo-v19             │  ← paused (muted dot)
│  ✓ docubot                  │
│                             │
│  [AREAS]                    │
│  ▢ alfred                   │
│  ▢ psi-operations           │
└─────────────────────────────┘
                    [☀/☾]      ← theme toggle, footer
```

- Logo row: 56px tall, `px-5`, `font-bold text-base`, "Oracle" (proper case) with the `[O]` outlined-square brand mark icon to its left.
- Section label: `[PROJECTS]` in the exact format shown — square brackets included in the text node. `px-5 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground`.
- Row: `h-8 px-5 flex items-center gap-3 text-sm text-muted-foreground border-l-2 border-l-transparent`. On hover: `bg-muted text-foreground`. On active: `bg-accent text-foreground border-l-foreground`.
- Status glyph: 6px × 6px, rendered as inline SVG or a span with `rounded-full` (for discs) / `rounded-none` (for square). See section 6.3.
- Scroll: vertical only, thin 4px scrollbar styled with `bg-border`.
- Footer: theme toggle + settings icon, 48px tall, `border-t border-border`.

**Mobile drawer:** slides in from left, 85vw wide, max 320px. Backdrop is `bg-foreground/20 backdrop-blur-sm`. Close on backdrop click or Esc.

### 6.2 Project / Area Row

The atomic sidebar row. Props: `{ title, status, isActive, subtitle? }`. Note: shows the **title** (proper case from frontmatter) — never the slug.

```svelte
<a
	{href}
	class="group flex h-8 items-center gap-3 border-l-2 border-l-transparent
         px-5 text-sm text-muted-foreground transition-colors duration-[120ms]
         hover:bg-muted hover:text-foreground
         data-[active=true]:bg-accent data-[active=true]:text-foreground
         data-[active=true]:border-l-primary"
	data-active={isActive}
>
	<StatusIndicator {status} />
	<span class="truncate">{title}</span>
	{#if subtitle}
		<span class="ml-auto text-[11px] text-muted-foreground/70 truncate">
			{subtitle}
		</span>
	{/if}
</a>
```

Subtitle is optional (e.g., "Phase 3" or "Paused"). Never more than 12 characters or it wraps. **Active indicator uses copper** (`border-l-primary`) — this is the design system's nod that the sidebar's active state IS one of the few places copper appears as a navigation accent.

### 6.3 Status Indicator

```svelte
<script lang="ts">
	type Status = 'active' | 'planning' | 'paused' | 'complete' | 'area';
	export let status: Status;
</script>

{#if status === 'active'}
	<span class="h-1.5 w-1.5 rounded-full bg-foreground" aria-label="active" />
{:else if status === 'planning'}
	<span class="h-1.5 w-1.5 rounded-full border border-foreground" aria-label="planning" />
{:else if status === 'paused'}
	<span class="h-1.5 w-1.5 rounded-full bg-muted-foreground" aria-label="paused" />
{:else if status === 'complete'}
	<svg class="h-2 w-2 text-muted-foreground" viewBox="0 0 8 8"
		><path d="M1 4 L3 6 L7 1" stroke="currentColor" fill="none" stroke-width="1.5" /></svg
	>
{:else if status === 'area'}
	<span class="h-1.5 w-1.5 border border-muted-foreground" aria-label="area" />
{/if}
```

All glyphs are 6-8px. The `aria-label` is required for screen readers since shape alone is the signal.

### 6.4 Tab Bar (project detail) — UPDATED 2026-04-06

Three tabs: `Chats`, `Artifacts`, `SOW`. In MVP, only `SOW` is active — `Chats` shows the multi-thread layout with placeholder content (input disabled), `Artifacts` is a disabled placeholder.

```svelte
<nav class="flex border-b border-border" role="tablist">
	{#each tabs as tab}
		<button
			role="tab"
			aria-selected={activeTab === tab.id}
			aria-disabled={tab.disabled}
			class="px-5 py-3 text-sm font-medium text-muted-foreground
             border-b-2 border-b-transparent transition-colors duration-[120ms]
             hover:text-foreground
             aria-selected:text-foreground aria-selected:border-b-primary
             aria-disabled:opacity-40 aria-disabled:cursor-not-allowed
             aria-disabled:hover:text-muted-foreground"
		>
			{tab.label}
		</button>
	{/each}
</nav>
```

**Tab underline is `border-b-primary` (copper).** This is one of the few places copper appears as a navigation/state accent rather than a CTA. Reasoning: the active tab is the closest thing to "where you are right now" in the workspace, and the copper underline makes it instantly scannable. Sidebar active state also uses `border-l-primary` for the same reason. These two are the explicit carve-outs to the "copper = CTAs only" rule.

Tab bar height: 44px. Tab labels are sentence case (`Chats`, `Artifacts`, `SOW`) — never lowercase.

### 6.5 Metadata Card

Key-value grid at the top of project/area detail.

```svelte
<dl
	class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-lg border border-border
           bg-card p-5 text-sm"
>
	<dt class="text-muted-foreground">state</dt>
	<dd class="text-foreground">active</dd>
	<dt class="text-muted-foreground">owner</dt>
	<dd class="text-foreground">Nick Burdick</dd>
	<dt class="text-muted-foreground">created</dt>
	<dd class="text-foreground">2026-03-16</dd>
	<dt class="text-muted-foreground">repo</dt>
	<dd><code class="font-code text-xs">nkburdick/pennyworth</code></dd>
</dl>
```

- Labels in proper case (e.g., "State", "Owner", "Created"), muted color.
- Values in `foreground`.
- Repository/ID values wrapped in `<code>` with inline-code styling (see 8.5).
- Grid, not flex — aligns perfectly in monospace.
- No "State:" colon — the visual separation is the column gap.

### 6.6 Checkbox (for DoD markdown)

Rendered from `- [ ]` and `- [x]` markdown. Not interactive in MVP (read-only).

```svelte
<span
	class="inline-flex h-4 w-4 items-center justify-center rounded-sm border
             border-border bg-card
             data-[checked=true]:bg-foreground data-[checked=true]:border-foreground"
	data-checked={checked}
	role="checkbox"
	aria-checked={checked}
	aria-disabled="true"
>
	{#if checked}
		<svg class="h-2.5 w-2.5 text-background" viewBox="0 0 10 10">
			<path
				d="M1.5 5 L4 7.5 L8.5 2"
				stroke="currentColor"
				fill="none"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
	{/if}
</span>
```

Checked state: background = `foreground`, checkmark = `background` (full inversion). No color.

### 6.7 Theme Toggle

Two-state button in the sidebar footer. Icon only on desktop (sun/moon from lucide-svelte), icon + label on mobile settings page.

```svelte
<button
	class="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border
         bg-card text-muted-foreground transition-colors duration-[120ms]
         hover:bg-muted hover:text-foreground focus-visible:outline-2
         focus-visible:outline-offset-2 focus-visible:outline-ring"
	on:click={toggleTheme}
	aria-label="Toggle theme"
>
	{#if theme === 'dark'}
		<Sun class="h-4 w-4" />
	{:else}
		<Moon class="h-4 w-4" />
	{/if}
</button>
```

Theme persists to `localStorage.theme`. Initial value from `prefers-color-scheme`. Toggle adds/removes `.dark` class on `<html>`. No transition on the body — theme swap is instant (transitioning every token at once creates flicker). Individual hover transitions still work.

---

## 7. Layout Grids

### 7.1 Breakpoints

| Name | Min width | Layout                                             |
| ---- | --------- | -------------------------------------------------- |
| `sm` | <768px    | Single column, bottom tab bar (no sidebar)         |
| `md` | 768px+    | Two-panel: sidebar (240px) + main                  |
| `lg` | 1024px+   | Two-panel: sidebar (260px) + main, expanded center |
| `xl` | 1280px+   | Two-panel with wider main column                   |

**Updated 2026-04-06:** No three-panel breakpoint. The previously-planned right rail was removed. Layout is two-panel everywhere on tablet+, single column on mobile.

### 7.2 Panel widths

- **Sidebar:** 260px fixed at `lg+`. 240px at `md`. Hidden on `sm` (mobile uses bottom tab bar; sidebar accessible via drawer if implemented in Phase 2).
- **Main column:** flexible, `min-w-0` to allow text truncation. Inner content capped at `max-w-[68ch]` for prose, `max-w-4xl` for metadata/tables. Center content can expand to use the full available width since there's no right rail.

### 7.3 Page shell

```svelte
<div class="flex h-screen bg-background text-foreground font-mono">
	<Sidebar class="hidden md:flex" />
	<MobileDrawer class="md:hidden" />
	<main class="flex min-w-0 flex-1 flex-col overflow-hidden">
		<Header />
		<div class="flex-1 overflow-y-auto">
			<div class="mx-auto max-w-[68ch] px-4 py-8 md:px-8 md:py-12">
				<slot />
			</div>
		</div>
	</main>
</div>
```

---

## 8. Markdown Rendering

PROJECT.md and AREA.md are rendered into the main column. Use `mdsvex` (preferred — SvelteKit-native) or `marked` with a custom renderer. Apply this global prose style via a single class on the rendered container:

```svelte
<article class="oracle-prose">
	{@html renderedMarkdown}
</article>
```

### 8.1 Global prose rules

```css
.oracle-prose {
	font-family: var(--font-mono);
	font-size: 0.875rem;
	line-height: 1.65;
	color: var(--muted-foreground);
	max-width: 68ch;
}

.oracle-prose > * + * {
	margin-top: 1rem;
}
.oracle-prose > h1 + *,
.oracle-prose > h2 + *,
.oracle-prose > h3 + * {
	margin-top: 0.75rem;
}
```

### 8.2 Headings

- `h1`: 28px, 700, `foreground`, margin-top 0 (title is rendered outside the prose block)
- `h2`: 20px, 600, `foreground`, `mt-10 mb-4 pb-2 border-b border-border`
- `h3`: 16px, 600, `foreground`, `mt-6 mb-3`
- `h4`: 14px, 600, `muted-foreground`, `mt-4 mb-2` — use sparingly

H2 gets a bottom border; that's the only prose rule-line in the system.

### 8.3 Paragraphs and lists

- `p`: `text-sm leading-relaxed text-muted-foreground`
- `ul`: `list-none pl-0` — replace bullets with a leading `•` character rendered via `::before { content: '•'; color: var(--muted-foreground); margin-right: 0.75rem; }`. Standard bullet is universal and readable; Geist Mono renders it cleanly. (Decided 2026-04-06 — middle-dot rejected as too subtle.)
- `ol`: numeric, `list-decimal pl-6 marker:text-muted-foreground`
- Nested lists: `pl-5 mt-1`

### 8.4 Task lists (checkboxes)

GFM `- [ ]` / `- [x]` → rendered via the Checkbox component (6.6). Completed items dim to `muted-foreground/60` with no strikethrough — strikethrough on monospace looks broken.

### 8.5 Code — DECIDED 2026-04-06

**Inline code:**

```html
<code
	class="font-code rounded-sm border border-border bg-muted px-1.5 py-0.5 text-[0.78rem]"
></code>
```

Foreground color only — never use color for inline code.

**Code blocks: Shiki with paired muted themes (dark + light).**

```html
<pre
	class="font-code rounded-lg border border-border bg-card p-4 text-[0.78rem] leading-relaxed overflow-x-auto"
></pre>
```

**Shiki configuration:**

- **Dark mode theme:** `github-dark-dimmed` (preferred) or `vitesse-dark` as alternative
- **Light mode theme:** `github-light` or `vitesse-light` (must match the dark choice)
- **Theme switching:** configure Shiki with dual themes via `themes: { dark: 'github-dark-dimmed', light: 'github-light' }` and use the CSS variable approach (Shiki injects both color sets, switches via the parent `.dark` class)
- **Why dimmed themes:** they're already desaturated, won't clash with the copper accent. Avoid loud rainbow themes (Monokai, Dracula, Synthwave) — they break the Darkmatter restraint.
- **Languages to support out of the box:** `typescript`, `javascript`, `svelte`, `bash`, `json`, `yaml`, `markdown`, `css`, `html`. Lazy-load other grammars on demand.
- **Implementation library:** `shiki` v1.x with `@shikijs/markdown-it` if using markdown-it, or direct integration with `mdsvex`. Use the lightweight `createHighlighter` API to keep bundle size in check (only load grammars actually used).

**Why muted highlighting beats no highlighting:**

- Code blocks need readability when scanning docs with examples
- The dimmed/vitesse themes are quiet enough they don't compete with the copper accent
- Users get language affordance (you can tell TypeScript from Bash at a glance)
- Bundle cost is acceptable — Shiki tree-shakes well

### 8.6 Links — DECIDED 2026-04-06

Links use a conventional underline in `foreground` color by default, shifting to copper (`primary`) on hover. External links get a trailing `↗` arrow.

```css
.oracle-prose a {
	color: var(--foreground);
	text-decoration: underline;
	text-decoration-color: var(--border);
	text-decoration-thickness: 2px;
	text-underline-offset: 4px;
	transition:
		color 120ms ease,
		text-decoration-color 120ms ease;
}

.oracle-prose a:hover {
	color: var(--primary);
	text-decoration-color: var(--primary);
}

.oracle-prose a[href^='http']::after,
.oracle-prose a[href^='//']::after {
	content: ' ↗';
	font-size: 0.85em;
	opacity: 0.6;
}
```

**Tailwind utility version:**
`text-foreground underline decoration-border underline-offset-4 decoration-2 hover:text-primary hover:decoration-primary transition-colors duration-[120ms]`

**Why this approach:**

- Default state uses neutral foreground — links are clearly clickable but don't compete with copper CTAs
- Copper appears only on hover, preserving its meaning as "the primary action / interactive accent"
- The `↗` glyph after external links is a clear cue that the link leaves the app
- Internal links (relative paths like `/projects/foo`) don't get the arrow
- Accessible: underline + color shift + hover state all work for users who don't perceive color

### 8.7 Blockquotes

`border-l-2 border-l-border pl-4 italic text-muted-foreground/80`

### 8.8 Tables

```css
.oracle-prose table {
	width: 100%;
	border-collapse: collapse;
	border: 1px solid var(--border);
	border-radius: var(--radius);
	overflow: hidden;
	font-size: 0.8125rem;
}
.oracle-prose th {
	background: var(--muted);
	text-align: left;
	font-weight: 600;
	color: var(--foreground);
	padding: 0.625rem 0.875rem;
	border-bottom: 1px solid var(--border);
}
.oracle-prose td {
	padding: 0.625rem 0.875rem;
	border-bottom: 1px solid var(--border);
	color: var(--muted-foreground);
}
.oracle-prose tr:last-child td {
	border-bottom: none;
}
```

### 8.9 Horizontal rules

`<hr />` → `border-t border-border my-8`. Just one line, no ornament.

---

## 9. Interaction Details

**Transitions:** the only durations allowed are `120ms` (micro interactions: hover, focus) and `150ms` (larger state changes: drawer open/close, tab switch). Everything uses `ease-out`. Never `ease-in-out`. Never >150ms.

**Cursor states:**

- `cursor-pointer` on all interactive elements (buttons, links, sidebar rows, tabs)
- `cursor-not-allowed` on disabled elements
- `cursor-text` is default for prose (no override)
- Never `cursor-wait` — use a skeleton loader instead

**Keyboard navigation (MVP requirements):**

- Tab order follows DOM order, no `tabindex > 0`
- `Esc` closes the mobile drawer and any popover
- `⌘K` / `Ctrl+K` is reserved for the future search palette — in MVP, render the keybinding hint in the search input but the key does nothing
- Arrow keys navigate sidebar rows within a section (up/down), optional for MVP but wire it up if trivial

**Focus management:**

- When navigating to a new route, move focus to the page `<h1>` (use `tabindex="-1"` and `focus()` on mount)
- When opening the drawer, trap focus inside it; restore on close
- Skip-to-content link at the top of the body: visually hidden until focused, then jumps to main

**Scroll behavior:** `scroll-behavior: smooth` on the html element. Main column scroll position resets to top on route change.

---

## 10. Accessibility

**Contrast (WCAG 2.2 AA):**

- `foreground` on `background`: dark 17.9:1, light 17.9:1 — passes AAA
- `muted-foreground` on `background`: dark 5.74:1, light 5.74:1 — passes AA for body text
- `muted-foreground` on `card` (dark): 4.8:1 — passes AA for body text
- `ring` on `background`: 3.1:1 (dark), 3.0:1 (light) — passes AA for non-text UI (SC 1.4.11)

Re-verify these with an automated tool after implementation — they are calculated from OKLCH L values and should hold, but CI should run `pa11y` or `axe` on key routes.

**Never rely on color alone.** Status is already shape-encoded. Destructive actions must include both the red token _and_ a text label ("Delete", "Remove") — never a red icon alone.

**Geist Mono legibility:** monospace is intrinsically accessible for dyslexic readers. Enable OpenType `ss01` (alternate single-story `a`) and `cv11` (tabular figures) via `font-feature-settings`. Do not disable ligatures — Geist Mono's ligatures are subtle and helpful.

**Screen readers:**

- Sidebar: `<nav aria-label="Primary">`
- Sections within sidebar: `<section aria-labelledby="…">` with the `[PROJECTS]` label as the `<h2>` (sr-only visible prefix stripped)
- Status indicators: every glyph has `aria-label` (see 6.3)
- Tabs: `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`
- Skip link: mandatory

**Reduced motion:**

```css
@media (prefers-reduced-motion: reduce) {
	*,
	*::before,
	*::after {
		transition-duration: 0ms !important;
		animation-duration: 0ms !important;
	}
}
```

---

## 11. What NOT to Do (Anti-Patterns)

These are hard rules. Any implementation that violates them fails review.

1. **No colored accents beyond copper and teal.** The only hues in the system are `--primary` (copper #D87943), `--secondary` (teal/sage #527575), and `--destructive` (red, for destructive confirms only). No indigo, blue, green, yellow, purple, or other colors. If you find yourself reaching for a new color to signal "success" or "info", use a shape, weight, or position instead. Copper is reserved for _the primary action, focus, and active state_ — do not use it for status dots, icons, or decorative accents. Teal is secondary and used even more sparingly.
2. **No gradients.** The tweakcn Darkmatter mockups in `/Users/nicholasburdick/Downloads/oracle-mockup.html` use gradient logos and gradient progress bars — **do not copy those**. The mockup was authored before the Darkmatter direction was locked. Every gradient in that file is wrong.
3. **No heavy shadows.** Max is the popover shadow in 5.3. No `shadow-xl`, no `shadow-2xl`, no glow, no neon.
4. **No mixing fonts.** Geist Mono for UI, JetBrains Mono for code blocks. Nothing else. No Inter, no system-ui, no serif anywhere.
5. **No `rounded-full` on buttons or inputs.** No pill buttons, no circle avatars, no fully rounded inputs. **Carve-out:** status badges (active/paused/planning/complete) in headers may use `rounded-full` because the pill shape clearly signals "label". Status dots in the sidebar are always circular by definition.
6. **No hover scaling or lifts.** `hover:scale-105` is forbidden. `hover:shadow-lg` is forbidden. Luminance only.
7. **No loading spinners.** Skeleton loaders only (`bg-muted animate-pulse rounded-md`).
8. **No emoji in UI chrome.** Icons are lucide-svelte (monochrome line icons). Emoji are fine inside user-authored markdown prose because that's data, not UI.
9. **No Title Case** on headings, buttons, labels. Sentence case everywhere.
10. **No drop caps, no fancy list markers, no background images, no illustrations, no stickers.**
11. **No colored syntax highlighting.** See 8.5.
12. **No live animated backgrounds, no parallax, no particle effects, no scroll-jacking.** This is a tool, not a portfolio piece.
13. **No more than 150ms transitions.** Nothing should feel slow.
14. **No `box-shadow` for focus rings.** Use `outline` — it respects border-radius and doesn't shift layout.
15. **No `text-shadow` ever.**

---

## 12. Implementation Checklist (for Forge)

- [ ] Install `@fontsource-variable/geist-mono`, `@fontsource-variable/jetbrains-mono`, `lucide-svelte`
- [ ] Initialize shadcn-svelte and configure `components.json` with `baseColor: "neutral"`, `cssVariables: true`
- [ ] Populate `src/app.css` with tokens from section 2.1 verbatim
- [ ] Configure `html.dark` class strategy and theme persistence helper (`src/lib/theme.ts`)
- [ ] Build `Sidebar.svelte` per section 6.1
- [ ] Build `StatusIndicator.svelte` per section 6.3
- [ ] Build `Tabs.svelte` wrapper around shadcn-svelte tabs per section 6.4
- [ ] Build `MetadataCard.svelte` per section 6.5
- [ ] Build `Checkbox.svelte` (read-only) per section 6.6
- [ ] Build `ThemeToggle.svelte` per section 6.7
- [ ] Configure `mdsvex` (or marked) with the rendering rules from section 8
- [ ] Add global focus-visible and reduced-motion CSS from sections 5.5 and 10
- [ ] Run `pa11y` / `axe` against the dashboard, a project detail, and an area detail — no violations
- [ ] `svelte-check` passes with zero errors and zero warnings
- [ ] Visual sanity check in both modes at 320px, 768px, 1024px, 1440px widths

---

## Appendix A — Quick Reference

**Interactive element default classes:**

```
text-sm text-muted-foreground transition-colors duration-[120ms]
hover:text-foreground
focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
```

**Card default classes:**

```
rounded-lg border border-border bg-card p-5
```

**Section label default classes:**

```
text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground
```

**Main prose wrapper:**

```
mx-auto max-w-[68ch] px-4 py-8 md:px-8 md:py-12 oracle-prose
```
