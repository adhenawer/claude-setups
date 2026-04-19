# Prior Art

Compiled 2026-04-19. Prior projects, patterns, and communities relevant to claude-setups's design.

## Direct Claude Code sharing

### Individual showcase repos (decentralized pattern)

- **[ChrisWiles/claude-code-showcase](https://github.com/ChrisWiles/claude-code-showcase)** — Full CC project with hooks, skills, agents, commands, and GitHub Actions workflows as a shareable template.
- **[centminmod/my-claude-code-setup](https://github.com/centminmod/my-claude-code-setup)** — Starter template + CLAUDE.md memory bank system.
- **[citypaul/.dotfiles](https://github.com/citypaul/.dotfiles)** — Personal dotfiles repo that gained traction specifically because of the bundled CLAUDE.md.
- **[nicksp/dotfiles](https://github.com/nicksp/dotfiles)** — Full dev env including Claude Code config alongside Zsh, Git, VSCode, Cursor, Obsidian, Ghostty.
- **[ooloth/dotfiles](https://github.com/ooloth/dotfiles)** — Another dotfiles-style public config featured on claude-hub.
- **[G's Claude Code Setup](https://www.giangallegos.com/day-38-bonus-sharing-your-claude-code-setup-with-your-community/)** — Blog post walking through sharing a setup as part of the AI-For-Pinoys series.

**Pattern:** one repo per person. No central discovery. Good for "here's mine"; bad for "show me 100 setups tagged Python".

### Aggregators

- **[claude-hub.com](https://www.claude-hub.com/)** — Indexes dotfile repos mentioning Claude Code. Directory-style, not gallery.
- **[awesomeclaude.ai](https://awesomeclaude.ai/)** — Visual frontend for several `awesome-*` GitHub lists. Listings are curated from upstream repos (hesreallyhim, punkpeye, etc.), not user submissions.

**Pattern:** read-only discovery. Users cannot publish their own setups here without going through each upstream awesome-list's submission process.

### Conversation sharing (adjacent, different product)

- **[wsxiaoys/claude-code-share](https://github.com/wsxiaoys/claude-code-share)** — CLI that transforms Claude Code conversations (not setups) into beautiful shareable links.

Different product but similar "share-centric" ethos — validates the demand for public sharing in this ecosystem.

### Official plugin system

- **[anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official)** — Official, Anthropic-managed plugin marketplace.
- Plugin system via `/plugin marketplace add` + `/plugin install`.

**Pattern:** share a *packaged plugin* (commands/agents/skills as a cohesive unit with a `plugin.json`). NOT a "here's my whole setup" share — plugins are discrete reusable units, not personal configurations.

### Article validation

[DEV.to: "Plugins: Share Your Entire Claude Code Setup With One Command"](https://dev.to/rajeshroyal/plugins-share-your-entire-claude-code-setup-with-one-command-294n) — the community already *conceptually* equates plugins with setup sharing, but the article describes publishing a *plugin repo*, not a setup catalog. Further evidence of the gap.

## Adjacent ecosystems

### VS Code

- **Settings Sync (built-in):** Syncs via Microsoft/GitHub account. Personal-only; no public share surface.
- **Legacy public Gist sharing** (Shan Khan's Settings Sync extension): export settings to Gist, share the ID. `Sync: Advance Options > Share Settings with Public GIST`. Historical pattern — friction-heavy.
- **Profiles (built-in):** Export/import as `.code-profile` files. No central gallery. [Ref](https://code.visualstudio.com/docs/configure/profiles)

### Cursor

- Config stored in `~/.cursor/`. No official share mechanism. Users roll their own via dotfile repos or [vscode-profile-switcher](https://github.com/aaronpowell/vscode-profile-switcher)-style tools.

### Shell ecosystems

- **[Oh My Zsh](https://ohmyz.sh/)** — 2,400+ contributors, **150 bundled themes**, 300+ plugins. Themes added via PRs to main repo; external themes listed in a wiki. Submit-via-PR model. No gallery UX beyond the wiki.
- **Starship** — Configuration presets shared on the project's website ([`starship.rs/presets/`](https://starship.rs/presets/)), each a small TOML. Central gallery hosted by maintainer; contributions go via PR.

### App launchers

- **[Raycast Store](https://developers.raycast.com/basics/publish-an-extension)** — Extensions go through PR review against a main repo ([raycast/extensions](https://github.com/raycast/extensions)). Community Managers + Raycast staff review. SLA: first contact within a week; PRs marked stale after 14 days idle, closed after 21 days. Extensions open-source by policy — "current source code can be inspected at all times". ([Security guidelines](https://developers.raycast.com/information/security))
- **Alfred Workflows** — No official central store; community-run gallery at Packal (modest adoption). Files shared as `.alfredworkflow` bundles.

### Dotfiles

- **[dotfiles.github.io](https://dotfiles.github.io/)** — Index of tools, tutorials, examples. User submissions are "add your repo link via PR".
- **[chezmoi](https://chezmoi.io/)** — Powerful CLI for managing personal dotfiles. No community discovery layer.

## Security-adjacent prior art

### GitHub secret-leak reality

From [GitHub's 2024 security report](https://github.blog/security/application-security/next-evolution-github-advanced-security/): **39 million secrets leaked on GitHub in 2024** (API keys, tokens, credentials). Also cited as **28 million credentials in 2025** by [Snyk](https://snyk.io/articles/state-of-secrets/).

Primary causes (per GitHub):
1. Accidental misconfiguration — public repos that shouldn't be public
2. Hardcoded creds left in during testing
3. Developers pasting configs in Issues/Stack Overflow to ask for help

GitHub's countermeasures:
- **Push protection by default** for public repos (blocks pushes containing known secret patterns)
- Secret scanning partnerships with AWS/GCP/OpenAI for auto-revocation on detection
- Copilot-powered unstructured-secret detection (passwords, not just API keys)

**Implication for claude-setups:** even GitHub's industrial-grade regex-plus-partnerships approach misses tens of millions of secrets per year. A small project cannot out-regex a 39M-per-year flood. **The architectural answer is to not transmit values in the first place** — descriptor-only.

### Secret-scanning tools (reference for a "second line of defense" if ever needed)

- **[KeySentry](https://github.com/AdityaBhatt3010/KeySentry)** — scans GitHub repos for leaked API keys.
- **[KeyLeak Detector](https://github.com/Amal-David/keyleak-detector)** — scans websites for exposed keys and secrets.

These would only be relevant if claude-setups ever accepted file content — v1 explicitly does not.

## Competitive gap

| Requirement | Existing solution? | Gap status |
|---|---|---|
| Browse Claude Code setups | Awesome lists (curated), dotfile repos (decentralized), claude-hub (directory) | No user-submitted gallery |
| One-command install of a setup | None | **Major gap** |
| Discover by tag / stack (Python / Supabase / Qt etc.) | awesome lists have categories | Not filterable at setup level |
| Showcase setups on a public page with rich preview | Individual repos with READMEs | No unified rendering |
| Safe-by-construction (no secret leak risk) | None — all existing share via full dotfiles | **Core opportunity** |
| Revocable / author-controlled deletion | N/A (repos are manually maintained) | Not addressed |
| Moderation / report flow | awesome-list maintainers informally | No standard |

## Positioning

**"Dribbble for Claude Code setups" — central gallery + 1-click mirror + privacy-by-default.**

Why it fits: similar to how Raycast extensions provide discovery (PR-reviewed, open-source, rich detail pages) but specialized for Claude Code setups (descriptors, not packaged extensions) with a stronger privacy stance (never transmit values) than anything in the adjacent ecosystems.
