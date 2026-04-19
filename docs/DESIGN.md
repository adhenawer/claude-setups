# Design (early draft)

> **Status:** Initial draft. Starting point for continued brainstorming; several open questions remain. Not a final spec yet. Security premise is [locked](SECURITY_PREMISE.md); architecture is open.

## Product shape

**claude-share** is a two-part product:

1. **CLI tool** (npm package, distributable via `npx`, similar to claude-snapshot) with commands `publish`, `install`, `browse`, `revoke`.
2. **Web gallery** (domain and hosting TBD) with descriptor storage, search, filters, and author accounts.

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
# Publish — shows descriptor, asks for metadata, uploads, returns URL
npx -y claude-share publish

# Install — downloads descriptor, installs plugins/MCPs/marketplaces locally
npx -y claude-share install https://claude-share.dev/s/abc123

# Browse — opens gallery in default browser
npx -y claude-share browse

# Revoke — deletes the user's own published setup by ID
npx -y claude-share revoke abc123
```

All commands output pretty text on a TTY and JSON when piped (same pattern as claude-snapshot 0.3.0).

## Publish flow

```
1. User runs `claude-share publish`.
2. CLI reads ~/.claude/ for plugins + marketplaces, and ~/.claude.json for
   mcpServers (command + args only, never env).
3. CLI prompts:
     "Title? Description? Tags (comma-separated)?"
     "Author handle?" (pre-filled from GitHub if OAuth'd)
4. CLI shows the FULL descriptor JSON that will be uploaded. Plain. One screen.
5. CLI asks: "Publish? (y/n)"
6. On yes → POST to gallery API → receives URL.
7. CLI prints the URL and the one-line install command for others to use.
```

## Install flow

```
1. User runs `claude-share install <url>`.
2. CLI fetches descriptor from the URL.
3. CLI shows summary:
     "This setup installs N plugins, M MCP servers, from K marketplaces."
4. CLI shows diff against local state:
     "Y plugins already installed. Z are new. W MCPs need env values."
5. CLI asks: "Install? (y/n)"
6. For each marketplace: `claude marketplace add <source>`
7. For each plugin: `claude plugin install <name>@<marketplace>`
8. For each MCP: `claude mcp add <name> <command> <args>`, then prompts user
   to supply env values interactively OR writes placeholders they fill in
   their own `.claude.json` later.
```

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

## Open questions

1. **Hosting model:** Own server + domain (most flexible), GitHub Pages + GitHub Issues as "DB" (cheapest), Supabase (middle), Cloudflare Workers + KV (edge-fast)? Biggest architectural decision.
2. **Auth:** GitHub OAuth only, or also email/password? Former is simpler and aligns with the audience.
3. **Rate limits:** How many publishes per day per author? (abuse protection)
4. **Tag taxonomy:** Free-form or from a moderated list?
5. **Content moderation:** Email reports only, or also automated pre-publish scanning (e.g., flag descriptors that reference unknown marketplaces; flag `args` values matching secret patterns)?
6. **Versioning:** If a user republishes an updated setup, is it a new ID or a version of the old one?
7. **Naming:** Keep `claude-share`? Or something more evocative? (`claudehub`, `showcc`, etc.)
8. **Relation to existing awesome lists:** Integrate (auto-submit to upstream awesome lists) or compete?
9. **Discovery API:** Expose descriptor JSON at a stable URL (e.g., `/s/<id>.json`) for machine consumption and embedding?
10. **License on shared descriptors:** CC0, MIT, or something permissive-but-attribution?

Resolve priority, biggest first:

1. **#1 hosting** — every other decision downstream depends on this.
2. **#2 auth** — follows hosting.
3. **#7 naming** — needed before anything public.
4. **#5 and #6 scope cuts** — YAGNI review of moderation and versioning.

## Base reuse from claude-snapshot

Directly reusable:

- `classifyMcpMethod()` — the exact function maps MCP commands to install-method identifiers for the descriptor.
- Plugin filter for `scope: 'user'` — drops project-scoped plugins that contain absolute paths (privacy-relevant).
- Node.js ESM + `node:test` + no-transpile publish pattern.
- `package.json` + `.gitignore` skeleton.
- Plugin manifest scaffolding (`.claude-plugin/plugin.json` + `.claude-plugin/marketplace.json`).
- CI matrix (`.github/workflows/test.yml`), macOS + Linux × Node 18/20/22.
- Pretty-vs-JSON output helper (`shouldOutputJson`, `writeOutput`) from snapshot 0.3.0.

NOT reused:

- Tarball build/extract pipeline — not needed.
- Path normalization — not needed (descriptors have no paths).
- Apply/diff on filesystem — different flow (we invoke `claude plugin install` rather than writing files).
- `.claude.json` env read — we intentionally don't read env.

## Next steps

1. Resolve open questions #1, #2, #7 (hosting, auth, naming) in continued brainstorming.
2. Once locked, write full design spec at `docs/superpowers/specs/<date>-claude-share-v1-design.md` following the same pattern as claude-snapshot's design flow.
3. Scaffold the CLI crate: copy `package.json` skeleton + `classifyMcpMethod` from claude-snapshot, build out `publish` / `install` / `browse` / `revoke`.
4. Decide gallery stack + deploy a minimal read-only browse page.
5. Public launch post-security-review by an outside reviewer.
