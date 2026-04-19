# claude-setups v1 — Design Spec

> **Status:** Design locked. Ready for implementation planning.
> **Author:** Rodolfo Moraes (with AI-assisted brainstorming, 2026-04-19)
> **Scope:** v1 MVP — descriptor + optional reviewed bundle, GitHub-only hosting, CLI + Claude Code plugin.

## Goals

Build a community-facing mechanism for Claude Code users to **publish, discover, and mirror** complete setups — including the content that actually makes a setup interesting to share (hooks, `CLAUDE.md`, custom skills) — while making it **architecturally impossible** to leak the hard-secret categories (env values, OAuth tokens, `settings.json` contents).

**Who this is for:**

- A developer with a personal `~/.claude/` setup they want to showcase.
- A developer looking for inspiration / one-command install of somebody else's curated stack.
- A team onboarding new members who need the same Claude Code baseline.

**The gap this fills:** today people share setups via personal dotfile repos (no preview, no redaction, regular source of secret leaks), via individually-packaged plugins (heavyweight, requires git repo + marketplace setup), or via Reddit screenshots (not reproducible). Nothing exists that's simultaneously safe-by-default, content-rich, and one-command installable.

## Non-goals (v1)

- Private / allowlist-based sharing
- Upvotes, comments, social graph, following
- Real-time stats (install counts, view counts)
- Webhook APIs / third-party integrations
- Auto-packaging custom content as plugins
- Auto-submission to upstream awesome lists
- Any backend server beyond GitHub's native services

## Architecture

**GitHub is the only dependency.** No server, no database, no edge worker, no third-party service. Everything lives in a single public GitHub repo (working name: `adhenawer/claude-setups-registry`):

```
claude-setups-registry/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   └── setup-submission.yml      # structured form for browser fallback
│   └── workflows/
│       ├── ingest.yml                # on issue_opened: validate + commit + close
│       └── moderate.yml              # on issue_comment: handle `/report`
├── data/
│   ├── setups/
│   │   ├── <author>/<slug>.json      # latest version of each setup
│   │   └── <author>/<slug>/v/<n>.json  # historical versions
│   ├── bundles/
│   │   └── <author>/<slug>.tar.gz    # latest bundle (if any)
│   └── tag-aliases.yml               # server-side tag canonicalization map
├── site/                             # GitHub Pages static gallery
│   ├── index.html
│   ├── setup.html
│   └── ...
├── config/
│   └── gitleaks.toml                 # bundled gitleaks regex rules
├── package.json                      # the CLI is published from here
└── LICENSE                           # MIT
```

**Data flow:**

```
User runs `npx -y claude-setups publish`
  ├── CLI detects gh CLI; if absent, prompts user to install or use browser fallback
  ├── CLI reads plugins + marketplaces + MCP command/args (NOT env) from ~/.claude/
  ├── CLI reads candidate bundle files (hooks, *.md, skills/, commands/, agents/)
  ├── CLI runs gitleaks regex on every candidate file; surfaces matches
  ├── File-by-file preview with include/exclude toggle (default include)
  ├── Final preview: descriptor JSON + bundle file list + regex warnings
  ├── User types `publish` to confirm (typed word, not y/Enter)
  ├── CLI pushes bundle (if any) as commit to temp branch `bundle/<temp-id>`
  └── CLI creates issue via gh with descriptor in body + bundle branch reference
              ↓
Ingest Action (on issue_opened, label=setup:submission):
  ├── Validates descriptor schema
  ├── Validates bundle: no disallowed paths (settings.json, .claude.json, absolute paths, etc.)
  ├── Canonicalizes tags via tag-aliases.yml
  ├── Computes next version number for <author>/<slug>
  ├── Commits data/setups/<author>/<slug>.json + data/setups/<author>/<slug>/v/<n>.json
  ├── If bundle: moves tarball from temp branch to data/bundles/<author>/<slug>.tar.gz
  ├── Deletes temp branch
  ├── Closes issue with comment containing public URL
              ↓
GitHub Pages auto-rebuild on push to main → gallery reflects new entry
```

## Security model (two-layer)

### Layer 1: Architecturally unreachable (never transmitted)

The CLI has **no code path** that reads any of these:

- `~/.claude/settings.json` as a whole file
- `~/.claude.json` as a whole file
- `env` sections at any level (settings, mcpServers)
- `settings.hooks.*.command` strings

These categories are where the 39M secrets leaked on GitHub in 2024 live. The architectural guarantee is stronger than regex redaction: the code to read them does not exist. Adding such a code path is a security-critical review, not a flag toggle.

