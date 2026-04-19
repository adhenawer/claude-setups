# Design (early draft)

> **Status:** Model locked — descriptor-only sharing ("setups composed of public building blocks"). No file contents ever transmitted, by construction. Hosting locked (GitHub-only). Publish UX locked (`gh` CLI primary, browser fallback). Mirror works via idempotent public-install commands. Not a final spec yet. Security premise is [locked](SECURITY_PREMISE.md).

## Product shape

**claude-setups** is a two-part product:

1. **CLI tool + Claude Code plugin** (npm package, distributable via `npx`, also installable as a Claude Code plugin) with commands `publish`, `mirror`, `browse`, `revoke`. Same underlying logic in both surfaces.
2. **Community gallery** — 100% GitHub-hosted: Issues for submission, a JSON tree in the repo for storage, GitHub Pages for rendering, GitHub Actions for validation + moderation glue. No other backend, no serverless, no external services.

## Architecture (locked)

**GitHub is the only dependency.** No server, no database, no edge worker, no third-party service. Everything lives in a single public GitHub repo (`adhenawer/claude-setups-registry` or similar):

```
claude-setups-registry/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   └── setup-submission.yml      # structured form fallback for no-gh users
│   └── workflows/
│       ├── ingest.yml                # on issue_opened: validate, commit to data/, close
│       └── moderate.yml              # on issue_comment: handle report flow
├── data/
│   └── setups/<slug>.json            # canonical descriptor per published setup
│                                     # (no bundles — descriptors are self-contained)
├── site/                             # GitHub Pages source (static gallery)
│   ├── index.html
│   ├── setup.html
│   └── ...
└── package.json (for the CLI — npm package also publishes from here)
```

Data flow:

```
npx claude-setups publish
  └─→ (primary) gh CLI → creates issue with descriptor body
  └─→ (fallback) opens browser to prefilled Issue Form URL; user submits manually

  ↓

Issue opened → Action validates descriptor → commits data/setups/<slug>.json
             → closes issue, comments with public URL
             → GitHub Pages auto-rebuilds gallery
```

**The descriptor is the only artifact.** No tarballs, no binary attachments, no file contents. A descriptor is a JSON file with plugin/marketplace/MCP identifiers and user metadata — nothing that the user wrote as content ever leaves their machine.

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
2. CLI reads ~/.claude/ for plugins + marketplaces, and ~/.claude.json for
   mcpServers (command + args only, never env).
3. CLI prompts inline (readline):
     "Title? Description? Tags (comma-separated)?"
     "Author handle?" (pre-filled from `gh api user`)
4. CLI shows the full descriptor JSON that will be uploaded. One screen.
   This is EXACTLY what goes public — no surprises.
5. CLI asks: "Publish? (y/n)"
6. On y, `gh issue create` with descriptor as body; issue has label
   `setup:submission`.
7. Action validates the descriptor schema, commits data/setups/<slug>.json,
   closes the issue with a comment containing the public URL.
8. CLI prints the public URL and the one-line mirror command for others.
```

**Fallback path — no `gh` CLI (user declines to install):**

```
1. CLI detects `gh` missing. Prints:
     "Best UX requires the GitHub CLI: https://cli.github.com.
      Install it for the scripted flow, or press Enter to continue with
      browser-based submission."
2. User presses Enter. CLI generates the descriptor locally.
3. CLI opens browser with a prefilled Issue Form URL targeting the registry
   repo. Metadata fields (title / description / tags) are blank; the
   descriptor JSON is pre-filled in a textarea.
4. User completes the form in the browser and submits.
5. Same Action path from step 7 above.
```

Both paths publish exactly the same artifact: a descriptor. No additional flags, no binary attachments, no per-file approval UX.

## Mirror flow

```
1. User runs `claude-setups mirror <url>`.
2. CLI fetches the descriptor JSON from <url>.
3. CLI shows the install plan:
     "This setup installs N plugins, M MCP servers, from K marketplaces."
     "Already installed locally: X plugins, Y MCPs. Will skip those (idempotent)."
     "New to install: A plugins, B MCPs."
     "MCPs needing env values after install: names listed, with empty-template guidance."
4. CLI asks: "Mirror? (y/n)"
5. On y, execute in order (idempotent pre-checks + sequential):
     a. For each marketplace: `claude marketplace add <source>` (skip if already present)
     b. For each plugin: `claude plugin install <name>@<marketplace>` (skip if already installed at requested version)
     c. For each MCP: `claude mcp add <name> <command> <args>`; after add,
        prompt user to supply env values interactively, or leave placeholders
        for the user to fill in their own ~/.claude.json later.
6. CLI reports per-step result (ok / already-present / failed) and a summary.
   On partial failure, the user can re-run mirror safely (each step is
   idempotent; already-applied steps are skipped).
