# Sensitive Data Surface Analysis

Compiled 2026-04-19. Catalogs every field under `~/.claude/` and `~/.claude.json` that could leak user data if shared publicly, grouped by risk level. Informs the "never transmit values" architectural decision codified in [SECURITY_PREMISE.md](SECURITY_PREMISE.md).

## 🔴 High risk — MUST NEVER be transmitted

### `~/.claude/settings.json` → `env` object

User-defined environment variables. Seen in real configs:

- `ANTHROPIC_API_KEY` (sometimes stored here)
- Hook-specific env: `GITHUB_TOKEN`, `OPENAI_API_KEY`, `SLACK_WEBHOOK_URL`
- Internal service URLs: `INTERNAL_API_URL=https://api.internal.company.com/...`
- Webhook secrets, session tokens

**Redaction feasibility:** Low. Regex can match known key-name patterns, but arbitrary user-defined names (`MY_INTERNAL_THING`) defeat detection. One miss = secret leaked forever.

### `~/.claude/settings.json` → `hooks.*.command` string values

The `command` field is arbitrary shell. Real examples:

```json
"command": "curl -H 'Authorization: Bearer $GITHUB_TOKEN' ..."
"command": "/Users/alice/scripts/rewrite.sh --api-key=abc123"
```

Even after `$HOME` normalization, can contain inline secrets, internal hostnames, proprietary tool names.

### `~/.claude/hooks/*.sh` file contents

Full shell script bodies. Can contain:

- Hardcoded tokens (users often start with hardcoded values during iteration and forget to extract them)
- Internal API endpoints
- Proprietary logic
- References to company-internal repos / tools

**Redaction feasibility:** Zero. Shell is Turing-complete; no static analyzer can prove a script has no secrets.

### MCP server `env` field (inside `~/.claude.json` `mcpServers.*.env`)

Per-MCP env vars like:

```json
"mcpServers": {
  "supabase": {
    "command": "uvx", "args": ["mcp-server-supabase"],
    "env": {
      "SUPABASE_URL": "https://xyzcompany.supabase.co",
      "SUPABASE_SERVICE_ROLE_KEY": "eyJhbGci...<THE KEY>..."
    }
  }
}
```

The entire MCP value proposition depends on `env` being real credentials. **These are literally tokens by design.**

## 🟡 Medium risk — privacy / identifiability concerns

### `~/.claude/CLAUDE.md` and other `*.md` at the root

