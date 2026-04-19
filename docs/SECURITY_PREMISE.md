# Security Premise

The principles that constrain every design decision in claude-share. Each principle is enforced by architecture, not by policy — so a compliant implementation is incapable of violating them.

## [P1] Never transmit values without explicit, per-file user approval

The tool has two transmission paths, both subject to this principle:

**Descriptor path (always):** collects, transmits, and stores only identifiers — plugin names, marketplace sources, MCP `command` + `args` (not `env`), user-entered metadata. The collector has **no code path** that reads:

- `env` sections of `settings.json` or `mcpServers.*`
- `command` strings under `settings.hooks`
- Contents of `settings.json` or `~/.claude.json` as whole files

These things are unreachable by the descriptor builder. You could not leak them through the descriptor even if you tried, because the code to read them does not exist.

**Bundle path (opt-in):** users MAY include a `.tar.gz` with specific, hand-picked files — hook scripts and global `.md` files only. The CLI presents each candidate file's content for inline approval before inclusion. The user presses `y` per file. The bundle-building code has no branch for `settings.json`, `~/.claude.json`, or MCP `env`; these are unreachable by the bundler, not just filtered.

**Enforcement for both paths:** the guarantee is architectural, not regex-based. The forbidden classes of content are unreachable code paths, not filtered strings.

## [P2] Secure by construction, not by redaction

Regex-based secret scanning catches ~90% of known patterns and misses the long tail. We reject that approach. The architecture **removes the category** of possible leak rather than filtering instances.

- **Descriptor:** no value-reading code exists → zero risk of value leak.
- **Bundle:** no `settings.json` / `.claude.json` / env-reading code exists → those categories cannot be in the bundle. The files the bundle CAN contain (hooks, `.md`) are shown verbatim to the user before inclusion — approval, not redaction.

Redaction would catch fewer leaks than GitHub's own industrial-grade scanners (which missed 39M secrets in 2024). Architecture wins.

## [P2.1] Bundle is opt-in, default off, user-curated

The `publish` command asks once: "Include setup bundle? (N/y)". Default is No. Pressing Enter ships the descriptor only.

If the user opts in, they enter an interactive file picker. For each eligible file (`hooks/*.sh`, `*.md` at `~/.claude/` root), the CLI shows the content inline and asks `keep? (y/N)`. Only approved files end up in the tar.gz.

The user sees the final tarball file list (names + sizes) before publish confirmation. No background upload, no implicit content.

**Trade-off acknowledged:** the bundle path slightly enlarges the user's responsibility. A user could approve a hook file that contains a hardcoded token. That's their decision, made with the content shown in front of them on their own terminal. The tool does not decide for them.

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

- ❌ Uploading a `.tar.gz` that contains `settings.json`, `~/.claude.json`, or `env` sections (violates P1; these are architecturally unreachable by the bundler)
- ❌ "Smart" redaction of hook contents or `settings.env` (violates P2 — redaction is the wrong mental model)
- ❌ Bundling ANY file without per-file user approval (violates P2.1)
- ❌ Forcing recipients to trust the source user's env values (violates P3)
- ❌ Auto-generating setup descriptions from file content (violates P4)
- ❌ Uploading without showing the user the descriptor + bundle file list first (violates P5)
- ❌ "Delete" that just hides the URL but keeps data on the server (violates P6)

## What they permit

- ✅ Sharing `{plugins, marketplaces, mcpServers: [{name, command, args}], title, description, tags}` (descriptor — always safe by construction)
- ✅ Sharing a `.tar.gz` with user-approved hook scripts + `.md` files (bundle — opt-in, per-file approval)
- ✅ Mirroring a shared setup: descriptor → `marketplace add` + `plugin install` + `mcp add`; bundle (if present) → extract to `~/.claude/` with `.bak` backup on conflict
- ✅ Browsing gallery anonymously
- ✅ Rating / favoriting via GitHub Issue reactions (anonymous-ish read, GitHub account required to write)
- ✅ Deleting own setup, with cascade to canonical storage, caches, and index
