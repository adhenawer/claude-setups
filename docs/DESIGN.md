# Design (early draft)

> **Status:** Model locked — content-first sharing ("full setup including hooks, CLAUDE.md, skills; never env values or tokens"). Two-layer safety: architectural exclusion for secrets, user-reviewed preview for content. Hosting locked (GitHub-only). Publish UX locked (`gh` CLI primary, browser fallback). Mirror extracts content with `.bak` backup. Not a final spec yet. Security premise is [locked](SECURITY_PREMISE.md).

## Product shape

**claude-setups** is a two-part product:

1. **CLI tool + Claude Code plugin** (npm package, distributable via `npx`, also installable as a Claude Code plugin) with commands `publish`, `mirror`, `browse`, `revoke`. Same underlying logic in both surfaces.
2. **Community gallery** — 100% GitHub-hosted: Issues for submission, a JSON tree + bundle tarballs in the repo for storage, GitHub Pages for rendering, GitHub Actions for validation + moderation glue. No other backend, no serverless, no external services.

## Architecture (locked)

**GitHub is the only dependency.** No server, no database, no edge worker, no third-party service. Everything lives in a single public GitHub repo (`adhenawer/claude-setups-registry` or similar):

```
claude-setups-registry/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   └── setup-submission.yml      # structured form fallback for no-gh users
│   └── workflows/
│       ├── ingest.yml                # on issue_opened: validate descriptor + bundle, commit to data/, close
│       └── moderate.yml              # on issue_comment: handle report flow
├── data/
│   ├── setups/<slug>.json            # descriptor (plugins, marketplaces, MCPs, metadata)
│   └── bundles/<slug>.tar.gz         # content files: hooks, .md, skills, commands, agents
├── site/                             # GitHub Pages source (static gallery)
│   ├── index.html
│   ├── setup.html
│   └── ...
└── package.json (for the CLI — npm package also publishes from here)
```

Data flow:

```
npx claude-setups publish
  └─→ collects descriptor (identifiers) + candidate bundle files (hooks, .md, skills, ...)
  └─→ NEVER collects: settings.json, .claude.json, env values, MCP env
  └─→ runs secret-pattern regex on every candidate file
  └─→ file-by-file preview (default Y, user can exclude anything)
  └─→ user types `publish` to confirm
  └─→ (primary) gh CLI → creates issue with descriptor body + pushes bundle as commit to temp branch
  └─→ (fallback) opens browser to prefilled Issue Form URL; descriptor only (bundle requires gh CLI)

  ↓

Issue opened → Action validates descriptor schema + bundle contents (no disallowed paths/files)
             → commits data/setups/<slug>.json + (if present) moves bundle to data/bundles/<slug>.tar.gz
             → closes issue, comments with public URL
             → GitHub Pages auto-rebuilds gallery
```

**Two artifacts, per published setup:**

1. **Descriptor** (JSON) — plugins + marketplaces + MCP identifiers + user metadata. Always published.
2. **Bundle** (`.tar.gz`) — hook scripts, `.md` files, custom skills / commands / agents that passed the user-review step. Optional; if the user excluded every candidate file during preview, the bundle is empty and the setup is pure-descriptor.

The bundle never contains `settings.json`, `~/.claude.json`, MCP env, or any env value — those are architecturally unreachable by the bundler (see [SECURITY_PREMISE.md § P1](SECURITY_PREMISE.md)).

## Descriptor format (v1 draft)

The descriptor is served at a stable URL; the bundle (if any) is served at a sibling URL.

```json
{
  "schemaVersion": "1.0.0",
  "id": "server-assigned-slug",
  "title": "Python + Supabase full-stack",
  "description": "My daily driver for Supabase-backed backend work in Python.",
  "tags": ["python", "supabase", "backend"],
  "author": {
    "handle": "alice",
    "url": "https://github.com/alice"
  },
  "createdAt": "2026-04-19T15:30:00Z",
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
  "bundle": {
    "present": true,
    "url": "https://claude-setups.dev/s/abc123/bundle.tar.gz",
    "files": [
      { "path": "hooks/auto-stage.sh", "size": 412, "sha256": "..." },
      { "path": "CLAUDE.md", "size": 3104, "sha256": "..." },
      { "path": "skills/pr-review/SKILL.md", "size": 1820, "sha256": "..." }
    ]
  }
}
```