Examples of what users put there (from real setups in the wild, including the author's own):

- Personal coding style preferences (low risk)
- Company name, project names (identifies user's employer)
- Internal tooling references (proprietary CLI names, internal wikis)
- Paths like `/Users/<username>/Code/<internal-project-name>` — identifies the user
- Email addresses (observed in real CLAUDE.md files)

Not secrets by the strict definition, but **identifying**. Sharing publicly = doxing risk if done carelessly. Redaction is extra-hard because "company name" is indistinguishable from any other proper noun.

### Plugin `installed_plugins.json` → `projectPath`

For project-scoped plugins, contains absolute paths. Already filtered in claude-snapshot's `collect()` (project-scoped plugins dropped). **Same filter must apply here.**

## 🟢 Low risk — safe to share

### Plugin identifiers

`{name, marketplace, version, scope}` — public info. The plugin marketplace is public; the plugin name is public; the version is public.

### Marketplace sources

`{name, source: 'github', repo: 'owner/name'}` — all public by definition.

### MCP server identifiers + args (excluding `env`)

`{name, command: 'npx', args: ['-y', '@anthropic/mcp-filesystem']}` — the command line *minus `env`* describes which server to install, safely.

Note: `args` can in theory contain paths or tokens if a user inlined them (e.g. `args: ['--api-key=abc123']`). This is unusual but possible. Treatment: **warn and require explicit confirmation if any `args` value matches a secret-like pattern**; default behavior is to include `args` as-is because the overwhelmingly common case is package names and flags.

### User-provided metadata

Title, description, tags — explicit opt-in by user typing them in the `publish` flow. User is responsible for what they type.

## Risk matrix summary

| Field | Content risk | Architectural decision |
|---|---|---|
| `settings.env.*` values | API keys, tokens | **Architecturally unreachable** — no code path reads this |
| `settings.hooks.*.command` strings | Inline secrets, internal URLs | **Architecturally unreachable** — the bundler reads hook FILES, not the `command` strings in `settings.json` |
| `settings.json` as a whole | Contains the above | **Architecturally unreachable** — no code reads this file |
| MCP `env.*` values | Service tokens | **Architecturally unreachable** — `mcpServers` is read, then the `env` key is dropped before the tree is traversed |
| `~/.claude.json` as a whole | OAuth tokens + project state | **Architecturally unreachable** — only the `mcpServers` key is extracted |
| `hooks/*.sh` file bodies | Full script content | **User-reviewed:** included by default, shown in preview with regex scan, toggleable per file |
| `CLAUDE.md` / other `.md` | Personal instructions, identifying info | **User-reviewed:** same flow as hooks |
| `skills/*` / `commands/*` / `agents/*` | Custom prompts, logic | **User-reviewed:** same flow as hooks |
| `installed_plugins.json` identifiers (user scope) | Plugin + marketplace names | Safe — public info |
| MCP `command` + `args` (non-env) | Install command | Safe with secret-pattern warning on `args` |
| User title/description/tags | What user typed | Transmit verbatim — user owns it |

## Why regex-based redaction is not enough

GitHub's 2024 stats: **39 million leaked secrets** despite push protection, partnerships with AWS/GCP/OpenAI for revocation, and Copilot-powered unstructured-secret detection. Even the best-resourced players in the industry can't regex their way to zero leaks.

A small project cannot out-regex that flood. **For a community-wide share mechanism, a single leak from a single user is enough to trash the tool's reputation.** The tool's whole value prop is "safe to share" — one viral leak destroys it.

## Architectural conclusion — two-layer model

claude-setups has two transmission paths with sharply different guarantees:

### Layer 1: Architecturally unreachable (never shared)

The collector has **no code path** that reads:

- `env` sections of `settings.json` or `mcpServers.*`
- `command` strings under `settings.hooks`
- `settings.json` or `~/.claude.json` as whole files

These cannot leak. The code to read them does not exist. Adding such a code path would be a security-critical review — not a flag toggle. This covers the categories where the 39M-per-year secret leaks happen.

### Layer 2: User-reviewed (shared with preview + regex + typed confirm)

The bundler CAN read (and by default includes):

- Hook scripts (`~/.claude/hooks/*.sh`)
- Global markdown (`~/.claude/CLAUDE.md`, other `*.md` at root)
- Custom skills, slash commands, and agents (`~/.claude/skills/*`, `commands/*`, `agents/*`)

Every file passes through mandatory preview with per-file include/exclude toggle + secret-pattern regex warning. The user types `publish` to confirm — no single-keystroke upload.

### Why split this way?

Hook bodies and `CLAUDE.md` are what make a setup interesting to share. A list of plugin names is a catalog; the actual custom hook is the value. Descriptor-only would be safe but thin. Two-layer preserves the safety where it matters (tokens/OAuth/env never leave) and enables the useful sharing (content with informed consent).

### What the user is responsible for

A user can approve a hook file that contains a hardcoded token, or a `CLAUDE.md` that mentions their employer. The regex is best-effort; the preview shows full content. The tool surfaces every character; the user decides whether each file goes public.

This is a defensible position: the tool prevents the 39M-leaks category (regex-hard, architecturally-easy) and forces a thoughtful human review on the remainder.

### Residual risk: the MCP `args` field

A determined user could inline secrets into MCP `args` values (e.g. `args: ["--token=abc123"]`). This is unusual but possible. Mitigation:

- The `publish` flow runs a secret-pattern regex over each `args` value
- Any match prompts the user: "`args[2]` looks like a secret. Replace with a placeholder or confirm it's safe?"
- If the user confirms, it ships as-is

Regex-based warning is imperfect, but the surface is tiny (one field, typically short) and the user always sees the final descriptor before confirming publish.

See [SECURITY_PREMISE.md](SECURITY_PREMISE.md) for the enforcement principles (P1, P2, P2.1).
