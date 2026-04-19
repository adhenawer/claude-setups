# claude-share

**Share your Claude Code setup — safely.** Publish a descriptor of your plugins, MCP servers, and marketplaces to a community gallery; install someone else's setup with a single command.

> **Status:** 🚧 Very early. Research + design phase. See [docs/DESIGN.md](docs/DESIGN.md), [docs/SECURITY_PREMISE.md](docs/SECURITY_PREMISE.md), [docs/RISK_ANALYSIS.md](docs/RISK_ANALYSIS.md), and [docs/PRIOR_ART.md](docs/PRIOR_ART.md).

## Premise

Unlike a full backup/restore tool (see sibling project [claude-snapshot](https://github.com/adhenawer/claude-snapshot)), **claude-share never transmits configuration values**. It only shares the *names* of the things you have configured — plugin identifiers, MCP server commands (without `env`), marketplace sources, skill names.

This is **secure by construction, not by redaction**. No API key can leak because the tool never reads one.

## What gets shared — two artifacts

**1. Descriptor (always, safe by construction):**

- ✅ Plugin names + marketplace sources (e.g. `superpowers@claude-plugins-official`)
- ✅ MCP server identifiers + `command` + `args` + install method (`npm`/`pip`/`binary`/`manual`)
- ✅ Marketplace registrations (e.g. `github.com/owner/repo`)
- ✅ User-provided metadata: title, description, tags

**2. Setup bundle (opt-in, default OFF, user-curated):**

- ✅ Hook scripts — user approves each file one-by-one with content preview
- ✅ Global markdown files (`CLAUDE.md`, etc.) — user approves each file one-by-one
- Architecturally unreachable: `settings.json`, `~/.claude.json`, MCP `env` values. The bundle-building code has no branch that reads these.

## What NEVER gets shared

- ❌ `settings.env` (API keys, tokens, internal URLs) — unreachable by design
- ❌ `~/.claude.json` (OAuth tokens, project state) — unreachable by design
- ❌ MCP server `env` keys (tokens, database URLs) — unreachable by design
- ❌ Absolute filesystem paths (`/Users/you/...`) — the descriptor never contains paths; bundle files reference `$HOME` and apply on the mirror side

## Mirroring a shared setup

One command; the sender's env values never existed in the payload:

```bash
npx -y claude-share mirror https://claude-share.dev/s/abc123
```

The tool:

1. Runs `claude marketplace add`, `claude plugin install`, and `claude mcp add` for each descriptor identifier.
2. If a setup bundle is present, extracts approved hook scripts and `.md` files into `~/.claude/` with `.bak` backup on any conflict (same apply logic as claude-snapshot).
3. Prompts the recipient to supply their own env values for each MCP that needs them.

## Publishing

Primary path (recommended) — with the GitHub CLI:

```bash
npx -y claude-share publish                 # descriptor only
npx -y claude-share publish --with-bundle   # adds interactive file picker for hooks + .md
```

Fallback path (no `gh` CLI) — opens a browser to a prefilled GitHub Issue Form. Descriptor only; no bundle in this path.

Everything is GitHub-backed: no separate server, no account system beyond your GitHub account.

## Relation to claude-snapshot

| | [claude-snapshot](https://github.com/adhenawer/claude-snapshot) | claude-share |
|---|---|---|
| Unit of transfer | `.tar.gz` with full file contents (including `settings.json`, MCP env) | descriptor (always) + optional user-curated bundle (hooks + `.md` only) |
| Destination | private (your own machines) | public (community gallery) |
| Includes `settings.env` / MCP `env` / `.claude.json` | yes | **no, by construction** |
| Includes hooks / `CLAUDE.md` | yes, full | **only with per-file user approval** |
| Privacy model | local-only (no network) | secure-by-construction + per-file approval |
| Primary use case | backup, restore, multi-machine sync | discovery, showcase, one-command mirror |

Both tools can coexist. claude-snapshot is the personal "save state" for your own machines; claude-share is the "post to community" surface.

## Status

Active design, not yet implemented. Research and architectural premise are documented in [`docs/`](docs/). Implementation will reuse base utilities from claude-snapshot where applicable (see [`docs/DESIGN.md` § Base reuse](docs/DESIGN.md#base-reuse-from-claude-snapshot)).

## License

MIT