**Never in descriptor or bundle:** `env` values at any level, `settings.json`, `~/.claude.json`, `settings.hooks.*.command` strings, absolute filesystem paths (all paths in the bundle are relative to `~/.claude/`).

## CLI surface (v1 draft)

```bash
# Publish — detects gh CLI; uses it if present; falls back to browser otherwise
npx -y claude-setups publish

# Mirror — fetches descriptor, installs plugins + marketplaces + MCPs idempotently
npx -y claude-setups mirror https://claude-setups.dev/s/abc123

# Browse — opens gallery in default browser
npx -y claude-setups browse

# Revoke — closes/removes the user's own published setup by ID
npx -y claude-setups revoke abc123
```

All commands output pretty text on a TTY and JSON when piped (same pattern as claude-snapshot 0.3.0). Also installable as a Claude Code plugin with equivalent slash commands: `/setups:publish`, `/setups:mirror`, `/setups:browse`, `/setups:revoke`.

## Publish flow

**Primary path — `gh` CLI installed (recommended):**

```
1. CLI checks `gh --version`. Present → continue. Checks `gh auth status`; if
   not logged in, runs `gh auth login`.
2. CLI reads the DESCRIPTOR SOURCES:
     ~/.claude/ for plugins + marketplaces (identifiers only)
     ~/.claude.json for mcpServers (command + args only, never env)
3. CLI reads the BUNDLE CANDIDATE SOURCES (file paths + content):
     ~/.claude/hooks/*.sh
     ~/.claude/*.md at the root (CLAUDE.md, etc.)
     ~/.claude/skills/*  (if any)
     ~/.claude/commands/* (if any)
     ~/.claude/agents/*   (if any)
   NEVER reads: settings.json, ~/.claude.json as a whole, MCP env blocks,
   settings.hooks command strings, any absolute path (other than for stripping
   $HOME during path-relativization).
4. CLI prompts inline (readline):
     "Title? Description? Tags (comma-separated)?"
     "Author handle?" (pre-filled from `gh api user`)
5. CLI runs SECRET-PATTERN REGEX on every candidate file. Matches trigger
   warnings: "hooks/rtk.sh:12: looks like a token. Preview and edit before
   publish, or exclude this file."
6. CLI enters INTERACTIVE FILE PREVIEW:
     - For each candidate file, shows: path, size, regex-match count,
       first N lines of content (full content viewable by pressing 'v').
     - Asks: "include? (Y/n)" — default Y, user can exclude anything.
     - Excluded files are not in the final bundle.
7. CLI shows the FULL PREVIEW screen:
     - Descriptor JSON (what will be public)
     - Bundle file list with sizes (what will be extracted on mirror)
     - Total bundle size
     - Any remaining regex warnings the user chose to ignore
8. CLI asks: "Type `publish` to confirm." (a short y/Enter is NOT enough)
9. On `publish`:
     a. `gh issue create` with descriptor body + label `setup:submission`
     b. If bundle non-empty: push bundle as commit to a temp branch
        `bundle/<temp-id>` via `gh api repos/<owner>/<registry>/git`
        (binary-safe). Issue body references the bundle location.
10. Action validates descriptor schema + bundle structure (no disallowed
    files, no absolute paths, no settings.json at root, etc.), moves
    canonical files into data/setups/<slug>.json + data/bundles/<slug>.tar.gz,
    deletes the temp branch, closes the issue with a comment containing
    the public URL.
11. CLI prints the public URL and the one-line mirror command for others.
```

**Fallback path — no `gh` CLI (user declines to install):**

```
1. CLI detects `gh` missing. Prints:
     "Best UX requires the GitHub CLI: https://cli.github.com.
      Install it for the scripted flow (including bundle support), or
      press Enter to continue with browser-based submission (descriptor
      only — no bundle, since browser submission can't push binary
      attachments cleanly)."
2. User presses Enter. CLI generates the descriptor locally (no bundle
   collection in this path).
3. CLI opens browser with a prefilled Issue Form URL targeting the registry
   repo. Metadata fields (title/description/tags) are blank; the descriptor
   JSON is pre-filled in a textarea.
4. User completes the form in the browser and submits.
5. Same Action path from step 10 above (no bundle move; only descriptor).
```