```

## Idempotency + atomicity

- **Idempotency:** every Claude Code install command is idempotent. `plugin install X` when X is already installed is a no-op. Re-running mirror produces the same end state.
- **Atomicity:** mirror is sequential with pre-checks; on failure of any single step, the CLI reports clearly and stops (does NOT auto-rollback — that is its own class of risk). Because the flow is idempotent, the user fixes the underlying issue and re-runs; already-applied steps are skipped naturally.
- **Reproducibility:** each plugin entry in the descriptor includes an explicit `version`; mirroring 6 months later installs the same version the publisher exported, even if the plugin has evolved since.

## Setups are composed of public building blocks

The descriptor can only reference things that are **already publicly installable**:

- Plugins from public marketplaces (anyone can install without credentials)
- Marketplaces from public GitHub repos (anonymously cloneable)
- MCP servers whose `command` + `args` are runnable from public package registries (npm, PyPI, etc.) or public binaries

This is what makes the mirror flow safe-by-construction. Nothing private about the publisher's machine is referenced; everything in the descriptor is something a third party could have installed on their own by reading the identifiers.

**What about custom private hooks or a personal `CLAUDE.md`?** They don't travel in a descriptor. Users who want to share those customizations have a clean path: package them as a plugin (public, installable, versioned) and reference the plugin in the descriptor. The claude-setups ecosystem nudges users toward that hygiene rather than transmitting arbitrary file contents.

**Why this constraint is not a limitation but a feature:**

1. Zero risk of leaking secrets — there is no code path that reads files containing values.
2. Gallery entries are fast to render and fast to mirror.
3. Mirrors compose from the same ecosystem of public plugins the publisher used, reinforcing the marketplace network effect.
4. Custom work worth sharing is worth packaging properly.

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

- ✅ **Name:** `claude-setups` (npm package + GitHub repo + CLI binary). `claude-share` was taken on npm (tviles/claude-share, Gist-based); `claude-setups` reinforces the gallery-first positioning ("a collection of setups"). Tagline: *"Discover and share Claude Code setups — safely."*
- ✅ **Hosting:** GitHub-only. Issues for submission + Actions for validation + repo JSON tree for storage + Pages for gallery. No other backend.
- ✅ **Publish UX:** `gh` CLI primary; browser Issue Form as fallback when the user declines to install `gh`.
- ✅ **Artifact model:** descriptor-only. No tarballs, no binary attachments, no file contents transmitted. Shared setups are composed of public building blocks (plugins, marketplaces, MCPs).
- ✅ **Mirror command:** `claude-setups mirror <url>` — fetches descriptor, shows install plan with idempotent pre-checks, runs `claude marketplace add` + `claude plugin install` + `claude mcp add` sequentially.
- ✅ **Idempotency/atomicity:** each Claude Code install command is idempotent; mirror is sequential with pre-checks; partial failure is reported; re-running is safe.
- ✅ **Authentication:** GitHub-only (via `gh auth` for CLI, via issue attribution for browser fallback). No separate account system.

## Open questions

1. **Rate limits:** How many publishes per day per author? (abuse protection; GitHub's built-in rate limits + additional check in the ingest Action)
2. **Tag taxonomy:** Free-form or from a moderated list?
3. **Content moderation:** Email reports + `/report` issue comments. Any automated pre-publish scanning (flag `args` matching secret patterns)?
4. **Versioning:** If a user republishes an updated setup, is it a new ID or a version of the old one?
5. ~~**Naming:**~~ Resolved → `claude-setups` (see Resolved decisions).
6. **Relation to existing awesome lists:** Integrate (auto-submit to upstream) or compete?
7. **Discovery API:** Stable `/s/<id>.json` for machine consumption — yes (cheap, just serve the file from Pages).
8. **License on shared descriptors:** CC0, MIT, or something permissive-but-attribution?
9. **How to package custom hooks / CLAUDE.md as plugins:** documentation/tooling to help users elevate their personal customizations into shareable public plugins.

Resolve priority, biggest first:

1. **#9 packaging-as-plugin flow** — required for the "my setup has custom hooks" user story.
2. **#2, #3, #4 scope cuts** — YAGNI review of taxonomy, moderation, versioning.
3. **#7 discovery API** — quick confirm then move on.

## Base reuse from claude-snapshot

Directly reusable:

- `classifyMcpMethod()` — maps MCP commands to install-method identifiers for the descriptor.
- Plugin filter for `scope: 'user'` — drops project-scoped plugins that contain absolute paths.
- Node.js ESM + `node:test` + no-transpile publish pattern.
- `package.json` + `.gitignore` skeleton.
- CI matrix (`.github/workflows/test.yml`), macOS + Linux × Node 18/20/22.
- Pretty-vs-JSON output helper (`shouldOutputJson`, `writeOutput`) from snapshot 0.3.0.

NOT reused (scope doesn't apply to descriptor-only):

- Tarball build/extract pipeline — no tarballs in claude-setups.
- `applySnapshot`-like write-with-`.bak` logic — no file writing; mirror invokes `claude plugin install` etc. which manage their own state.
- Path normalization across user homes — no paths in a descriptor.
- `settings.json` / `.claude.json` read — the collector has no code path to read these files.
- Full `~/.claude/` capture — out of scope entirely.

## Next steps

1. Resolve open questions #1, #2, #7 (hosting, auth, naming) in continued brainstorming.
2. Once locked, write full design spec at `docs/superpowers/specs/<date>-claude-setups-v1-design.md` following the same pattern as claude-snapshot's design flow.
3. Scaffold the CLI crate: copy `package.json` skeleton + `classifyMcpMethod` from claude-snapshot, build out `publish` / `install` / `browse` / `revoke`.
4. Decide gallery stack + deploy a minimal read-only browse page.
5. Public launch post-security-review by an outside reviewer.
