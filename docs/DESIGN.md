# Design (early draft)

> **Status:** Initial draft. Hosting architecture locked (Approach A — GitHub-only). Publish UX locked (`gh` CLI primary, browser fallback). Bundle model locked (opt-in, default-off, user-curated). Several sub-questions still open. Not a final spec yet. Security premise is [locked](SECURITY_PREMISE.md).

## Product shape

**claude-share** is a two-part product:

1. **CLI tool** (npm package, distributable via `npx`, similar to claude-snapshot) with commands `publish`, `mirror`, `browse`, `revoke`.
2. **Community gallery** — 100% GitHub-hosted: Issues for submission, a JSON tree in the repo for storage, GitHub Pages for rendering, GitHub Actions for validation + moderation glue. No other backend, no serverless, no external services.

## Architecture (locked)

**GitHub is the only dependency.** No server, no database, no edge worker, no third-party service. Everything lives in a single public GitHub repo (`adhenawer/claude-share-registry` or similar):

```
claude-share-registry/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   └── setup-submission.yml      # structured form fallback for no-gh users
│   └── workflows/
│       ├── ingest.yml                # on issue_opened: validate, commit to data/, close
│       └── moderate.yml              # on issue_comment: handle report flow
├── data/
│   ├── setups/<slug>.json            # canonical descriptor per published setup
│   └── bundles/<slug>.tar.gz         # optional setup bundle (opt-in, see Bundle model)
├── site/                             # GitHub Pages source (static gallery)
│   ├── index.html
│   ├── setup.html
│   └── ...
└── package.json (for the CLI — npm package also publishes from here)
```

Data flow:

```
npx claude-share publish
  └─→ (primary) gh CLI → creates issue with descriptor body + bundle upload to data/bundles/<temp-id>.tar.gz via branch commit
  └─→ (fallback) opens browser to prefilled Issue Form URL; user submits manually

  ↓

Issue opened → Action validates → commits data/setups/<slug>.json (+ bundle if present)
             → closes issue, comments with URL
             → GitHub Pages auto-rebuilds gallery
```

## CLI surface (v1 draft)

## Descriptor format (v1 draft)

The unit of sharing. Stored as JSON, served at a stable URL.

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
  ]
}
```

**Not in descriptor:** `env` (any level), hook bodies, `CLAUDE.md` content, absolute paths.

## CLI surface (v1 draft)

```bash
# Publish — detects gh CLI; uses it if present; falls back to browser otherwise
npx -y claude-share publish
npx -y claude-share publish --with-bundle      # opt-in: include user-curated tar.gz

# Mirror — fetches descriptor (+ bundle if present), installs locally
npx -y claude-share mirror https://claude-share.dev/s/abc123

# Browse — opens gallery in default browser
npx -y claude-share browse

# Revoke — closes/removes the user's own published setup by ID
npx -y claude-share revoke abc123
```

All commands output pretty text on a TTY and JSON when piped (same pattern as claude-snapshot 0.3.0).

## Publish flow

**Primary path — `gh` CLI installed (recommended):**

```
1. CLI checks `gh --version`. Present → continue. Checks `gh auth status`; if
   not logged in, runs `gh auth login`.
2. CLI reads ~/.claude/ for plugins + marketplaces, and ~/.claude.json for
   mcpServers (command + args only, never env).
3. CLI prompts inline (readline):
     "Title? Description? Tags (comma-separated)?"
     "Author handle?" (pre-filled from `gh api user`)
     "Include setup bundle? (N/y)" — default No.
