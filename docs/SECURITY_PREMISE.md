# Security Premise

The principles that constrain every design decision in claude-setups. Each principle is enforced by architecture, not by policy — so a compliant implementation is incapable of violating them.

## [P1] Never transmit values or file contents

The tool collects, transmits, and stores **only identifiers** — plugin names, marketplace sources, MCP `command` + `args` (not `env`), user-entered metadata. The collector has **no code path** that reads:

- `env` sections of `settings.json` or `mcpServers.*`
- `command` strings under `settings.hooks`
- Contents of `settings.json` or `~/.claude.json` as whole files
- Hook file bodies (`~/.claude/hooks/*.sh`)
- Global `.md` file contents (`~/.claude/CLAUDE.md`, etc.)

These are unreachable by the descriptor builder. You could not leak them even if you tried, because the code to read them does not exist. This is enforced at the source level — any PR that adds such a code path is a security-critical review, not a flag toggle.

## [P2] Secure by construction, not by redaction

Regex-based secret scanning catches ~90% of known patterns and misses the long tail. We reject that approach. The architecture **removes the category** of possible leak rather than filtering instances.

- No value-reading code exists → zero risk of value leak.
- No file-content-reading code exists → zero risk of accidentally shipping a hook body or a personal `CLAUDE.md`.
- Redaction would catch fewer leaks than GitHub's own industrial-grade scanners (which missed 39M secrets in 2024). Architecture wins.

## [P2.1] Setups are composed of public building blocks only

The descriptor references only things that are already publicly installable: plugins from public marketplaces, MCPs from public package registries, marketplaces hosted on public GitHub repos.

Custom private hooks or a personal `CLAUDE.md` are NOT shareable via claude-setups. The clean path for users who want to share customizations is to package them as a plugin (public, installable, versioned) and reference that plugin in the descriptor.

This constraint is intentional:

- It eliminates the entire class of "did I accidentally share a secret hook?" fears.
- It nudges the ecosystem toward well-packaged public plugins.
- It makes mirrors deterministic and fast (no file extraction, no conflict handling).

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

- ❌ Transmitting `.tar.gz` (or any binary) containing user file contents (violates P1; such content is architecturally unreachable by the collector)
- ❌ Reading `settings.json`, `~/.claude.json`, hook bodies, or `.md` file contents (violates P1 — the code does not exist)
- ❌ "Smart" redaction of any content (violates P2 — redaction is the wrong mental model)
- ❌ Forcing recipients to trust the source user's env values (violates P3)
- ❌ Auto-generating setup descriptions from file content (violates P4)
- ❌ Uploading without showing the user the full descriptor JSON first (violates P5)
- ❌ "Delete" that just hides the URL but keeps data on the server (violates P6)

## What they permit

- ✅ Sharing `{plugins, marketplaces, mcpServers: [{name, command, args}], title, description, tags}` (descriptor — safe by construction)
- ✅ Mirroring a shared setup: descriptor → `claude marketplace add` + `claude plugin install` + `claude mcp add` (idempotent, sequential)
- ✅ Browsing gallery anonymously
- ✅ Rating / favoriting via GitHub Issue reactions (anonymous-ish read, GitHub account required to write)
- ✅ Deleting own setup, with cascade to canonical storage, caches, and index
- ✅ Packaging a custom hook or personal `CLAUDE.md` as a standalone plugin first, then referencing it in a descriptor (the canonical "I want to share my customization" flow)
