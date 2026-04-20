# Handoff: claude-setups — Gallery & Setup Detail

## Overview

Front-end for **claude-setups**, a community registry where developers publish their Claude Code configurations (hooks, `CLAUDE.md`, skills, commands, agents, MCP servers, plugins) and others can browse and clone them with a single command.

The app has two views:

1. **Gallery (index)** — hero + search + specialty filter + card grid of published setups
2. **Setup detail** — overview (markdown), plugins, MCP servers, and a navigable bundle viewer with syntax-highlighted file preview

Routing is hash-based: `#/` → gallery, `#/setup/:slug` → detail.

## About the Design Files

The files in this bundle are **design references created in HTML** — React+Babel prototypes loaded in-browser at runtime. They are **not production code to copy directly**. The task is to recreate these designs in the target codebase's production environment (e.g. Next.js + React Server Components, plus static JSON from the registry) using its established patterns, build tooling, and component primitives. If the target app has no framework yet, Next.js (App Router) is the best match because the registry is already a static site on GitHub Pages.

## Fidelity

**High-fidelity.** Final colors, typography, spacing, layout, and interactions. Developers should recreate pixel-perfectly using the codebase's component libraries; use the exact tokens listed below.

## Screens / Views

### Screen 1 — Gallery (`#/`)

**Purpose.** Browse published community setups. Search by free text, filter by specialty, click a card to open the detail view.

**Layout.**

- Sticky top bar (18px vertical, 40px horizontal padding), semi-translucent background with `backdrop-filter: blur(14px)`, bottom `1px` border using `--line`.
- Hero section: max-width 1320px, 70px top padding, two-column grid `1.1fr 1fr` with 64px gap. Collapses to one column below 960px.
  - **Left column**: pill eyebrow ("registry público · N setups"), big hero title (`clamp(40px, 5.6vw, 76px)`, weight 700, letter-spacing `-0.035em`), subcopy (19px / line 1.55 / max-width 560px), CTA row with primary copy-command pill + ghost GitHub link.
  - **Right column**: `hero-visual`, a decorative stack of two overlapping "macOS-ish" cards (back rotated +4deg showing a `~/.claude/` tree; front rotated -3deg showing terminal output of `mirror` command, with blinking cursor).
- Gallery section: max-width 1320px. Toolbar row containing `SearchBar` (rounded, border, 320–440px) and `SpecialtyTabs` (rounded pill container with inner segmented tabs). Card grid below: `repeat(auto-fill, minmax(320px, 1fr))`, 20px gap.
- Footnote card at bottom: dashed border, flex row with CTA to `publish`.
- Footer: 32px padding, centered mono text, single top border.

**Card anatomy** (`SetupCard`).

- Padding `22px 22px 18px`, background `--bg-paper`, border `1px solid --line`, radius 16px, shadow `var(--card-shadow)`.
- Hover: lifts 4px, shadow expands to `--card-shadow-hover`, border → `--accent-soft`, a radial glow on the top edge fades in (`::before`, tracks mouse via `--mx`).
- Top row: avatar (36px, colored, first-letter monogram) + author name/handle (left) + specialty mono pill (right, `--bg-sunk` bg, 11.5px mono).
- Title: 22px / 600 / letter-spacing `-0.02em`.
- Description: 14px / 1.55 / clamped to 3 lines with `-webkit-line-clamp`.
- Tag row: `Badge` components, muted variant, mono 11.5px, `#tag` prefix.
- Stat row (top-bordered with dashed line): `StatPill`s for plugins ⚡ / MCPs ◉ / hooks ⚓ / skills ✦ with mono number + small label.
- Foot row: "{N} mirrors" (left) · "ver setup →" (right, accent-colored, shifts 4px right on card hover).
- Card is keyboard-focusable (`tabindex=0`), enter/click both open detail.

**Specialty tabs.** 7 tabs: Todos, Fullstack, Frontend, Mobile, DevOps, Data, Research. Active state: inverted — dark ink background, paper foreground. Shows a per-specialty count pill inside each tab.

**Search.** Simple string match against title + description + author + authorName + tags + specialty (joined, lowercased). Includes clear button when non-empty.

**Empty state.** Centered `∅` glyph, message, "limpar filtros" button.

### Screen 2 — Setup detail (`#/setup/:slug`)

**Purpose.** Show a single setup's full descriptor: overview, plugins, MCP servers, and bundle file contents. Prominently feature the `mirror` command.

**Layout.** Max-width 1080px, padding `28px 40px 80px`.