### Layer 2: User-reviewed (shared by default with mandatory preview)

The CLI CAN read (and by default includes) these:

- Hook scripts: `~/.claude/hooks/*.sh` (full contents)
- Global markdown: `~/.claude/CLAUDE.md`, other `~/.claude/*.md` at root
- Custom skills: `~/.claude/skills/*`
- Custom slash commands: `~/.claude/commands/*`
- Custom agents: `~/.claude/agents/*`

Mandatory pipeline for every file:

1. **Path canonicalization** — any absolute path inside the file is rewritten to `$HOME`-relative.
2. **gitleaks regex scan** — matches reported with line numbers + context.
3. **File-by-file preview** — CLI shows path, size, match count, first N lines (full viewable); asks `include? (Y/n)`.
4. **Final preview screen** — descriptor JSON + bundle file list + remaining regex warnings.
5. **Typed confirmation** — user must type `publish` literally. A single `y` or Enter is not enough.

Client-side-only regex scan is a known residual risk: a modified CLI could bypass it. Mitigated by (a) the moderation path below, and (b) the fact that bypass provides no benefit to the user doing the publishing — they WANT the scan to protect them. Attacker motivation for bypass is weak.

### Moderation (post-hoc)

- `/report` comment on the issue triggers the moderation workflow
- `REPORT_ADMIN` team receives a notification
- Manual review → if confirmed leak: cascade delete (descriptor + bundle + gallery rebuild) + notify author
- Documented at `docs/MODERATION.md` (to be written during implementation)

## Descriptor format

Served at `https://claude-setups.dev/s/<author>/<slug>.json`:

```json
{
  "schemaVersion": "1.0.0",
  "id": {
    "author": "alice",
    "slug": "python-supabase-fullstack"
  },
  "version": 3,
  "title": "Python + Supabase full-stack",
  "description": "My daily driver for Supabase-backed backend work in Python.",
  "tags": ["python", "supabase", "backend"],
  "author": {
    "handle": "alice",
    "url": "https://github.com/alice"
  },
  "createdAt": "2026-04-19T15:30:00Z",
  "license": "MIT",
  "plugins": [
    {
      "name": "superpowers",
      "marketplace": "claude-plugins-official",
      "version": "5.0.7"
    }
  ],
  "marketplaces": [
    {
      "name": "claude-plugins-official",
      "source": "github",
      "repo": "anthropics/claude-plugins-official"
    }
  ],
  "mcpServers": [
    {
      "name": "supabase",
      "command": "uvx",
      "args": ["mcp-server-supabase"],
      "method": "pip"
    }
  ],
  "specialties": ["backend", "data-engineer"],
  "bundle": {
    "present": true,
    "url": "https://claude-setups.dev/s/alice/python-supabase-fullstack/bundle.tar.gz",
    "sha256": "a1b2c3...",
    "files": [
      { "path": "hooks/auto-stage.sh", "size": 412, "sha256": "..." },
      { "path": "CLAUDE.md", "size": 3104, "sha256": "..." },
      { "path": "skills/pr-review/SKILL.md", "size": 1820, "sha256": "..." }
    ]
  }
}
```

**Specialty taxonomy (closed list):**

A setup declares 1–3 specialties from a canonical list. This drives gallery filtering and helps discovery.

```yaml
# data/specialties.yml (in the registry repo — authoritative source)
backend:          "Backend engineer"
frontend:         "Frontend engineer"
fullstack:        "Full-stack engineer"
mobile:           "Mobile (iOS / Android / RN)"
devops:           "DevOps / SRE / Platform"
data-engineer:    "Data engineering"
data-science:     "Data science / ML"
bi-analytics:     "BI / Analytics"
security:         "Security engineer"
qa-testing:       "QA / Testing / SDET"
ux-design:        "UX / UI design"
product:          "Product management"
technical-writing: "Technical writing / docs"
game-dev:         "Game development"
embedded:         "Embedded / firmware"
research:         "Research / academia"
other:            "Other (custom)"
```

New entries may be added via PR to the registry. The CLI bundles this list at build time; if a user picks an unknown key, the descriptor is rejected client-side and server-side.

**Validation rules** (enforced by ingest Action):

- `schemaVersion` matches supported major version (1.x for v1)
- `id.author` matches the GitHub handle of the issue author
- `id.slug` matches `^[a-z0-9][a-z0-9-]{2,49}$`
- `version` is next integer after the previous version for this `id` (or `1` for first publish)
- `specialties` is a non-empty array, 1–3 entries, all keys from `data/specialties.yml`
- `bundle.files[].path` has no `..`, no absolute paths, and starts with one of the allowed prefixes (`hooks/`, `skills/`, `commands/`, `agents/`) or is a root `*.md`
- `bundle.files[].sha256` matches the actual tarball content
- No `settings.json`, `settings.*`, `.claude.json` anywhere in `bundle.files`