Primary path publishes descriptor + bundle. Fallback path publishes descriptor only.

## Mirror flow

```
1. User runs `claude-setups mirror <url>`.
2. CLI fetches the descriptor JSON from <url>.
3. If descriptor.bundle.present, CLI fetches the bundle tarball.
4. CLI shows the install plan:
     "This setup installs N plugins, M MCP servers, from K marketplaces."
     "Bundle: B files totaling T KB — will extract into ~/.claude/."
     "Already installed locally: X plugins, Y MCPs. Will skip those (idempotent)."
     "New to install: A plugins, C MCPs, D files from bundle."
     "Conflicts: files named Z already exist — will be backed up as .bak."
     "MCPs needing env values after install: names listed."
5. CLI asks: "Type `mirror` to confirm." (typed word, not just y)
6. On `mirror`, execute in order (idempotent pre-checks + sequential):
     a. For each marketplace: `claude marketplace add <source>` (skip if present)
     b. For each plugin: `claude plugin install <name>@<marketplace>`
        (skip if already installed at the requested version)
     c. For each MCP: `claude mcp add <name> <command> <args>`; prompt user
        to supply env values interactively, or leave placeholders.
     d. If bundle present: extract files into ~/.claude/, with .bak backup
        on any conflict (reuses claude-snapshot's applySnapshot apply logic).
        Hook scripts are chmod +x after extraction.
7. CLI reports per-step result (ok / already-present / failed) and a summary.
   On partial failure, the user can re-run mirror safely (each step is
   idempotent; already-applied steps and already-extracted files are skipped
   based on sha256 match).
```

## Idempotency + atomicity

- **Idempotency:** every Claude Code install command is idempotent. `plugin install X` when X is already installed is a no-op. Re-running mirror produces the same end state.
- **Atomicity:** mirror is sequential with pre-checks; on failure of any single step, the CLI reports clearly and stops (does NOT auto-rollback — that is its own class of risk). Because the flow is idempotent, the user fixes the underlying issue and re-runs; already-applied steps are skipped naturally.
- **Reproducibility:** each plugin entry in the descriptor includes an explicit `version`; mirroring 6 months later installs the same version the publisher exported, even if the plugin has evolved since.

## What gets shared — two layers of safety

**Layer 1: Architecturally unreachable (never shared, not even by user request):**

- `settings.json` (full file) — contains `env`, hook command strings
- `~/.claude.json` (full file) — OAuth tokens, project state
- `env` sections of `settings.json` or `mcpServers.*` (any level)
- `settings.hooks.*.command` strings
- Absolute filesystem paths (stripped to `$HOME`-relative during bundling)

The tool has no code that reads these. They cannot leak even if the user asks.

**Layer 2: Reviewed content (shared by default, with mandatory preview):**

- Hook scripts (`~/.claude/hooks/*.sh`) — full file contents
- Global markdown (`~/.claude/CLAUDE.md`, `~/.claude/*.md` at root) — full contents
- Custom skills (`~/.claude/skills/*`)
- Custom slash commands (`~/.claude/commands/*`)
- Custom agents (`~/.claude/agents/*`)
- Descriptor identifiers (plugins, marketplaces, MCP name/command/args) + user-entered metadata

Every layer-2 file is shown to the user in the preview step, scanned by secret-pattern regex, toggleable per file, and publish is gated by a typed `publish` confirmation.

**The user-facing trade-off:** the product shares what makes a setup interesting to share (hooks, instructions, skills), while the architecturally-dangerous categories (secrets, tokens, OAuth) cannot travel even by mistake. The user accepts responsibility for the content they review-and-approve; the tool accepts responsibility for surfacing every piece before the publish becomes possible.

## GitHub primitives used

