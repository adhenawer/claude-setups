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
| `settings.env.*` values | API keys, tokens | **Never transmit** |
| `settings.hooks.*.command` strings | Inline secrets, internal URLs | **Never transmit** (keep hook identity only, not command body) |
| `hooks/*.sh` file bodies | Full script content | **Never transmit** |
| MCP `env.*` values | Service tokens | **Never transmit** |
| `CLAUDE.md` / other `.md` full content | Identifying info | **Never transmit by default**; opt-in with preview for v2+ |
| `installed_plugins.json` identifiers | Plugin + marketplace names | Safe to transmit |
| MCP `command` + `args` (non-env) | Install command | Safe to transmit (with secret-pattern warning on `args`) |
| User title/description/tags | What user typed | Transmit verbatim (user owns it) |

## Why regex-based redaction is not enough

GitHub's 2024 stats: **39 million leaked secrets** despite push protection, partnerships with AWS/GCP/OpenAI for revocation, and Copilot-powered unstructured-secret detection. Even the best-resourced players in the industry can't regex their way to zero leaks.

A small project cannot out-regex that flood. **For a community-wide share mechanism, a single leak from a single user is enough to trash the tool's reputation.** The tool's whole value prop is "safe to share" — one viral leak destroys it.

## Architectural conclusion

claude-share **never reads values**. The collector has no code path that touches `env`, hook bodies, or `.md` content. The only content that leaves the user's machine is:

1. Plugin, marketplace, and MCP **names** (identifiers)
2. MCP `command` + `args` (not `env`), with a secret-pattern warning on `args`
3. User-entered metadata (title, description, tags)

This is **security by construction**, not by policy. The tool cannot leak a secret because it never touches one. See [SECURITY_PREMISE.md](SECURITY_PREMISE.md) for the enforcement principles.