**Tag canonicalization:** server-side, via `data/tag-aliases.yml`:

```yaml
py: python
JS: javascript
javascript: javascript  # normalized to lowercase
CC: claude-code
```

Unknown tags pass through unchanged.

## Versioning

Setup ID is stable: `{author, slug}`. Each republish under the same ID creates a new numbered version.

- Latest version at: `/s/<author>/<slug>.json`
- Historical version at: `/s/<author>/<slug>/v/<n>.json`
- Gallery default: shows latest; "History" toggle exposes prior versions
- Mirror URL without version: installs latest
- Mirror URL with `?v=<n>`: installs specific version

Author can `revoke <id>` to delete all versions + bundles for a given setup. Cascade to Pages rebuild.

## CLI surface

```bash
# Publish the current ~/.claude/ setup
npx -y claude-setups publish

# Mirror a published setup
npx -y claude-setups mirror <url-or-id>

# Open the gallery in browser
npx -y claude-setups browse

# Delete your own published setup (all versions + bundle)
npx -y claude-setups revoke <slug>
```

**Output convention:** pretty text on a TTY; single-line JSON when piped; `--json` flag forces JSON even on TTY. Same pattern as claude-snapshot 0.3.0.

**Also shipped as a Claude Code plugin** with equivalent slash commands: `/setups:publish`, `/setups:mirror`, `/setups:browse`, `/setups:revoke`.

## Publish flow (full detail)

**Primary path — `gh` CLI installed (recommended):**

1. Check `gh --version`. If absent, print install-or-fallback prompt; on fallback press Enter, continue to step 8.
2. Check `gh auth status`. If not authenticated, run `gh auth login`.
3. Collect descriptor sources:
   - Read `~/.claude/plugins/*` → user-scoped plugins + marketplaces
   - Read `~/.claude.json` `mcpServers` key only; extract `name + command + args`; never `env`
4. Collect bundle candidate sources:
   - `~/.claude/hooks/*.sh` (full content)
   - `~/.claude/*.md` at root (full content)
   - `~/.claude/skills/*` (directories, recursive)
   - `~/.claude/commands/*`
   - `~/.claude/agents/*`
5. Prompt user for metadata:
   - Title (required, 1–80 chars)
   - Description (required, 1–500 chars)
   - Tags (comma-separated, 1–10 tags)
   - Author handle (pre-filled from `gh api user`)
6. Run `gitleaks` regex on every candidate file. Collect matches with `file`, `line`, `rule`, `excerpt`.
7. Enter interactive file preview:
   - For each candidate, show `path`, `size`, `matches`, first 20 lines (press `v` for full content).
   - Ask `include? (Y/n)` — default Y.
   - Excluded files are not in the final bundle.
8. Show final preview screen:
   - Descriptor JSON (pretty-printed, syntax highlighted)
   - Bundle file list with sizes and total
   - Any remaining regex warnings the user chose to ignore
9. Ask: "Type `publish` to confirm."
10. On `publish`:
    - If bundle non-empty: push bundle tarball as a new branch `bundle/<temp-id>` to the registry repo via `gh api repos/.../git/refs`
    - Create issue via `gh issue create` with descriptor in body, label `setup:submission`, referencing the bundle branch if present
11. Ingest Action (see Architecture) processes the submission and closes the issue with a public URL comment.
12. CLI prints the public URL and the one-line mirror command.

**Fallback path — no `gh` CLI (user declines to install):**