| Primitive | Role |
|---|---|
| Issues + Issue Forms | Submission inbox (structured YAML form; auto-labeled `setup:submission`) |
| `gh` CLI | Primary publish interface (authenticated; binary-safe push for bundles) |
| Actions | Ingest workflow: validates descriptor schema + bundle contents, commits to `data/`, closes issue. Moderation workflow: handles `/report` comment trigger |
| Repo `data/` tree | Canonical storage for descriptors + bundles |
| Pages | Static gallery generated from `data/setups/*.json` on every push |
| Issue comments | Report mechanism (`/report` comment triggers moderation workflow) |
| Reactions | 👍 / ❤️ serve as lightweight "I like this setup" signal (readable via API; gallery can show counts) |
| Releases | Optional: tag major versions of the registry schema itself |

## Gallery (MVP)

Minimum viable:

- List all published setups, newest first
- Filter by tag (AND semantics across selected tags)
- Search by title/description (full-text limited to those fields)
- Detail page per setup: rendered descriptor + one-line install command + "Report" button
- Author attribution with link to GitHub profile

Explicitly NOT in v1:

- Upvotes, favorites, comments, social graph
- Real-time stats (install counts)
- Private setups / allowlist sharing
- Integration webhooks / API tokens for third parties

## Security posture recap

Enforced by code structure + mandatory UX (see [SECURITY_PREMISE.md](SECURITY_PREMISE.md) for principles):

- Collector has NO code path reading `settings.json`, `~/.claude.json`, `env` values, or `settings.hooks.*.command`.
- Bundle builder can read hook bodies, `.md`, skills/commands/agents — but every file passes through user preview + regex scan before inclusion.
- Publish is gated by typed `publish` confirmation — no single-keystroke upload.
- Server-side Action validates descriptor schema + rejects bundles containing disallowed paths (e.g. `settings.json`, `.claude.json`, anything with an absolute path).
- Descriptors + bundles are publicly readable; DB row (repo commit) is author-owned so authors can delete.

## Resolved decisions