4. If bundle = yes, CLI enters interactive file picker:
     - Lists ~/.claude/hooks/*.sh and ~/.claude/*.md
     - For each: shows content preview + asks keep? (y/N)
     - Assembles selected files into data/bundles/<temp-id>.tar.gz
     - settings.json, .claude.json, and MCP env are NEVER offered; they are
       excluded by the architecture (not redacted — they're never read).
5. CLI shows the full preview: descriptor JSON + (if any) bundle file list
   with sizes. One screen.
6. CLI asks: "Publish? (y/n)"
7. On y:
     - If bundle: pushes tar.gz as a commit to a branch like
       `bundle/<temp-id>` via `gh api`/`git push` (or commits to a dedicated
       "pending-bundles" area the Action moves from).
     - `gh issue create` with descriptor as body; issue has label
       `setup:submission`; if bundle, body references the bundle location.
8. Action validates, moves canonical files into data/setups/ and
   data/bundles/, closes issue with a comment containing the public URL.
9. CLI prints the public URL and the one-line mirror command for others.
```

**Fallback path — no `gh` CLI (user declines to install):**

```
1. CLI detects `gh` missing. Prints:
     "Best UX requires the GitHub CLI: https://cli.github.com.
      Install it and re-run for the full publish flow (including bundle).
      Press Enter to continue with browser-based submission (no bundle)."
2. User presses Enter. CLI generates the descriptor.
3. CLI opens browser with a prefilled Issue Form URL targeting the registry
   repo. Metadata fields (title / description / tags) are blank; the
   descriptor JSON is pre-filled in a textarea.
4. User completes the form in the browser and submits.
5. Same Action path from step 8 above.
```

Bundle is **`gh`-only in v1.** Binary attachments to issues via browser form are possible but clunky (drag-drop, no preview of what's inside), and would bypass the CLI's file-picker/preview flow. v2 may revisit.

## Mirror flow

```
1. User runs `claude-share mirror <url>`.
2. CLI fetches the descriptor JSON from <url>.
3. CLI checks if a bundle is referenced in the descriptor metadata; if so,
   downloads it (expected: data/bundles/<slug>.tar.gz from the registry repo).
4. CLI shows the install plan:
     "This setup installs N plugins, M MCP servers, from K marketplaces."
     "Bundle present: X files totaling Y KB — will extract into ~/.claude/."
     "Y plugins already installed locally. Z are new. W MCPs need env values."
5. CLI shows per-file preview if bundle present — what will be written,
   and which existing files would be backed up as `.bak`.
6. CLI asks: "Mirror? (y/n)"
7. On y, execute in order:
     a. For each marketplace: `claude marketplace add <source>`
     b. For each plugin: `claude plugin install <name>@<marketplace>`
     c. If bundle: extract files into ~/.claude/, with .bak backup on
        conflicts (reuses claude-snapshot's applySnapshot apply logic).
     d. For each MCP: `claude mcp add <name> <command> <args>`, then prompts
        user to supply env values interactively, or writes placeholders they
        fill in their own ~/.claude.json later.
```

## Bundle model (opt-in, default-off)

A published setup has two artifacts:

1. **Descriptor** (always): JSON with identifiers (plugins, marketplaces, MCPs) + user metadata. Safe by construction — the CLI collector has no code path that reads values.
2. **Bundle** (opt-in): `.tar.gz` containing user-picked files. The CLI asks explicitly and enters a file picker. If the user declines, bundle is empty and the mirror falls back to identifier-only install.

**What may go in the bundle** (user-approved per file):

- Hook scripts (`~/.claude/hooks/*.sh`)
- Global markdown files (`~/.claude/CLAUDE.md`, other `*.md` at the root)

**What NEVER goes in the bundle**, even if asked:

- `settings.json` — contains `env` and hook `command` strings. The CLI has no code path that reads it into a bundleable form.
- `~/.claude.json` — contains OAuth tokens, project allowed-tools lists.
- MCP `env` sections — never read, never written.

Architectural enforcement (same pattern as the descriptor path): the bundle-building code only knows how to read files whose whole content is presentable-for-approval. It does not have a branch for "copy settings.json" or "copy .claude.json". Adding such a branch would be a security-critical code change, not a flag toggle.

**Mirror-side:** on `claude-share mirror`, if a bundle is present, files are extracted into `~/.claude/` with `.bak` backup on conflicts — the same apply logic as claude-snapshot's `applySnapshot`. The recipient sees a file-by-file preview of what will be written before confirming.

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

Enforced by code structure (see [SECURITY_PREMISE.md](SECURITY_PREMISE.md) for the principles):

- Collector has NO code path reading `env`, hook bodies, or `.md` content.
- Publish step shows descriptor pre-upload, requires explicit `y`.
- API schema validates only the allowed fields; extra fields are silently dropped server-side.
- Descriptors are publicly readable; the DB row is author-owned so authors can delete.

## Resolved decisions

- ✅ **Hosting:** GitHub-only (Approach A from the hosting evaluation). Issues for submission + Actions for validation + repo JSON tree for storage + Pages for gallery. No other backend.
- ✅ **Publish UX:** `gh` CLI primary (full flow including bundle); browser Issue Form as fallback when the user declines to install `gh` (descriptor only, no bundle).
- ✅ **Bundle model:** opt-in (`--with-bundle` flag or interactive prompt); default off; user-curated per file; architecturally incapable of including `settings.json`, `.claude.json`, or MCP `env`.
- ✅ **Mirror command:** `claude-share mirror <url>` — fetches descriptor (+ bundle if present), shows diff, installs plugins/MCPs/marketplaces, extracts bundle files with `.bak` backup on conflict.
- ✅ **Authentication:** GitHub-only (via `gh auth` for CLI, via issue attribution for browser fallback). No separate account system.

## Open questions

1. **Bundle transport in practice:** `gh` CLI doesn't natively attach binary files to issues via API. Options: commit to a short-lived branch and reference in issue body (clean); base64-encode into issue body (works for small bundles only, <~50KB gzipped); GitHub Releases (heavyweight). Pick one.
2. **Rate limits:** How many publishes per day per author? (abuse protection; GitHub's built-in rate limits + additional check in the ingest Action)
3. **Tag taxonomy:** Free-form or from a moderated list?
4. **Content moderation:** Email reports + `/report` issue comments. Any automated pre-publish scanning (flag `args` matching secret patterns)? — v1 scope.
5. **Versioning:** If a user republishes an updated setup, is it a new ID or a version of the old one?
6. **Naming:** Keep `claude-share`? Or something more evocative? (`claudehub`, `showcc`, etc.)
7. **Relation to existing awesome lists:** Integrate (auto-submit to upstream) or compete?
8. **Discovery API:** Stable `/s/<id>.json` for machine consumption — yes (cheap, just serve the file from Pages).
9. **License on shared descriptors:** CC0, MIT, or something permissive-but-attribution?

Resolve priority, biggest first:

1. **#1 bundle transport** — affects implementation of both publish and mirror.
2. **#6 naming** — needed before anything public.
3. **#3, #4, #5 scope cuts** — YAGNI review of taxonomy, moderation, versioning.

## Base reuse from claude-snapshot

Directly reusable:

- `classifyMcpMethod()` — maps MCP commands to install-method identifiers for the descriptor.
- Plugin filter for `scope: 'user'` — drops project-scoped plugins that contain absolute paths.
- **Tarball build/extract pipeline** — reused verbatim for the opt-in bundle: `tar.create` on publish, `tar.extract` on mirror.
- **`applySnapshot`-like write-with-`.bak` logic** — reused verbatim for mirror-side bundle extraction.
- Node.js ESM + `node:test` + no-transpile publish pattern.
- `package.json` + `.gitignore` skeleton.
- CI matrix (`.github/workflows/test.yml`), macOS + Linux × Node 18/20/22.
- Pretty-vs-JSON output helper (`shouldOutputJson`, `writeOutput`) from snapshot 0.3.0.

NOT reused:

- Path normalization across user homes — the bundle extracts into the recipient's `~/.claude/` by relative path; no `$HOME` rewriting needed (we don't transmit hook command strings in `settings.json` — only hook FILE contents, which reference `$HOME` and just work).
- `.claude.json` env read — the collector intentionally has no code path to read env.
- Full `~/.claude/` capture — scope is deliberately narrower (hooks + `.md`, user-approved).

## Next steps

1. Resolve open questions #1, #2, #7 (hosting, auth, naming) in continued brainstorming.
2. Once locked, write full design spec at `docs/superpowers/specs/<date>-claude-share-v1-design.md` following the same pattern as claude-snapshot's design flow.
3. Scaffold the CLI crate: copy `package.json` skeleton + `classifyMcpMethod` from claude-snapshot, build out `publish` / `install` / `browse` / `revoke`.
4. Decide gallery stack + deploy a minimal read-only browse page.
5. Public launch post-security-review by an outside reviewer.