1. CLI prints the fallback prompt.
2. CLI generates the descriptor locally (no bundle collection — browser submission can't push binaries cleanly).
3. CLI opens browser to prefilled Issue Form URL with descriptor JSON in a textarea.
4. User completes form in browser and submits.
5. Same ingest path, no bundle move.

## Mirror flow (full detail)

1. User runs `claude-setups mirror <url-or-id>`.
   - Accepts full URL (`https://claude-setups.dev/s/alice/python-supabase-fullstack`)
   - Or short ID (`alice/python-supabase-fullstack`)
2. CLI fetches `<url>.json`. Validates schema. If `bundle.present`, fetches `<url>/bundle.tar.gz` and verifies `sha256`.
3. CLI computes install plan:
   - Plugins: N in descriptor, X already locally installed at requested version (skip), Y new
   - Marketplaces: K in descriptor, J already registered (skip), L new
   - MCPs: M in descriptor, E already configured (skip), F new
   - Bundle files (if any): B files, C that would conflict with local (will back up to `.bak`)
   - MCPs needing env values: listed, with install-method hint
4. CLI shows plan. Asks: "Type `mirror` to confirm."
5. On `mirror`, execute in order:
   - Marketplaces: `claude marketplace add <source>` per new marketplace
   - Plugins: `claude plugin install <name>@<marketplace>` per new plugin
   - Bundle extraction: for each file in bundle, write to `~/.claude/<path>`, backing up existing to `<path>.bak` on conflict, `chmod +x` for files in `hooks/`
   - MCPs: `claude mcp add <name> <command> <args>` per new MCP; prompt for env values interactively, or leave placeholders
6. CLI reports per-step result and final summary. Re-running mirror is safe: idempotent pre-checks skip already-applied steps; already-extracted files (SHA-256 match) are skipped.

## Gallery (MVP)

Static site rendered at `https://claude-setups.dev`, served from the registry repo via GitHub Pages.

**Pages:**

- `/` — list of all setups, newest first; **specialty filter (primary)** + tag filter (secondary) + text search over title/description
- `/s/<author>/<slug>` — detail page: rendered descriptor + specialty badges + bundle file tree + one-line mirror command + "Report" button + history link
- `/s/<author>/<slug>/history` — prior versions
- `/<author>` — all setups by a given author

**Build:** a GitHub Action builds the static site from `data/` on every push to main. Site assets in `site/`. No client-side JS beyond search/filter.

**Explicitly NOT in v1:**
- Upvotes, comments, social graph
- Real-time install-count stats
- Login-gated browsing
- Third-party webhook API

## Base reuse from claude-snapshot

Directly reusable from the sibling project:

- `classifyMcpMethod()` — maps MCP commands to install-method identifiers
- Plugin filter for `scope: 'user'` — drops project-scoped plugins with absolute paths
- Tarball build/extract — `tar.create` on publish (bundle assembly), `tar.extract` on mirror
- `applySnapshot`-like write-with-`.bak` — for mirror-side bundle extraction
- Path normalization — `normalizePaths` and `resolvePaths` for `$HOME`-relative paths inside hook files
- `node:test` + no-transpile publish pattern
- `package.json` + `.gitignore` skeleton
- CI matrix (`.github/workflows/test.yml`), macOS + Linux × Node 18/20/22
- Pretty-vs-JSON output helper from snapshot 0.3.0

Not reused:

- `settings.json` / `.claude.json` reader — explicitly absent by design (the entire security story hinges on this)
- Full `~/.claude/` walk — the bundler only reads the allowlisted subdirectories

## Success criteria for v1 launch

- CLI installable via `npx -y claude-setups <cmd>` with zero external dependencies beyond `gh`
- Registry repo with Issue Forms, Actions, and a functional Pages site
- At least 10 test setups published through the full flow (including at least 3 with bundles > 20KB)
- `gitleaks` scan catches synthetic secrets in test fixtures with zero false negatives on the built-in rule set
- CI matrix green on macOS + Linux × Node 18/20/22
- Manual smoke test: publish on machine A → mirror on machine B with different username → everything installs correctly + `.bak` backups created for conflicts
- Public docs: README + DESIGN + SECURITY_PREMISE + RISK_ANALYSIS + MODERATION

## Implementation milestones (rough)

1. **Week 1:** scaffolding — package.json, CLI entry, descriptor collector (identifiers only), pretty output
2. **Week 2:** bundle builder (allowlisted dirs only), gitleaks regex integration, preview UX, typed-confirm publish via `gh` CLI
3. **Week 3:** ingest Action + repo storage schema + Pages static site baseline
4. **Week 4:** mirror flow (fetch + install + extract with `.bak`) + moderation workflow + test matrix + soft launch

## Open follow-ups (non-blocking)

- Rate limits for publish (v1 relies on GitHub's native limits)
- Awesome-list integration (deferred to post-v1 data)
- Custom-hook-to-plugin packaging helper (deferred; in v1 the bundle IS the sharing mechanism for custom hooks)

## References

- `../DESIGN.md` — running notes and full decision history
- `../SECURITY_PREMISE.md` — P1–P8 principles
- `../RISK_ANALYSIS.md` — per-field risk matrix
- `../PRIOR_ART.md` — competitive landscape and prior tools analyzed
- Sibling project: https://github.com/adhenawer/claude-snapshot
- gitleaks: https://github.com/gitleaks/gitleaks