1. **Backlink pill** ("← voltar para a galeria"), ghost-styled.
2. **Hero** (`view-hero`): two-column grid `1fr 260px`, collapses below 860px.
   - **Left**: author row (52px avatar + name + "@handle · publicado em {date}" + GitHub ghost button), title (`clamp(34px, 4.5vw, 52px)` / 700 / letter-spacing `-0.03em`), description (17px / 1.55 / max-width 640px), tags row (filled specialty badge + muted tag badges), CTA row (big `CopyCmd` with `npx -y claude-setups mirror {author}/{slug}` + "N pessoas já clonaram" note).
   - **Right**: `view-stats-card` — a paper card with an uppercase mono title "no pacote" and a 2×2 grid of big accent-colored numbers over muted labels (plugins / MCPs / hooks / skills).
3. **Overview section** (optional, rendered only if `overview` is set). Markdown content inside a paper card, `max-width: 780px`, padding `28px 32px`, 15.5px / 1.65 line-height. Supports `#`–`####` headings, `-`/`*` bullets (accent dots), ordered lists, `inline code`, **bold**, _italic_, `` ```code blocks``` ``, `[links](url)`.
4. **Plugins section.** `plugin-row` per plugin: 4-col grid `24px 1fr auto auto` — icon (⚡, accent) · name (mono, 600) · version (`v1.2.3`, mono, muted) · source pill (`npm` / `marketplace:…`). Paper background, 1px border, radius 10px, 6px gap between rows.
5. **MCP servers section.** `mcp-row`: 2-col grid `180px 1fr`, collapses under 720px. Left: bullet (◉ accent) + server name. Right: mono command in a muted sunk pill that horizontally scrolls if needed.
6. **Bundle section.** Paper card, radius 16px, overflow hidden. Inner 2-col grid `260px 1fr`:
   - **File tree** (`filetree`): sunk-bg sidebar, 14/10 padding. Groups files by top-level directory (`hooks/`, `skills/`, `commands/`, `agents/`) with small directory labels showing file count; root-level files (`CLAUDE.md`) appear first without nesting. File rows are mono 12.5px; active file has accent background + white text. Hover shows a translucent accent wash.
   - **File viewer**: header strip (path + "N linhas" + uppercase kind pill) over a `<pre>` code block. Syntax highlighting: tokens for comments (ink-4, italic), keywords (accent, 600), variables (blue), strings (green) in shell; headings (accent, 700), inline code (sunk bg), list items, bold in markdown.

### Tweaks panel

Hidden by default; shown when the host activates edit mode via `postMessage({type:'__activate_edit_mode'})`. Floating card at bottom-right: 240px+ wide, paper bg, 1px border, radius 16px. Two segmented controls: theme (light/dark), aesthetic (playful/editorial). Values persist to `localStorage` under `claude-setups.tweaks` and post back to the host for on-disk write.

## Interactions & Behavior

- **Routing.** `hashchange` listener parses the URL; no history API — hash only, so it works on static hosting (GitHub Pages).
- **Card open.** Click or Enter → sets `location.hash = '/setup/' + slug`.
- **Copy command button.** `navigator.clipboard.writeText(cmd)`; on success the right-side label swaps to "copiado!" for 1600ms.
- **Specialty filter + search.** Both AND together. Filtering is synchronous over the in-memory array; no debounce needed at current sizes.
- **Theme toggle.** Flips `data-theme` on `<html>` between `light` and `dark`; CSS variables swap via the `html[data-theme="dark"]` scope. Persist in `localStorage`.
- **Aesthetic tweak.** `data-aesthetic` on `<html>` swaps `playful` (default, Space Grotesk sans) with `editorial` (Fraunces serif, smaller radii, no underline-highlight on the hero title).
- **Hero visual hover.** Each of the two cards lifts 4px and reduces its rotation on hover.
- **Card glow.** Radial `::before` pseudo that references a CSS var `--mx` — in the production version, wire a `mousemove` listener to set `--mx` to the cursor's X-% for a follow-the-mouse effect (currently falls back to center).
- **Smooth transitions.** 200–250ms ease on all hover states; 300ms on theme color changes.

### Animations

- `@keyframes pulse` on the hero eyebrow dot: scaling box-shadow out to transparent over 2s, infinite.
- `@keyframes blink` on the terminal cursor in the hero visual: opacity 50% step, 1.1s.
- Card hover: `transform: translateY(-4px)` with `cubic-bezier(.2,.8,.2,1)` easing at 220ms.
- Card open arrow: `translateX(4px)` on parent hover.

### Responsive

