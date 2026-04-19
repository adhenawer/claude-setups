# claude-setups

**Discover and share Claude Code setups — safely.** Publish a descriptor of your plugins, MCP servers, and marketplaces to the community gallery; mirror someone else's setup with a single command. No config values, no file contents, no secrets ever leave your machine.

> **Status:** 🚧 Very early. Research + design phase. See [docs/DESIGN.md](docs/DESIGN.md), [docs/SECURITY_PREMISE.md](docs/SECURITY_PREMISE.md), [docs/RISK_ANALYSIS.md](docs/RISK_ANALYSIS.md), and [docs/PRIOR_ART.md](docs/PRIOR_ART.md).

## Premise

Unlike a full backup/restore tool (see sibling project [claude-snapshot](https://github.com/adhenawer/claude-snapshot)), **claude-setups never reads any of your configuration files**. It publishes only the *identifiers* of the public things you have configured — plugin names, marketplace sources, MCP server commands (without `env`).

This is **secure by construction**: the code to read your secrets does not exist.

## Is this safe to run?

Short answer: **yes, and you don't have to take our word for it**. Here's literally everything that leaves your machine when you run `claude-setups publish`:

1. **Plugin identifiers** — e.g. `superpowers@claude-plugins-official` (version `5.0.7`). Public info. Anyone can install the same plugins themselves.
2. **Marketplace sources** — e.g. `github.com/anthropics/claude-plugins-official`. Public GitHub URLs.
3. **MCP server identifiers** — server `name`, the `command` (e.g. `uvx`), and the `args` (e.g. `["mcp-server-supabase"]`). Install recipe, no credentials.
4. **The title, description, and tags you type** at the publish prompt.

That's it. The full list fits in 4 bullets because that's **all the code can read**.

Before anything is uploaded, the tool shows you the complete descriptor JSON on one screen and asks you to confirm. There is no "background upload", no opaque blob, no tarball.

### What the tool CANNOT read (even if you asked it to)

- ❌ `settings.json` — contains `env` (API keys), hook `command` strings. **No code path exists to read this file.**
- ❌ `~/.claude.json` — contains OAuth tokens, project state. **No code path exists to read this file.**
- ❌ Hook script bodies (`~/.claude/hooks/*.sh`) — can contain hardcoded tokens. **No code path exists to read these.**
- ❌ Global markdown files (`~/.claude/CLAUDE.md`, etc.) — can contain company names, internal paths. **No code path exists to read these.**
- ❌ MCP `env` blocks (service tokens, DB URLs). **No code path exists to read these.**
- ❌ Absolute filesystem paths — the descriptor format has no fields where a path could appear.

This is **security by construction, not by redaction**. Regex-based secret scanning (the approach GitHub uses) missed 39 million secrets leaked on GitHub in 2024. We use a stronger guarantee: the forbidden code paths do not exist. Adding one would be a security-critical PR, reviewed as such.

## How mirroring works

One command; the sender's env values never existed in the payload to begin with:

```bash
npx -y claude-setups mirror https://claude-setups.dev/s/abc123
```

The tool:

1. Fetches the descriptor JSON from the URL.
2. Shows the install plan: "N plugins to install, M MCPs to add, K marketplaces to register. X already installed locally (will skip)."
3. On your confirmation, runs:
   - `claude marketplace add <source>` for each marketplace
   - `claude plugin install <name>@<marketplace>` for each plugin
   - `claude mcp add <name> <command> <args>` for each MCP
4. Prompts you to supply your own env values for each MCP that needs them (the sender never sent any).

**Idempotent:** re-running mirror on the same URL is a no-op for anything already installed. Safe to retry after partial failures.

**Reproducible:** descriptor freezes each plugin's exact version, so mirroring 6 months from now installs the same versions the publisher exported.

## How publishing works

Primary path (recommended) — with the [GitHub CLI](https://cli.github.com):

```bash
npx -y claude-setups publish
```

The tool reads `~/.claude/` (identifiers only), asks for title/description/tags, shows the full descriptor JSON on one screen, and on your confirmation creates a GitHub issue on the registry repo. A Github Action validates the schema and commits the descriptor into the public gallery.

Fallback path (no `gh` CLI) — opens a browser with a prefilled GitHub Issue Form for manual submission.

Everything is GitHub-backed: no separate server, no external service, no account system beyond your GitHub account.

## "But I want to share my custom hook / CLAUDE.md"

Totally valid — and here's the clean path:

1. Package your custom hook or CLAUDE.md template as a standalone Claude Code plugin (its own repo with a `.claude-plugin/plugin.json`).
2. Publish it to any marketplace (your own GitHub repo is enough).
3. Reference that plugin in your claude-setups descriptor.

Now it's shareable **and** reusable **and** versioned. Other users mirror your setup and get your hook as an installable plugin, not a raw script they had to trust.

The constraint that "shared setups are composed of public building blocks" pushes everyone's customizations toward good packaging hygiene. This is a feature, not a limitation.

## Relation to claude-snapshot

| | [claude-snapshot](https://github.com/adhenawer/claude-snapshot) | claude-setups |
|---|---|---|
| Unit of transfer | `.tar.gz` with full file contents (including `settings.json`, MCP env, hooks, CLAUDE.md) | JSON descriptor (identifiers only) |
| Destination | private (your own machines) | public (community gallery) |
| Reads any file with values or content | yes (by design for local backup) | **no — no code path exists** |
| Can transmit a secret even if you ask it to | yes (it's your tarball, your risk) | **no — the code to do it doesn't exist** |
| Privacy model | local-only (no network) | secure-by-construction |
| Primary use case | backup, restore, multi-machine sync | discovery, showcase, one-command mirror |

Both tools can coexist. claude-snapshot is the personal "save state" for your own machines; claude-setups is the "post to community" surface.

## Status

Active design, not yet implemented. Research and architectural premise are documented in [`docs/`](docs/). Implementation will reuse base utilities from claude-snapshot where applicable (see [`docs/DESIGN.md` § Base reuse](docs/DESIGN.md#base-reuse-from-claude-snapshot)).

## License

MIT
