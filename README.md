<p align="center">
  <strong>claude-setups</strong>
</p>

<p align="center">
  Discover how people configure Claude Code — and share your own setup with one command.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/claude-setups"><img src="https://img.shields.io/npm/v/claude-setups?color=blue" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/claude-setups"><img src="https://img.shields.io/npm/dm/claude-setups" alt="npm downloads"></a>
  <a href="https://github.com/adhenawer/claude-setups/actions"><img src="https://github.com/adhenawer/claude-setups/actions/workflows/test.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/adhenawer/claude-setups/blob/master/LICENSE"><img src="https://img.shields.io/github/license/adhenawer/claude-setups" alt="License"></a>
  <a href="https://github.com/adhenawer/claude-setups"><img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen" alt="Node >= 18"></a>
  <a href="https://adhenawer.github.io/claude-setups-registry/"><img src="https://img.shields.io/badge/gallery-live-blueviolet" alt="Gallery"></a>
</p>

---

People are sharing Claude Code setups everywhere — Reddit posts, GitHub repos, blog articles — but there's no single place to browse, compare, and install them. **claude-setups** is that place: a community registry where you publish your hooks, `CLAUDE.md`, skills, commands, and agents, and anyone can mirror your entire setup with one command.

## Quick Start

```bash
# Mirror someone's setup
npx -y claude-setups mirror alice/demo-setup

# Publish yours
npx -y claude-setups publish --with-bundle \
  --author yourname --slug my-setup \
  --title "My setup" --description "Backend + DevOps" \
  --tags py,backend --specialties backend
```

## What Gets Shared

| Shared (you review each file) | Never shared (no code path exists) |
|---|---|
| Plugin & marketplace identifiers | `settings.json` |
| MCP server names + commands | `~/.claude.json` (OAuth tokens) |
| Hook scripts (`hooks/*.sh`) | MCP `env` sections (API keys) |
| `CLAUDE.md` and root `*.md` | Absolute filesystem paths |
| Skills, commands, agents | |

## Features

### Publish

Share your Claude Code setup with the community. The tool reads your `~/.claude/` directory, collects identifiers (plugins, MCPs, marketplaces) and optionally bundles content files (hooks, markdown, skills).

```bash
npx -y claude-setups publish --with-bundle
```

**Interactive file review** — every file is shown with path, size, and full content. You include or exclude each one individually. A built-in [gitleaks](https://github.com/gitleaks/gitleaks)-based regex scanner flags API keys, tokens, and private keys before anything leaves your machine. Nothing uploads until you type `publish`.

### Mirror

Replicate someone else's setup on your machine. One command installs plugins, marketplaces, MCP servers, and extracts bundle files — all idempotently.

```bash
npx -y claude-setups mirror alice/demo-setup
```

- Installs plugins at the exact version the publisher exported
- Extracts hooks, skills, commands into `~/.claude/`
- Backs up existing files as `.bak` on conflict
- Skips anything already installed (safe to re-run)
- Sets `chmod +x` on hook scripts automatically

### Browse

Explore published setups in the community gallery:

```bash
npx -y claude-setups browse
```

Or visit the [gallery](https://adhenawer.github.io/claude-setups-registry/) directly.

### Revoke

Remove a previously published setup from the registry:

```bash
npx -y claude-setups revoke --author yourname --slug my-setup
```

## How It Works

```
┌──────────────┐     publish      ┌──────────────────┐     GitHub Action     ┌─────────────┐
│  your        │  ──────────────► │  GitHub Issue     │  ─────────────────►  │  Registry    │
│  ~/.claude/  │   descriptor +   │  (setup:submission│    validate + move   │  (gallery +  │
│              │   bundle.tar.gz  │   label)          │                      │   JSON API)  │
└──────────────┘                  └──────────────────┘                      └──────┬───────┘
                                                                                   │
┌──────────────┐     mirror       ┌──────────────────┐                             │
│  their       │  ◄────────────── │  Descriptor JSON  │  ◄─────────────────────────┘
│  ~/.claude/  │   fetch + extract│  + bundle.tar.gz  │
└──────────────┘                  └──────────────────┘
```

The registry is a static GitHub Pages site — no server, no database, no accounts beyond GitHub. Publishing creates a GitHub Issue; a GitHub Action validates and ingests it. Mirroring fetches static JSON + tarball.

## Relation to claude-snapshot

| | [claude-snapshot](https://github.com/adhenawer/claude-snapshot) | claude-setups |
|---|---|---|
| Purpose | Backup & sync across your own machines | Share with the community |
| Audience | Private (your machines only) | Public (community gallery) |
| Reads `settings.json` | Yes | No |
| Use case | Multi-machine sync, disaster recovery | Discovery, showcase, one-command clone |

Both tools coexist. Use claude-snapshot for private backup; use claude-setups to share publicly.

## Security

Sensitive files (`settings.json`, `~/.claude.json`, MCP `env` sections) are excluded by design — no code path exists to read them. Content files go through interactive preview with gitleaks regex scanning before publish. Full details in [`docs/SECURITY_PREMISE.md`](docs/SECURITY_PREMISE.md).

## Contributing

PRs welcome! See the [registry repo](https://github.com/adhenawer/claude-setups-registry) for gallery/validation contributions.

## License

[MIT](LICENSE)