- **>= 960px**: two-column hero, full toolbar, 3–4 cards per row.
- **< 960px**: hero stacks, smaller outer padding (24px), cards 1–2 per row.
- **< 860px**: view-hero stacks; stats card moves below hero.
- **< 760px**: bundle collapses to single column — tree above, viewer below.
- **< 720px**: MCP row stacks name over command.

## State Management

Per-component React state (`useState`); no external library needed. The production implementation with RSC + client components can keep this exact shape.

- **`App`** (root): `route` (from hash parser), `theme` (`'light'|'dark'`), `aesthetic` (`'playful'|'editorial'`), `tweaksVisible` (bool). Listens for `hashchange` and `message` events.
- **`IndexPage`**: `query` (string), `specialty` (id). Memoized `counts` (per specialty) and `filtered` list.
- **`ViewPage`**: `activeFile` (path). Reset to `files[0].path` when `slug` changes; scroll to top.
- **`CopyCmd`**: `copied` (bool, auto-resets after 1600ms).

### Data fetching (production)

The real registry publishes static JSON (see the `claude-setups-registry` repo). Suggested approach:

- `GET /api/setups/index.json` — array of summaries (shape of each card).
- `GET /api/setups/{author}/{slug}.json` — full descriptor with overview, plugins, mcps, files.

With Next.js App Router, the gallery can be a server component reading the index at build time or via ISR; the detail page can `generateStaticParams` from the index. The only truly client-state is search + filter, which stays in a small client component.

## Design Tokens

### Colors — light theme (playful)

| Token | Hex |
|---|---|
| `--accent` | `#F97316` |
| `--accent-soft` | `#FDBA74` |
| `--accent-ink` | `#9A3412` |
| `--bg` | `#FFF8F1` |
| `--bg-paper` | `#FFFFFF` |
| `--bg-sunk` | `#FBF2E7` |
| `--ink` | `#1A1410` |
| `--ink-2` | `#3C322A` |
| `--ink-3` | `#6B5D52` |
| `--ink-4` | `#A4968A` |
| `--line` | `#EADFD1` |
| `--line-2` | `#F2E8DA` |

### Colors — dark theme (playful)

| Token | Hex |
|---|---|
| `--accent` | `#FB923C` |
| `--accent-soft` | `#9A3412` |
| `--accent-ink` | `#FED7AA` |
| `--bg` | `#141110` |
| `--bg-paper` | `#1C1917` |
| `--bg-sunk` | `#0F0D0C` |
| `--ink` | `#FAF4EC` |
| `--ink-2` | `#E6DDD1` |
| `--ink-3` | `#A39485` |
| `--ink-4` | `#6B6057` |
| `--line` | `#2A2420` |
| `--line-2` | `#221D19` |

### Radii

- `--radius` 16px (cards, bundle container, overview)
- `--radius-sm` 10px (plugin rows, file-tree buttons, small pills)
- `--radius-lg` 22px (reserved)
- Fully-round (`999px`): pills, buttons, badges, stats (some), topbar search

### Shadows

- `--card-shadow`: `0 1px 0 rgba(20,14,10,.04), 0 12px 28px -18px rgba(120,60,20,.16)`
- `--card-shadow-hover`: `0 2px 0 rgba(20,14,10,.05), 0 22px 40px -20px rgba(120,60,20,.28)`
- Dark versions use `rgba(0,0,0,.3/.35/.7/.85)` — see `styles.css`.

### Typography

- **Sans**: `"Space Grotesk"` (weights 400/500/600/700), via Google Fonts.
- **Mono**: `"JetBrains Mono"` (weights 400/500/600/700), via Google Fonts.
- **Serif** (editorial variant only): `"Fraunces"` (400/500/700, italic 500/700).
- Hero title: `clamp(40px, 5.6vw, 76px)` / 700 / letter-spacing `-0.035em`.
- View title: `clamp(34px, 4.5vw, 52px)` / 700 / letter-spacing `-0.03em`.
- Section H2: 22px / 600 / letter-spacing `-0.02em`.
- Card title: 22px / 600 / letter-spacing `-0.02em`.
- Body: 14–17px range; overview at 15.5px / 1.65.
- Mono captions: 11–13px, often lowercase, sometimes uppercase with `letter-spacing: .12em`.

### Spacing scale

Not a strict scale — uses idiomatic values. Common: 4, 6, 8, 10, 12, 14, 16, 20, 22, 24, 28, 32, 40, 64px. Page outer padding: 40px desktop / 24px mobile.

### Accent usage (editorial variant)

When `data-aesthetic="editorial"`, `--accent` collapses to ink (`#1A1410` light / `#FAF4EC` dark), radii shrink to 3–6px, fonts become Fraunces, title becomes italic 500, and the hero underline-highlight is replaced with a 2px ink underline.