- ✅ **Name:** `claude-setups` (npm package + GitHub repo + CLI binary). `claude-share` was taken on npm (tviles/claude-share, Gist-based); `claude-setups` reinforces the gallery-first positioning ("a collection of setups"). Tagline: *"Discover and share Claude Code setups — safely."*
- ✅ **Hosting:** GitHub-only. Issues for submission + Actions for validation + repo JSON tree for storage + Pages for gallery. No other backend.
- ✅ **Publish UX:** `gh` CLI primary; browser Issue Form as fallback when the user declines to install `gh`.
- ✅ **Artifact model:** descriptor + optional bundle. Descriptor carries identifiers; bundle carries user-reviewed hook scripts, `.md` files, skills, commands, agents. `settings.json`, `~/.claude.json`, and env values are architecturally unreachable — not redacted, just never read.
- ✅ **Publish UX:** file-by-file preview mandatory + **gitleaks regex on each candidate** + typed `publish` to confirm. Default include = Y, user can exclude anything.
- ✅ **Bundle transport:** `gh` CLI pushes the bundle tarball as a commit to a temp branch `bundle/<temp-id>`; Action on issue_opened validates + moves to `data/bundles/<slug>.tar.gz` + deletes the temp branch. Single code path; no base64-in-body shortcut. Temp-branch approach handles any realistic bundle size.
- ✅ **Regex pattern set:** [gitleaks](https://github.com/gitleaks/gitleaks) TOML config (150+ detectors). Bundled as a data file in the CLI, ported to JS regex at startup. Upstream updates land via PR. Server-side Action runs the same rules as a double-check.
- ✅ **Mirror command:** `claude-setups mirror <url>` — fetches descriptor + bundle, shows plan, runs `claude marketplace add` + `claude plugin install` + `claude mcp add` + extracts bundle files with `.bak` backup on conflict.
- ✅ **Idempotency/atomicity:** each Claude Code install command is idempotent; mirror is sequential with pre-checks; partial failure is reported; re-running is safe.
- ✅ **Authentication:** GitHub-only (via `gh auth` for CLI, via issue attribution for browser fallback). No separate account system.

## Open questions

1. ~~**Bundle transport mechanics:**~~ Resolved → **commit to temp branch**. CLI pushes bundle to `bundle/<temp-id>` via `gh api repos/<owner>/<registry>/git/refs`; Action on issue_opened validates + moves tarball to `data/bundles/<slug>.tar.gz` + deletes the temp branch. Single code path; handles any bundle size up to GitHub's per-file limit (100MB, far above any realistic setup).
2. **Rate limits:** How many publishes per day per author? (abuse protection; GitHub's built-in rate limits + additional check in the ingest Action)
3. **Tag taxonomy:** Free-form or from a moderated list?
4. **Content moderation:** Email reports + `/report` issue comments. Server-side double-check with the same gitleaks pattern set as client-side, so manipulated-client attempts are caught at ingest.
5. **Versioning:** If a user republishes an updated setup, is it a new ID or a version of the old one?
6. ~~**Naming:**~~ Resolved → `claude-setups`.
7. **Relation to existing awesome lists:** Integrate (auto-submit to upstream) or compete?
8. **Discovery API:** Stable `/s/<id>.json` for machine consumption — yes (cheap, just serve the file from Pages). Same for `/s/<id>/bundle.tar.gz`.
9. **License on shared descriptors + bundles:** CC0, MIT, or something permissive-but-attribution?
10. ~~**Secret regex pattern set:**~~ Resolved → **gitleaks**. Use [gitleaks/config](https://github.com/gitleaks/gitleaks/blob/master/config/gitleaks.toml) (150+ community-curated detectors, TOML-configurable). Bundle the TOML as a data file in the CLI package; port to JS regex at startup; update by PR when upstream releases new patterns. Double-check server-side in the ingest Action using the same rules.

Resolve priority (remaining):

1. **#4 moderation pipeline + #10 server-side double-check** — biggest security lever left.
2. **#3, #5 scope cuts** — YAGNI review of taxonomy, versioning.
3. **#8 discovery API** — quick confirm then move on.
4. **#7 awesome-list integration** — strategic, can wait.
5. **#9 license** — pick one before launch.

## Base reuse from claude-snapshot

Heavily reusable — the content-first model overlaps with claude-snapshot's apply path significantly:

- `classifyMcpMethod()` — maps MCP commands to install-method identifiers for the descriptor.
- Plugin filter for `scope: 'user'` — drops project-scoped plugins that contain absolute paths.
- **Tarball build/extract** — `tar.create` on publish (bundle assembly from approved files), `tar.extract` on mirror.
- **`applySnapshot`-like write-with-`.bak`** — reused verbatim for mirror-side bundle extraction: write file, back up existing, chmod +x for hooks.
- **Path normalization** (`normalizePaths` with `$HOME`) — applied during bundle assembly so paths inside hook contents become `$HOME`-relative, then resolved on the mirror machine.
- Node.js ESM + `node:test` + no-transpile publish pattern.
- `package.json` + `.gitignore` skeleton.
- CI matrix (`.github/workflows/test.yml`), macOS + Linux × Node 18/20/22.
- Pretty-vs-JSON output helper (`shouldOutputJson`, `writeOutput`) from snapshot 0.3.0.

NOT reused (explicitly out of scope):

- `settings.json` / `.claude.json` read — claude-setups has no code path that reads these files, even though claude-snapshot does. This is the ONE place where the two tools deliberately diverge, and it's the entire security story of claude-setups.
- Full `~/.claude/` capture — the bundler reads only allowlisted subdirectories (`hooks/`, `skills/`, `commands/`, `agents/`) and the root `*.md` files; nothing else.

## Next steps

1. Resolve open questions #1, #2, #7 (hosting, auth, naming) in continued brainstorming.
2. Once locked, write full design spec at `docs/superpowers/specs/<date>-claude-setups-v1-design.md` following the same pattern as claude-snapshot's design flow.
3. Scaffold the CLI crate: copy `package.json` skeleton + `classifyMcpMethod` from claude-snapshot, build out `publish` / `install` / `browse` / `revoke`.
4. Decide gallery stack + deploy a minimal read-only browse page.
5. Public launch post-security-review by an outside reviewer.
