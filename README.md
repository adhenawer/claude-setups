# claude-share

**Share your Claude Code setup — safely.** Publish a descriptor of your plugins, MCP servers, and marketplaces to a community gallery; install someone else's setup with a single command.

> **Status:** 🚧 Very early. Research + design phase. See [docs/DESIGN.md](docs/DESIGN.md), [docs/SECURITY_PREMISE.md](docs/SECURITY_PREMISE.md), [docs/RISK_ANALYSIS.md](docs/RISK_ANALYSIS.md), and [docs/PRIOR_ART.md](docs/PRIOR_ART.md).

## Premise

Unlike a full backup/restore tool (see sibling project [claude-snapshot](https://github.com/adhenawer/claude-snapshot)), **claude-share never transmits configuration values**. It only shares the *names* of the things you have configured — plugin identifiers, MCP server commands (without `env`), marketplace sources, skill names.

This is **secure by construction, not by redaction**. No API key can leak because the tool never reads one.

## What gets shared

- ✅ Plugin names + marketplace sources (e.g. `superpowers@claude-plugins-official`)
- ✅ MCP server identifiers + install method classification (`npm`/`pip`/`binary`/`manual`)
- ✅ Marketplace registrations (e.g. `github.com/owner/repo`)
- ✅ User-provided metadata: title, description, tags

## What NEVER gets shared

- ❌ `settings.env` (API keys, tokens, internal URLs)
- ❌ Hook file contents (may contain secrets)
- ❌ MCP server `env` keys (tokens, database URLs)
- ❌ `CLAUDE.md` / other `.md` file contents (may contain identifying info)
- ❌ Absolute filesystem paths (`/Users/you/...`)

## Installing a shared setup

One command; no sender values touch the recipient's machine:

```bash
npx -y claude-share install https://claude-share.dev/s/abc123
```

The tool runs `claude marketplace add`, `claude plugin install`, and `claude mcp add` for each identifier in the descriptor. The recipient fills in their own env values where needed.

## Relation to claude-snapshot

| | [claude-snapshot](https://github.com/adhenawer/claude-snapshot) | claude-share |
|---|---|---|
| Unit of transfer | `.tar.gz` with file contents | descriptor (identifiers only) |
| Destination | private (your own machines) | public (community gallery) |
| Includes env / hooks / CLAUDE.md | yes | **no, by construction** |
| Privacy model | local-only (no network) | secure-by-construction |
| Primary use case | backup, restore, multi-machine sync | discovery, showcase, onboarding |

Both tools can coexist. claude-snapshot is the personal "save state" for your own machines; claude-share is the "post to community" surface.

## Status

Active design, not yet implemented. Research and architectural premise are documented in [`docs/`](docs/). Implementation will reuse base utilities from claude-snapshot where applicable (see [`docs/DESIGN.md` § Base reuse](docs/DESIGN.md#base-reuse-from-claude-snapshot)).

## License

MIT
