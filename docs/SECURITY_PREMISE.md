# Security Premise

The principles that constrain every design decision in claude-share. Each principle is enforced by architecture, not by policy — so a compliant implementation is incapable of violating them.

## [P1] Never transmit values

The tool collects, transmits, and stores **only identifiers** — plugin names, marketplace sources, MCP command/args, user-entered metadata. It never reads or transmits:

- Contents of any hook file
- Contents of any `.md` file at the root of `~/.claude/`
- `env` sections of `settings.json` or `mcpServers.*`
- `command` strings under `settings.hooks` (only the fact that a hook exists by name, if hook-sharing is introduced in v2 — and only as a hashed reference, not a body)

**Enforcement:** the collector has no code path that reads a value-containing field. You couldn't leak a secret even if you tried, because the code to do it doesn't exist.

## [P2] Secure by construction, not by redaction

Regex-based secret scanning catches ~90% of known patterns and misses the long tail. We reject that approach. The architecture **removes the category** of possible leak, rather than filtering instances.

If a future feature wants to share richer content (e.g., a sanitized `CLAUDE.md`), it is introduced as an **explicit opt-in with preview and confirmation**, not as a default. That feature is OUT of scope for v1.

## [P3] Recipient installs identifiers, supplies values

When a user installs someone else's setup:

- `claude marketplace add <source>` runs with public marketplace info
- `claude plugin install <name>` runs with public plugin info
- `claude mcp add <name> <command> <args>` runs, but **prompts the recipient to supply their own env values** (or leaves placeholders that the recipient fills in their own `.claude.json`)

The recipient's credentials never touch the source user, and the source user's credentials were never transmitted in the first place.

## [P4] Privacy-preserving metadata

User-entered metadata (title, description, tags) is shared verbatim. Users are responsible for what they type.

We **do not auto-extract** metadata from user files — no "let me read your `CLAUDE.md` and write a description for you" flow in v1. Too much surface for accidental inclusion.

## [P5] Auditable descriptor

Before publish, the tool shows the **exact descriptor** that will be uploaded. One screen. Plain JSON. The user presses "Publish" only after reading it. No background upload, no opaque blob.

## [P6] Revocable, with real propagation

A published setup can be deleted by its author. The gallery honors deletion and cascades to:

- Cached mirrors
- CDN invalidation
- Search index removal

If the URL is ever scraped or cached externally (archive.org, GitHub clones, screenshot tweets), the tool clearly warns:

> "Once published, third parties may have mirrored this. Deletion on our end doesn't guarantee erasure elsewhere."

## [P7] No account to browse, account to publish

Browsing the gallery requires no login — read-only anonymous access, so casual visitors don't need to register. Publishing requires a lightweight account (GitHub OAuth sufficient) to enable:

- Attribution on the detail page
- Author-controlled deletion
- Abuse accountability (bad actors can be banned)

## [P8] Moderation escalation path

Every published setup has a "Report" button. The documented paths:

- **User reports a setup contains sensitive info** → immediate takedown, notify author
- **Author disputes that their own content was exposed without consent** → takedown, log
- **Platform (GitHub / legal / DMCA) report** → comply, log

v1 scope: email-based reporting, manual review. Automated moderation (anomaly detection, spam filters) comes later as the gallery grows.

## What these principles forbid

- ❌ Uploading the raw `.tar.gz` of a setup (violates P1)
- ❌ "Smart" redaction of hooks or `settings.env` (violates P2)
- ❌ Forcing recipients to trust the source user's env values (violates P3)
- ❌ Auto-generating setup descriptions from file content (violates P4)
- ❌ Uploading without showing the user the descriptor first (violates P5)
- ❌ "Delete" that just hides the URL but keeps data on the server (violates P6)

## What they permit

- ✅ Sharing `{plugins: [...], marketplaces: [...], mcpServers: [{name, command, args}], title, description, tags}`
- ✅ Installing a shared setup: run `marketplace add` + `plugin install` + `mcp add` per descriptor
- ✅ Browsing gallery anonymously
- ✅ Rating / favoriting (anonymous read, account required to write)
- ✅ Deleting own setup, with cascade to caches and index
