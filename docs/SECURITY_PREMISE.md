# Security Premise

The principles that constrain every design decision in claude-setups. Each principle is enforced by architecture where possible, and by mandatory user review where not. A compliant implementation is incapable of violating the architectural principles, even if the user asks it to.

## Two safety layers

1. **Architectural** — certain categories of content are unreachable by the tool's code. These cannot be shared even by mistake, even by malicious intent, even if the user explicitly asks.
2. **Informed user review** — the content categories the tool CAN read (hooks, markdown, skills) are shown to the user file-by-file with full preview and secret-pattern warnings before any upload. The user must type `publish` to confirm.

The split is deliberate. The hard-secret categories (env values, OAuth tokens, API keys) go in layer 1; the useful-but-potentially-identifying categories (hook scripts, CLAUDE.md, skill prompts) go in layer 2. This matches what users actually want to share while maintaining the strongest possible guarantee on the categories that matter most.

## [P1] Values and tokens are architecturally unreachable

The tool has **no code path** that reads any of these:

- `env` sections of `settings.json` or `mcpServers.*`
- `command` strings under `settings.hooks` (these can inline secrets; different from hook FILE bodies)
- `settings.json` as a whole file
- `~/.claude.json` as a whole file
- MCP `env` blocks

These are unreachable by the collector. You could not leak them even if you tried, because the code to read them does not exist. Adding such a code path is a security-critical review — not a flag toggle.

This is the strongest guarantee the tool makes. The categories in P1 are where secrets live (API keys, OAuth tokens, database URLs, company-internal hostnames); GitHub reported **39 million secrets leaked on their platform in 2024** despite industrial-grade regex scanning. Architecture is the only guarantee strong enough.

## [P2] Content files are user-reviewed, not auto-uploaded

The tool CAN read (and does share, by default) these categories:

- Hook scripts (`~/.claude/hooks/*.sh`) — full file contents
- Global markdown (`~/.claude/CLAUDE.md`, `~/.claude/*.md` at the root) — full file contents
- Custom skills (`~/.claude/skills/*`) — skill directories
- Custom slash commands (`~/.claude/commands/*`) — command files
- Custom agents (`~/.claude/agents/*`) — agent files

Every file in these categories is subject to **mandatory user review** during `publish`:

1. CLI lists every file that would be included, with size and content preview.
2. For each file, CLI runs a **secret-pattern regex** (API keys, bearer tokens, private keys, common env-var patterns). Matches are flagged with line numbers and surrounding context.
3. User toggles `include? (Y/n)` per file (default Y, can exclude anything).
4. CLI shows the final bundle summary: descriptor JSON + list of included files + total size.
5. User types `publish` to confirm. A short `y` or Enter is NOT enough — the typed word is deliberate friction so nobody publishes on autopilot.

## [P2.1] Informed-user-risk acknowledged

A user can still approve a hook file that contains a hardcoded token, or a `CLAUDE.md` that mentions their employer. The regex warning is best-effort; the preview shows full content. **The tool does not decide for the user; it shows the user everything with enough friction to force attention.**

This is the stated trade-off: the tool moves from "cannot leak by design" (impossible to achieve while making the product useful) to "cannot leak the hard-secret categories by design, plus forces full review of everything else". The user bears responsibility for the content they approve; the tool bears responsibility for surfacing every piece of it before the publish button becomes active.

## [P3] Recipient installs identifiers and extracts files, supplies own values

When a user mirrors someone else's setup:

- `claude marketplace add <source>` runs with public marketplace info (idempotent)
- `claude plugin install <name>` runs with public plugin info (idempotent)
- `claude mcp add <name> <command> <args>` runs, then **prompts the recipient to supply their own env values** for MCPs that need them
- Bundle files (hooks, `.md`, skills, commands, agents) are extracted into the recipient's `~/.claude/` with `.bak` backup on any conflict

The recipient's credentials never touch the source user, and the source user's credentials were never transmitted in the first place.

## [P4] Privacy-preserving metadata

User-entered metadata (title, description, tags) is shared verbatim. Users are responsible for what they type.

The tool **does not auto-extract** metadata from user files — no "let me read your `CLAUDE.md` and write a description for you" flow in v1. The user writes their own description.

## [P5] Auditable preview before publish

Before anything is uploaded, the tool shows:

1. The exact descriptor JSON that will be published.
2. The complete list of bundle files with their content previews.
3. Any regex warnings with line numbers.

The user confirms by typing `publish`. No background upload, no opaque blob, no hidden content.

## [P6] Revocable, with real propagation

A published setup can be deleted by its author. The gallery honors deletion and cascades to:

- Canonical repo storage (descriptor + bundle removed)
- CDN invalidation
- Search index removal

If the URL is ever scraped or cached externally (archive.org, GitHub clones, screenshot tweets), the tool clearly warns:

> "Once published, third parties may have mirrored this. Deletion on our end doesn't guarantee erasure elsewhere."

## [P7] No account to browse, account to publish

Browsing the gallery requires no login — read-only anonymous access. Publishing requires a GitHub account (via `gh` CLI or browser OAuth on the Issue Form) to enable:

- Attribution on the detail page
- Author-controlled deletion
- Abuse accountability (bad actors can be banned)

## [P8] Moderation escalation path

Every published setup has a "Report" button. Documented paths:

- **User reports a setup contains sensitive info** → immediate takedown, notify author
- **Author disputes that their own content was exposed without consent** → takedown, log
- **Platform (GitHub / legal / DMCA) report** → comply, log

v1 scope: email-based reporting + `/report` issue comments, manual review. Automated moderation comes later.

## What these principles forbid

- ❌ Reading `settings.json`, `~/.claude.json`, env values, or MCP env (violates P1 — no code path exists)
- ❌ Reading `settings.hooks.*.command` strings (violates P1 — can inline secrets)
- ❌ Auto-including any file without user review (violates P2)
- ❌ Allowing "publish" on a single-keystroke confirmation (violates P2 — requires typing the word)
- ❌ Skipping the regex warning even if the user asks (violates P2 — warning is informational, not blocking, but always shown)
- ❌ Forcing recipients to trust the source user's env values (violates P3)
- ❌ Auto-generating setup descriptions from file content (violates P4)
- ❌ Uploading without full preview (violates P5)
- ❌ "Delete" that hides the URL but keeps data (violates P6)

## What they permit

- ✅ Sharing the descriptor (plugins + marketplaces + MCP names/command/args + user metadata) — always safe by construction
- ✅ Sharing hook scripts, `CLAUDE.md`, skills, commands, and agents — with mandatory per-file preview + regex warning + typed confirmation
- ✅ Mirroring a shared setup: install identifiers + extract bundle files with `.bak` backup on conflict
- ✅ Browsing gallery anonymously
- ✅ Rating / favoriting via GitHub Issue reactions (anonymous-ish read, GitHub account required to write)
- ✅ Deleting own setup with cascade
