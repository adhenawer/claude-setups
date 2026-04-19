# claude-setups

**Discover and share Claude Code setups — the full thing: hooks, instructions, skills. Never your secrets.** Publish your setup to a community gallery; mirror someone else's with a single command. Env values, OAuth tokens, and `settings.json` are architecturally unreachable — the tool cannot transmit them, even by mistake.

> **Status:** v0.2.0 — publish + mirror + revoke are live. Bundles (hooks, CLAUDE.md, skills) ship in v0.3 (see [roadmap](docs/superpowers/specs/2026-04-19-claude-setups-v1-design.md)).

## Premise

Sharing a Claude Code setup today means dumping your `~/.claude/` into a public GitHub repo with zero review — exactly how the industry leaked **39 million secrets on GitHub in 2024**. Plugin marketplaces solve part of it, but only for things you already packaged as plugins. Your custom hooks, your carefully-tuned `CLAUDE.md`, your personal skills — those still live in raw files.

**claude-setups** splits the problem into two architectural layers:

1. **Values and tokens are architecturally unreachable.** `settings.json`, `~/.claude.json`, every `env` section, MCP tokens — the tool has no code path that reads them. They cannot travel.
2. **Content files (hooks, `CLAUDE.md`, skills) ARE shared** — but only after you see every file, run secret-regex scans, and type `publish` to confirm.

This is not redaction. It's a hard split between "architecturally cannot leak" and "you reviewed it and approved".

## Is this safe to run?

The goal of this section is to remove every reason to be afraid of clicking publish.

### What the tool CAN read and may share

Only these, and only after you see each one in a preview screen:

- **Plugin + marketplace identifiers** from `~/.claude/plugins/*` — plugin names, marketplace sources, versions. Public info; anyone can install the same plugins themselves.
- **MCP server name + `command` + `args`** from `~/.claude.json`'s `mcpServers` key — **never `env`**.
- **Hook scripts** (`~/.claude/hooks/*.sh`) — file contents, shown fully in preview before include/exclude.
- **Global markdown** (`~/.claude/CLAUDE.md`, other `*.md` at the root) — shown fully in preview.
- **Custom skills / commands / agents** (`~/.claude/skills/*`, `commands/*`, `agents/*`) — shown fully in preview.
- **The title, description, and tags you type** at the publish prompt.

Every file is:
1. Shown to you with size, path, and content preview.
2. Scanned by a **secret-pattern regex** (API keys, bearer tokens, private keys). Any match is flagged with line numbers. You can edit the file and re-run, or exclude it.
3. Toggleable per-file: default `include = yes`, you can press `n` to exclude any file.
4. Summarized in a final preview screen before publish.
5. Gated behind typing the word `publish` — a single `y` is not enough. The typed word is deliberate friction so nobody uploads on autopilot.

### What the tool CANNOT read (ever, even if you asked it to)

- ❌ `~/.claude/settings.json` — contains `env` (API keys), hook `command` strings. **No code path exists to read this file.**
- ❌ `~/.claude.json` — contains OAuth tokens, project state. **No code path exists to read this file.**
- ❌ `env` sections of `mcpServers.*` — service tokens, database URLs. **No code path exists to read these.**
- ❌ `settings.hooks.*.command` strings (different from hook script files) — can inline tokens. **No code path exists to read these.**
- ❌ Absolute filesystem paths inside any file — the bundler strips `$HOME` during assembly; the descriptor format has no field where an absolute path could appear.

These are **security by construction, not by redaction**. GitHub's industrial-grade regex scanners missed 39M secrets in 2024 — a small project cannot win by regex alone. So we don't try: the dangerous categories live in code paths that don't exist. Adding one would be a security-critical PR, reviewed as such.

## How mirroring works

One command; the sender's secrets never existed in the payload to begin with, and hook/`.md` files arrive with `.bak` backup on any conflict:

```bash
# Short form (resolves against the default registry)
npx -y claude-setups mirror alice/demo-setup

# Full URL form
npx -y claude-setups mirror https://adhenawer.github.io/claude-setups-registry/s/alice/demo-setup.json
```

The tool:

1. Fetches the descriptor JSON + (if any) the bundle `.tar.gz` from the URL.
2. Shows the full install plan: plugins, MCPs, marketplaces, bundle files — with local-vs-incoming diff and per-file conflict preview.
3. You type `mirror` to confirm.
4. Installs identifiers idempotently: `claude marketplace add`, `claude plugin install`, `claude mcp add` (skipping anything already present at the requested version).
5. Extracts bundle files into `~/.claude/`, backing up any existing file as `<name>.bak` before overwriting. Hook scripts get `chmod +x`.
6. Prompts you to supply your own env values for each MCP that needs them (the sender never sent any).

**Idempotent:** re-running mirror on the same URL is safe. Already-installed plugins and already-extracted files (detected by SHA-256) are skipped.

**Reproducible:** descriptor freezes each plugin's exact version, so mirroring months later installs the same versions the publisher exported.

## How publishing works

Primary path (recommended) — with the [GitHub CLI](https://cli.github.com):

```bash
npx -y claude-setups publish
```

The tool walks you through: read sources → enter metadata → see secret-regex warnings → file-by-file include/exclude → final preview → type `publish`. Creates a GitHub issue on the registry repo; a GitHub Action validates and moves the content into the public gallery.

Fallback path (no `gh` CLI) — opens a browser with a prefilled GitHub Issue Form for descriptor-only submission (bundle support requires `gh` for clean binary push).

Everything is GitHub-backed: no separate server, no external service, no account beyond your GitHub account.

## Relation to claude-snapshot

| | [claude-snapshot](https://github.com/adhenawer/claude-snapshot) | claude-setups |
|---|---|---|
| Destination | private (your own machines) | public (community gallery) |
| Reads `settings.json` / `~/.claude.json` | yes, fully | **no — no code path exists** |
| Can leak `env` values or OAuth tokens | yes (it's your local tarball) | **no — code to read them doesn't exist** |
| Shares hook scripts / `CLAUDE.md` | yes, automatically | **yes, but with per-file preview + regex + typed confirm** |
| Privacy model | local-only (no network) | architectural exclusion + mandatory user review |
| Primary use case | backup, restore, multi-machine sync | discovery, showcase, one-command mirror |

Both tools can coexist. claude-snapshot is the personal "save state" for your own machines (trust yourself with your own secrets); claude-setups is the "post to community" surface (the tool cannot leak secrets, and you review every file before publish).

## Status

Active design, not yet implemented. Research and architectural premise are documented in [`docs/`](docs/). Implementation will reuse base utilities from claude-snapshot where applicable — notably the tarball build/extract and `.bak`-backup apply logic (see [`docs/DESIGN.md` § Base reuse](docs/DESIGN.md#base-reuse-from-claude-snapshot)).

## License

MIT