## Data Model

The registry descriptor (matches `window.SETUPS_DATA` entries in `data/setups.js`):

```ts
type Setup = {
  slug: string;                  // URL slug
  title: string;
  description: string;           // 1–2 sentence card blurb
  overview?: string;             // markdown, up to 5000 chars
  author: string;                // handle / github login
  authorName: string;            // display name
  avatar: string;                // single-letter monogram
  avatarBg: string;              // hex color for the avatar disc
  specialty: 'fullstack' | 'frontend' | 'mobile' | 'devops' | 'data' | 'research';
  tags: string[];
  published: string;             // ISO date
  mirrors: number;               // clone count
  stats: { plugins: number; mcps: number; hooks: number; skills: number };
  plugins: { name: string; version: string; from: string }[];
  mcps:    { name: string; cmd: string }[];
  files:   { path: string; kind: 'md' | 'sh' | string; content: string }[];
};
```

The `overview` field is **optional markdown** (max 5000 chars) rendered by the lightweight parser in `ViewPage.jsx` (`renderMarkdown`). Production should swap it for a battle-tested renderer (e.g. `react-markdown` + `rehype-sanitize`, or `marked` server-side with DOMPurify) — the preview parser is intentionally minimal and not fully spec-compliant.

## Assets

- **Fonts**: Google Fonts (Space Grotesk, JetBrains Mono, Fraunces). In production, self-host or use `next/font`.
- **Logo**: CSS-drawn mark — a gradient orange square with `{·}` in mono. See the `Logo` component in `components/Primitives.jsx`. No external image assets.
- **Favicon**: inline SVG data URL in the `<link rel="icon">` tag of `index.html`.
- **Icons**: inline SVGs (search, sun, moon, GitHub, copy, file, folder, back) defined in the `Icons` object in `components/Primitives.jsx`. Unicode glyphs for stat icons (⚡ ◉ ⚓ ✦ → ∅). Free to replace with Lucide React in production — naming matches.
- **No raster images** anywhere.

## Files in This Bundle

- `index.html` — entry point with topbar, router, tweaks wiring, font loading. Uses React 18.3.1 + Babel Standalone 7.29.0 at runtime (not the production setup).
- `styles.css` — all styling, including tokens, components, and responsive rules.
- `data/setups.js` — six mock setup descriptors (replace with real registry API calls in production).
- `components/Primitives.jsx` — shared UI atoms: `Logo`, `Avatar`, `Badge`, `StatPill`, `CopyCmd`, `Icons`, `SPECIALTIES`.
- `components/IndexPage.jsx` — gallery: `Hero`, `HeroVisual`, `SearchBar`, `SpecialtyTabs`, `SetupCard`, `IndexPage`.
- `components/ViewPage.jsx` — detail: `renderMarkdown`, `highlight` (syntax), `FileTree`, `FileViewer`, `Section`, `ViewPage`.

## Implementation Notes

1. **Hash routing → real routing.** Replace `parseHash()` + `hashchange` with Next.js routing: `app/page.tsx` (gallery) and `app/setup/[author]/[slug]/page.tsx` (detail). Update `location.hash` writes to `<Link href>`.
2. **Markdown renderer.** Swap the mini-parser in `ViewPage.jsx` for `react-markdown` with a sanitizer; keep the existing `.md-*` CSS classes to preserve styling.
3. **Syntax highlighting.** The token-regex highlighter covers `sh` and `md` only. Swap for Shiki or `prism-react-renderer` and support the full range of file kinds a real bundle carries.
4. **Theme.** `data-theme` + CSS variables is already ideal; keep it. For SSR, compute the initial value from a cookie or fall back to a `prefers-color-scheme` script before hydration to avoid flash (the current inline `applyTweaks` IIFE is the same pattern — port it).
5. **Tweaks panel.** In production, strip the `postMessage` host-integration and expose theme via a normal settings menu instead. The `aesthetic` variant is a design-exploration tool; ship whichever aesthetic you pick and remove the toggle.
6. **Accessibility.** Cards have `tabIndex=0` + Enter handler; icon buttons have `aria-label`s; specialty tabs use `role="tablist"`/`role="tab"`/`aria-selected`. Keep these. Add skip-to-content link and ensure focus rings remain visible (current `:focus-visible` outlines use accent color).
7. **Performance.** Gallery is a read-heavy static list — ship as static HTML (SSG/ISR). Detail pages are per-slug static, safe for `generateStaticParams`. No client-side data fetching needed for the core UI.
