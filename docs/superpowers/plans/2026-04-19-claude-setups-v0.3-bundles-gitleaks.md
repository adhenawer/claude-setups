# claude-setups v0.3 — bundles + gitleaks

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Prerequisite:** v0.1 (publish skeleton) and v0.2 (mirror + revoke) executed and merged. This plan ships the content-layer: hooks, `CLAUDE.md`, skills, commands, and agents travel in an opt-in user-reviewed bundle.

**Goal:** Ship v0.3.0 where `publish` optionally includes a user-curated bundle of hook scripts and `.md` content scanned by gitleaks, confirmed file-by-file with a typed `publish` prompt; and `mirror` extracts the bundle into `~/.claude/` with `.bak` backup on conflicts. The categories settings.json / `.claude.json` / env values remain architecturally unreachable.

**Architecture:** New modules: `paths.mjs` (port), `bundle-collect.mjs` (allowlisted dir walk), `gitleaks.mjs` (regex scanner bundled from gitleaks TOML), `preview.mjs` (interactive readline file-by-file), `bundle-build.mjs` (tar.create), `bundle-extract.mjs` (tar.extract with `.bak` backup). Publish pushes bundle tarball to a temp branch via `gh api`; registry ingest moves it to `data/bundles/<author>/<slug>.tar.gz` and deletes the temp branch.

**Tech Stack:** v0.2 stack + `tar@^7.0.0` npm dep for bundle packaging. Gitleaks rules shipped as a bundled TOML data file (no gitleaks binary needed — we port the patterns to JS regex at load time).

---

## File Structure

**Repo 1: `/Users/adhenawer/Code/claude-setups/` (CLI)**

- Create: `src/paths.mjs` — `normalizePaths` + `resolvePaths` (ported from claude-snapshot)
- Create: `src/bundle-collect.mjs` — reads hooks/*.sh, *.md at root, skills/, commands/, agents/
- Create: `src/gitleaks.mjs` — regex runner from bundled rules
- Create: `src/gitleaks-rules.toml` — data file with subset of gitleaks/config/gitleaks.toml
- Create: `src/preview.mjs` — interactive file-by-file preview + toggle
- Create: `src/bundle-build.mjs` — tarball assembly (includes path-normalized contents)
- Create: `src/bundle-extract.mjs` — extract bundle with `.bak` backup
- Modify: `src/publish.mjs` — `publishViaGh` accepts `withBundle` option; pushes bundle to temp branch
- Modify: `src/mirror.mjs` — if `descriptor.bundle.present`, fetch + extract bundle after install steps
- Modify: `src/cli.mjs` — `publish` accepts `--with-bundle`, `--yes` (skips typed confirm for CI only)
- Modify: `package.json` — add `"tar": "^7.0.0"` dep; bump version to 0.3.0
- Create: `tests/paths.test.mjs`
- Create: `tests/bundle-collect.test.mjs`
- Create: `tests/gitleaks.test.mjs`
- Create: `tests/preview.test.mjs`
- Create: `tests/bundle-build.test.mjs`
- Create: `tests/bundle-extract.test.mjs`
- Create: `tests/bundle-round-trip.test.mjs`
- Modify: `tests/fixtures/fake-claude-home/` — add hooks/, CLAUDE.md, skills/ fixture content

**Repo 2: `/Users/adhenawer/Code/claude-setups-registry/`**

- Modify: `scripts/ingest.mjs` — after descriptor commit, move bundle from temp branch to `data/bundles/<author>/<slug>.tar.gz`, then delete temp branch
- Modify: `scripts/validate-descriptor.mjs` — additional checks when `bundle.present === true`: bundle file path allowlist, no `..`, no settings.json, sha256 match
- Modify: `.github/workflows/ingest.yml` — bundle move step
- Modify: `site/setup.html` — render bundle file list when present
- Modify: `site/build.mjs` — include bundle metadata in detail pages
- Create: `scripts/tests/bundle-ingest.test.mjs`

---

## Task 1: Add `tar` dependency + port path helpers

**Files:**
- Modify: `/Users/adhenawer/Code/claude-setups/package.json`
- Create: `/Users/adhenawer/Code/claude-setups/src/paths.mjs`
- Create: `/Users/adhenawer/Code/claude-setups/tests/paths.test.mjs`

- [ ] **Step 1: Add tar to package.json**

In `/Users/adhenawer/Code/claude-setups/package.json`, add to `dependencies`:
```json
"dependencies": {
  "tar": "^7.0.0"
},
```
Also bump `"version": "0.3.0"`.

Run: `cd /Users/adhenawer/Code/claude-setups && npm install`

- [ ] **Step 2: Write failing tests for paths**

Create `/Users/adhenawer/Code/claude-setups/tests/paths.test.mjs`:
```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('normalizePaths', () => {
  it('replaces home prefix with $HOME in string values', async () => {
    const { normalizePaths } = await import('../src/paths.mjs');
    const input = { cmd: '/Users/alice/.claude/hooks/x.sh' };
    const out = normalizePaths(input, '/Users/alice');
    assert.equal(out.cmd, '$HOME/.claude/hooks/x.sh');
  });

  it('recurses into nested objects and arrays', async () => {
    const { normalizePaths } = await import('../src/paths.mjs');
    const input = {
      hooks: [
        { command: '/Users/alice/scripts/a.sh' },
        { command: '/tmp/unrelated' },
      ],
    };
    const out = normalizePaths(input, '/Users/alice');
    assert.equal(out.hooks[0].command, '$HOME/scripts/a.sh');
    assert.equal(out.hooks[1].command, '/tmp/unrelated');
  });

  it('escapes regex-special characters in home dir', async () => {
    const { normalizePaths } = await import('../src/paths.mjs');
    const input = { p: '/Users/a.b+c/x' };
    const out = normalizePaths(input, '/Users/a.b+c');
    assert.equal(out.p, '$HOME/x');
  });
});

describe('resolvePaths', () => {
  it('replaces $HOME with given home dir', async () => {
    const { resolvePaths } = await import('../src/paths.mjs');
    const input = { cmd: '$HOME/.claude/hooks/x.sh' };
    const out = resolvePaths(input, '/Users/bob');
    assert.equal(out.cmd, '/Users/bob/.claude/hooks/x.sh');
  });
});

describe('normalizeString / resolveString (single-string helpers for file contents)', () => {
  it('normalizeString replaces home prefix', async () => {
    const { normalizeString } = await import('../src/paths.mjs');
    assert.equal(
      normalizeString('run /Users/alice/.claude/hooks/x.sh', '/Users/alice'),
      'run $HOME/.claude/hooks/x.sh'
    );
  });

  it('resolveString replaces $HOME', async () => {
    const { resolveString } = await import('../src/paths.mjs');
    assert.equal(
      resolveString('run $HOME/.claude/hooks/x.sh', '/Users/bob'),
      'run /Users/bob/.claude/hooks/x.sh'
    );
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test 2>&1 | tail -8`
Expected: 5 failures.

- [ ] **Step 4: Implement**

Create `/Users/adhenawer/Code/claude-setups/src/paths.mjs`:
```js
export function normalizePaths(obj, homeDir) {
  const json = JSON.stringify(obj);
  const escaped = homeDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return JSON.parse(json.replace(new RegExp(escaped, 'g'), '$HOME'));
}

export function resolvePaths(obj, homeDir) {
  const json = JSON.stringify(obj);
  return JSON.parse(json.replace(/\$HOME/g, homeDir));
}

export function normalizeString(str, homeDir) {
  const escaped = homeDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return str.replace(new RegExp(escaped, 'g'), '$HOME');
}

export function resolveString(str, homeDir) {
  return str.replace(/\$HOME/g, homeDir);
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npm test 2>&1 | tail -5`
Expected: 5 new passing.

- [ ] **Step 6: Commit**

```bash
git add package.json src/paths.mjs tests/paths.test.mjs
git commit -m "feat(v0.3): paths helpers (normalize/resolve for objects and strings) + tar dep; 5 tests"
```

---

## Task 2: Extend fixtures — hooks, CLAUDE.md, skills

**Files:**
- Create: `/Users/adhenawer/Code/claude-setups/tests/fixtures/fake-claude-home/hooks/auto-stage.sh`
- Create: `/Users/adhenawer/Code/claude-setups/tests/fixtures/fake-claude-home/CLAUDE.md`
- Create: `/Users/adhenawer/Code/claude-setups/tests/fixtures/fake-claude-home/skills/pr-review/SKILL.md`
- Create: `/Users/adhenawer/Code/claude-setups/tests/fixtures/fake-claude-home/skills/pr-review/references/template.md`
- Create: `/Users/adhenawer/Code/claude-setups/tests/fixtures/fake-claude-home/commands/ping.md`

- [ ] **Step 1: Create hook fixture (clean — no secrets)**

Write `/Users/adhenawer/Code/claude-setups/tests/fixtures/fake-claude-home/hooks/auto-stage.sh`:
```bash
#!/bin/bash
# Auto-stage tracked changes before each commit.
set -e
git add -u
echo "auto-staged tracked changes"
```

- [ ] **Step 2: Create CLAUDE.md fixture**

Write `/Users/adhenawer/Code/claude-setups/tests/fixtures/fake-claude-home/CLAUDE.md`:
```markdown
# Global instructions (fixture)

- Always explain reasoning before tool calls.
- Prefer smaller commits over larger ones.
```

- [ ] **Step 3: Create skill fixture**

Write `/Users/adhenawer/Code/claude-setups/tests/fixtures/fake-claude-home/skills/pr-review/SKILL.md`:
```markdown
---
name: pr-review
description: Review a pull request methodically.
---

# pr-review

Steps: fetch diff, read changed files, flag issues.
```

Write `/Users/adhenawer/Code/claude-setups/tests/fixtures/fake-claude-home/skills/pr-review/references/template.md`:
```markdown
## PR review template

- [ ] tests updated
- [ ] docs reflect changes
- [ ] breaking change flagged
```

- [ ] **Step 4: Create command fixture**

Write `/Users/adhenawer/Code/claude-setups/tests/fixtures/fake-claude-home/commands/ping.md`:
```markdown
---
description: Simple ping command
---

Echo "pong" to confirm the command system works.
```

- [ ] **Step 5: Verify existing tests still pass with added fixture content**

Run: `npm test 2>&1 | tail -5`
Expected: all tests still pass (fixture additions don't affect v0.1/v0.2 tests).

- [ ] **Step 6: Commit**

```bash
git add tests/fixtures/fake-claude-home/hooks/ tests/fixtures/fake-claude-home/CLAUDE.md tests/fixtures/fake-claude-home/skills/ tests/fixtures/fake-claude-home/commands/
git commit -m "test(v0.3): add hook/CLAUDE.md/skills/commands fixtures for bundle tests"
```

---

## Task 3: Bundle candidate collector

**Files:**
- Create: `/Users/adhenawer/Code/claude-setups/src/bundle-collect.mjs`
- Create: `/Users/adhenawer/Code/claude-setups/tests/bundle-collect.test.mjs`

- [ ] **Step 1: Write failing tests**

Create `/Users/adhenawer/Code/claude-setups/tests/bundle-collect.test.mjs`:
```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, 'fixtures/fake-claude-home');

describe('collectBundleCandidates', () => {
  it('returns hooks/*.sh', async () => {
    const { collectBundleCandidates } = await import('../src/bundle-collect.mjs');
    const files = await collectBundleCandidates(FIXTURES);
    const paths = files.map(f => f.relativePath).sort();
    assert.ok(paths.includes('hooks/auto-stage.sh'));
  });

  it('returns root *.md files', async () => {
    const { collectBundleCandidates } = await import('../src/bundle-collect.mjs');
    const files = await collectBundleCandidates(FIXTURES);
    const paths = files.map(f => f.relativePath).sort();
    assert.ok(paths.includes('CLAUDE.md'));
  });

  it('returns skills/** recursively', async () => {
    const { collectBundleCandidates } = await import('../src/bundle-collect.mjs');
    const files = await collectBundleCandidates(FIXTURES);
    const paths = files.map(f => f.relativePath).sort();
    assert.ok(paths.includes('skills/pr-review/SKILL.md'));
    assert.ok(paths.includes('skills/pr-review/references/template.md'));
  });

  it('returns commands/** recursively', async () => {
    const { collectBundleCandidates } = await import('../src/bundle-collect.mjs');
    const files = await collectBundleCandidates(FIXTURES);
    const paths = files.map(f => f.relativePath).sort();
    assert.ok(paths.includes('commands/ping.md'));
  });

  it('never returns settings.json, .claude.json, or plugins/', async () => {
    const { collectBundleCandidates } = await import('../src/bundle-collect.mjs');
    const files = await collectBundleCandidates(FIXTURES);
    const paths = files.map(f => f.relativePath);
    assert.ok(!paths.some(p => p.startsWith('settings.json')), 'settings.json must NEVER appear');
    assert.ok(!paths.some(p => p.startsWith('plugins/')), 'plugins/ must NEVER appear');
    assert.ok(!paths.some(p => p.includes('.claude.json')), '.claude.json must NEVER appear');
  });

  it('returns file entries with path + size + content', async () => {
    const { collectBundleCandidates } = await import('../src/bundle-collect.mjs');
    const files = await collectBundleCandidates(FIXTURES);
    for (const f of files) {
      assert.ok(typeof f.relativePath === 'string');
      assert.ok(typeof f.size === 'number' && f.size > 0);
      assert.ok(typeof f.content === 'string');
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test 2>&1 | tail -8`
Expected: 6 failures.

- [ ] **Step 3: Implement**

Create `/Users/adhenawer/Code/claude-setups/src/bundle-collect.mjs`:
```js
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ALLOWED_DIRS = ['hooks', 'skills', 'commands', 'agents'];

export async function collectBundleCandidates(claudeHome) {
  const results = [];

  // Root *.md
  const rootEntries = await readdir(claudeHome, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      await addFile(results, claudeHome, entry.name);
    }
  }

  // Allowed subdirs, recursive
  for (const dirName of ALLOWED_DIRS) {
    const dirPath = join(claudeHome, dirName);
    try {
      await walk(results, claudeHome, dirPath);
    } catch {
      // Directory doesn't exist — ignore
    }
  }

  return results;
}

async function walk(results, root, currentDir) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      await walk(results, root, fullPath);
    } else if (entry.isFile()) {
      const rel = relative(root, fullPath);
      await addFile(results, root, rel);
    }
  }
}

async function addFile(results, root, rel) {
  const fullPath = join(root, rel);
  const s = await stat(fullPath);
  const content = await readFile(fullPath, 'utf-8');
  results.push({
    relativePath: rel,
    size: s.size,
    content,
  });
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test 2>&1 | tail -5`
Expected: 6 new passing.

- [ ] **Step 5: Commit**

```bash
git add src/bundle-collect.mjs tests/bundle-collect.test.mjs
git commit -m "feat(v0.3): bundle candidate collector (hooks/*, *.md, skills/**, commands/**, agents/**) — NEVER reads settings.json or .claude.json; 6 tests"
```

---

## Task 4: Gitleaks regex port

**Files:**
- Create: `/Users/adhenawer/Code/claude-setups/src/gitleaks-rules.toml`
- Create: `/Users/adhenawer/Code/claude-setups/src/gitleaks.mjs`
- Create: `/Users/adhenawer/Code/claude-setups/tests/gitleaks.test.mjs`

- [ ] **Step 1: Create the rules TOML (subset of upstream)**

Write `/Users/adhenawer/Code/claude-setups/src/gitleaks-rules.toml`:
```toml
# Subset of gitleaks/config/gitleaks.toml — curated for v0.3 launch.
# Upstream: https://github.com/gitleaks/gitleaks/blob/master/config/gitleaks.toml

[[rules]]
id = "aws-access-key"
description = "AWS Access Key ID"
regex = '''(?i)(AKIA[0-9A-Z]{16})'''

[[rules]]
id = "aws-secret-key"
description = "AWS Secret Access Key"
regex = '''(?i)aws(.{0,20})?(?-i)['"][0-9a-zA-Z/+]{40}['"]'''

[[rules]]
id = "github-pat"
description = "GitHub Personal Access Token (classic + fine-grained)"
regex = '''(ghp|github_pat)_[A-Za-z0-9_]{30,}'''

[[rules]]
id = "github-oauth"
description = "GitHub OAuth"
regex = '''gho_[A-Za-z0-9_]{30,}'''

[[rules]]
id = "slack-token"
description = "Slack Token"
regex = '''xox[baprs]-([A-Za-z0-9-]{10,})'''

[[rules]]
id = "openai-key"
description = "OpenAI API Key"
regex = '''sk-[A-Za-z0-9]{20,}T3BlbkFJ[A-Za-z0-9]{20,}'''

[[rules]]
id = "openai-project-key"
description = "OpenAI Project Key"
regex = '''sk-proj-[A-Za-z0-9_-]{20,}'''

[[rules]]
id = "anthropic-api-key"
description = "Anthropic API Key"
regex = '''sk-ant-(api|admin)[0-9]{2}-[A-Za-z0-9_-]{90,}'''

[[rules]]
id = "stripe-secret"
description = "Stripe secret key"
regex = '''sk_(test|live)_[0-9a-zA-Z]{24,}'''

[[rules]]
id = "google-api-key"
description = "Google API Key"
regex = '''AIza[0-9A-Za-z_-]{35}'''

[[rules]]
id = "generic-bearer"
description = "Generic bearer token assignment (heuristic)"
regex = '''(?i)(bearer\s+[A-Za-z0-9._-]{20,}|authorization['"\s:=]+bearer\s+[A-Za-z0-9._-]{20,})'''

[[rules]]
id = "generic-apikey"
description = "Generic API key assignment (heuristic)"
regex = '''(?i)(api[_-]?key|apikey)['"\s:=]+['"]?[A-Za-z0-9_-]{20,}['"]?'''

[[rules]]
id = "private-key-pem"
description = "PEM-format private key"
regex = '''-----BEGIN ((RSA|EC|OPENSSH|DSA|PGP) )?PRIVATE KEY( BLOCK)?-----'''
```

- [ ] **Step 2: Write failing tests**

Create `/Users/adhenawer/Code/claude-setups/tests/gitleaks.test.mjs`:
```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('loadGitleaksRules', () => {
  it('parses the bundled TOML into an array of rules', async () => {
    const { loadGitleaksRules } = await import('../src/gitleaks.mjs');
    const rules = await loadGitleaksRules();
    assert.ok(rules.length >= 10);
    for (const r of rules) {
      assert.ok(r.id);
      assert.ok(r.description);
      assert.ok(r.regex instanceof RegExp);
    }
  });
});

describe('scanContent', () => {
  it('detects AWS access key', async () => {
    const { scanContent } = await import('../src/gitleaks.mjs');
    const matches = await scanContent(`aws_key = "AKIAIOSFODNN7EXAMPLE"`, 'file.txt');
    assert.ok(matches.some(m => m.ruleId === 'aws-access-key'));
  });

  it('detects GitHub PAT', async () => {
    const { scanContent } = await import('../src/gitleaks.mjs');
    const matches = await scanContent(
      `token = "ghp_abcdefghijklmnopqrstuvwxyz0123456789"`,
      'f.txt'
    );
    assert.ok(matches.some(m => m.ruleId === 'github-pat'));
  });

  it('detects Anthropic API key', async () => {
    const { scanContent } = await import('../src/gitleaks.mjs');
    const matches = await scanContent(
      `ANTHROPIC=sk-ant-api03-${'x'.repeat(95)}`,
      'f.txt'
    );
    assert.ok(matches.some(m => m.ruleId === 'anthropic-api-key'));
  });

  it('returns line numbers', async () => {
    const { scanContent } = await import('../src/gitleaks.mjs');
    const matches = await scanContent(
      `line1\nline2\ntoken=AKIAIOSFODNN7EXAMPLE\nline4`,
      'f.txt'
    );
    assert.ok(matches.length > 0);
    assert.equal(matches[0].line, 3);
  });

  it('returns [] on clean content', async () => {
    const { scanContent } = await import('../src/gitleaks.mjs');
    const matches = await scanContent(`# This is a clean README with no secrets.`, 'f.txt');
    assert.deepEqual(matches, []);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test 2>&1 | tail -8`
Expected: 6 failures.

- [ ] **Step 4: Implement**

Create `/Users/adhenawer/Code/claude-setups/src/gitleaks.mjs`:
```js
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = join(__dirname, 'gitleaks-rules.toml');

let cachedRules = null;

function parseToml(text) {
  // Minimal TOML parser for `[[rules]]` blocks with id/description/regex fields.
  const rules = [];
  const blocks = text.split(/\n\[\[rules\]\]\s*\n/);
  // First element is preamble, discard
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const lines = block.split('\n');
    const rule = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      if (trimmed.startsWith('[[')) break;
      const m = trimmed.match(/^(\w+)\s*=\s*(?:'''(.*)'''|"(.*)")$/s);
      if (m) {
        const key = m[1];
        const value = m[2] !== undefined ? m[2] : m[3];
        rule[key] = value;
      }
    }
    if (rule.id && rule.regex) {
      // Convert to JS RegExp; gitleaks syntax is Go regexp, mostly compatible
      try {
        rule.regex = new RegExp(rule.regex, 'g');
        rules.push(rule);
      } catch {
        // Skip rules that don't parse as JS regex (edge cases)
      }
    }
  }
  return rules;
}

export async function loadGitleaksRules() {
  if (cachedRules) return cachedRules;
  const text = await readFile(RULES_PATH, 'utf-8');
  cachedRules = parseToml(text);
  return cachedRules;
}

export async function scanContent(content, filePath) {
  const rules = await loadGitleaksRules();
  const matches = [];
  const lines = content.split('\n');
  for (const rule of rules) {
    // Reset lastIndex because rule.regex has global flag
    rule.regex.lastIndex = 0;
    let m;
    while ((m = rule.regex.exec(content)) !== null) {
      const before = content.slice(0, m.index);
      const lineNumber = before.split('\n').length;
      matches.push({
        ruleId: rule.id,
        description: rule.description,
        line: lineNumber,
        match: m[0].slice(0, 80),
        file: filePath,
      });
      if (m.index === rule.regex.lastIndex) rule.regex.lastIndex++;
    }
  }
  return matches;
}

export async function scanFiles(files) {
  const all = [];
  for (const f of files) {
    const matches = await scanContent(f.content, f.relativePath);
    for (const m of matches) all.push(m);
  }
  return all;
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npm test 2>&1 | tail -5`
Expected: 6 new passing.

- [ ] **Step 6: Commit**

```bash
git add src/gitleaks.mjs src/gitleaks-rules.toml tests/gitleaks.test.mjs
git commit -m "feat(v0.3): gitleaks regex scanner with 13 curated patterns (AWS, GitHub, OpenAI, Anthropic, Stripe, PEM, ...); 6 tests"
```

---

## Task 5: Interactive file preview UX

**Files:**
- Create: `/Users/adhenawer/Code/claude-setups/src/preview.mjs`
- Create: `/Users/adhenawer/Code/claude-setups/tests/preview.test.mjs`

- [ ] **Step 1: Write failing tests**

Create `/Users/adhenawer/Code/claude-setups/tests/preview.test.mjs`:
```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const FILES = [
  { relativePath: 'hooks/a.sh', size: 100, content: 'echo hi' },
  { relativePath: 'CLAUDE.md', size: 200, content: '# CLAUDE.md' },
  { relativePath: 'hooks/leak.sh', size: 150, content: 'TOKEN=ghp_abcdefghijklmnopqrstuvwxyz0123456789' },
];

describe('previewFiles (interactive)', () => {
  it('includes all files when user presses Enter (default Y) for each', async () => {
    const { previewFiles } = await import('../src/preview.mjs');
    let calls = 0;
    const ask = async () => { calls++; return ''; };  // empty = default Y
    const included = await previewFiles(FILES, { ask });
    assert.equal(included.length, 3);
    assert.equal(calls, 3);
  });

  it('excludes files where user types "n"', async () => {
    const { previewFiles } = await import('../src/preview.mjs');
    const responses = ['', 'n', ''];  // include, exclude, include
    let i = 0;
    const ask = async () => responses[i++];
    const included = await previewFiles(FILES, { ask });
    assert.deepEqual(included.map(f => f.relativePath), ['hooks/a.sh', 'hooks/leak.sh']);
  });

  it('passes regex matches through to the prompt (for display)', async () => {
    const { previewFiles } = await import('../src/preview.mjs');
    const prompted = [];
    const ask = async (file, matches) => {
      prompted.push({ file: file.relativePath, matchCount: matches.length });
      return '';
    };
    await previewFiles(FILES, { ask });
    const leak = prompted.find(p => p.file === 'hooks/leak.sh');
    assert.ok(leak.matchCount >= 1, 'leak.sh should have regex matches');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test 2>&1 | tail -8`
Expected: 3 failures.

- [ ] **Step 3: Implement**

Create `/Users/adhenawer/Code/claude-setups/src/preview.mjs`:
```js
import { createInterface } from 'node:readline/promises';
import { scanContent } from './gitleaks.mjs';

/**
 * Interactive per-file preview with include/exclude toggle.
 * Default include = Y.
 *
 * @param {Array} files — [{ relativePath, size, content }]
 * @param {object} options
 * @param {Function} options.ask — async (file, matches) => userInput string (testing hook)
 */
export async function previewFiles(files, options = {}) {
  const { ask = defaultAsk } = options;
  const included = [];
  for (const file of files) {
    const matches = await scanContent(file.content, file.relativePath);
    const answer = (await ask(file, matches)).trim().toLowerCase();
    if (answer === '' || answer === 'y' || answer === 'yes') {
      included.push(file);
    }
    // 'n', 'no', or anything else = exclude
  }
  return included;
}

async function defaultAsk(file, matches) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const matchInfo = matches.length > 0
      ? ` ⚠️  ${matches.length} secret-pattern match(es): ${matches.map(m => `${m.ruleId} @line ${m.line}`).join(', ')}`
      : '';
    console.log(`\n${file.relativePath}  (${file.size} bytes)${matchInfo}`);
    console.log('--- content preview (first 20 lines) ---');
    console.log(file.content.split('\n').slice(0, 20).join('\n'));
    console.log('---');
    return await rl.question('Include this file? (Y/n): ');
  } finally {
    rl.close();
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test 2>&1 | tail -5`
Expected: 3 new passing.

- [ ] **Step 5: Commit**

```bash
git add src/preview.mjs tests/preview.test.mjs
git commit -m "feat(v0.3): interactive per-file preview with gitleaks integration; default-include, n-to-exclude; 3 tests"
```

---

## Task 6: Bundle builder (tarball assembly)

**Files:**
- Create: `/Users/adhenawer/Code/claude-setups/src/bundle-build.mjs`
- Create: `/Users/adhenawer/Code/claude-setups/tests/bundle-build.test.mjs`

- [ ] **Step 1: Write failing tests**

Create `/Users/adhenawer/Code/claude-setups/tests/bundle-build.test.mjs`:
```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import * as tar from 'tar';

describe('buildBundle', () => {
  it('creates a tar.gz containing the selected files with metadata', async () => {
    const { buildBundle } = await import('../src/bundle-build.mjs');
    const dir = await mkdtemp(join(tmpdir(), 'cs-bb-'));
    try {
      const outPath = join(dir, 'out.tar.gz');
      const files = [
        { relativePath: 'hooks/a.sh', content: '#!/bin/bash\necho hi\n' },
        { relativePath: 'CLAUDE.md', content: '# Hello\n' },
      ];
      const result = await buildBundle(files, outPath);
      assert.equal(result.files.length, 2);
      assert.ok(result.sha256);
      assert.ok(result.files[0].sha256);

      // Extract and verify content
      const extractDir = join(dir, 'extract');
      await tar.x({ file: outPath, cwd: extractDir }, undefined).catch(async () => {
        const { mkdir } = await import('node:fs/promises');
        await mkdir(extractDir, { recursive: true });
        await tar.x({ file: outPath, cwd: extractDir });
      });
      const extracted = await readFile(join(extractDir, 'hooks/a.sh'), 'utf-8');
      assert.match(extracted, /echo hi/);
    } finally { await rm(dir, { recursive: true }); }
  });

  it('normalizes $HOME in file contents', async () => {
    const { buildBundle } = await import('../src/bundle-build.mjs');
    const dir = await mkdtemp(join(tmpdir(), 'cs-bb-'));
    try {
      const outPath = join(dir, 'out.tar.gz');
      const files = [
        { relativePath: 'hooks/a.sh', content: 'source /Users/alice/.claude/x.sh' },
      ];
      await buildBundle(files, outPath, { homeDir: '/Users/alice' });
      const extractDir = join(dir, 'extract');
      const { mkdir } = await import('node:fs/promises');
      await mkdir(extractDir, { recursive: true });
      await tar.x({ file: outPath, cwd: extractDir });
      const content = await readFile(join(extractDir, 'hooks/a.sh'), 'utf-8');
      assert.match(content, /\$HOME\/\.claude\/x\.sh/);
      assert.ok(!content.includes('/Users/alice'), 'should have no literal /Users/alice');
    } finally { await rm(dir, { recursive: true }); }
  });

  it('returns sha256 for the overall tarball and per-file', async () => {
    const { buildBundle } = await import('../src/bundle-build.mjs');
    const dir = await mkdtemp(join(tmpdir(), 'cs-bb-'));
    try {
      const outPath = join(dir, 'out.tar.gz');
      const files = [{ relativePath: 'x.md', content: 'hi' }];
      const result = await buildBundle(files, outPath);
      const tarContent = await readFile(outPath);
      const expected = createHash('sha256').update(tarContent).digest('hex');
      assert.equal(result.sha256, expected);
      // Per-file sha256 is over the NORMALIZED content
      assert.equal(
        result.files[0].sha256,
        createHash('sha256').update('hi').digest('hex')
      );
    } finally { await rm(dir, { recursive: true }); }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test 2>&1 | tail -8`
Expected: 3 failures.

- [ ] **Step 3: Implement**

Create `/Users/adhenawer/Code/claude-setups/src/bundle-build.mjs`:
```js
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import * as tar from 'tar';
import { normalizeString } from './paths.mjs';

export async function buildBundle(files, outputPath, options = {}) {
  const { homeDir } = options;
  const stagingDir = outputPath + '.staging';
  await mkdir(stagingDir, { recursive: true });

  const fileMetadata = [];
  try {
    for (const f of files) {
      const content = homeDir ? normalizeString(f.content, homeDir) : f.content;
      const filePath = join(stagingDir, f.relativePath);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, content);
      const sha = createHash('sha256').update(content).digest('hex');
      fileMetadata.push({
        path: f.relativePath,
        size: Buffer.byteLength(content, 'utf-8'),
        sha256: sha,
      });
    }

    await tar.create(
      { gzip: true, file: outputPath, cwd: stagingDir },
      fileMetadata.map(f => f.path)
    );
  } finally {
    await rm(stagingDir, { recursive: true, force: true });
  }

  const tarBuffer = await readFile(outputPath);
  const tarSha = createHash('sha256').update(tarBuffer).digest('hex');

  return {
    path: outputPath,
    sha256: tarSha,
    size: tarBuffer.length,
    files: fileMetadata,
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test 2>&1 | tail -5`
Expected: 3 new passing.

- [ ] **Step 5: Commit**

```bash
git add src/bundle-build.mjs tests/bundle-build.test.mjs
git commit -m "feat(v0.3): bundle builder (tar.gz + sha256 per file + total) with $HOME normalization; 3 tests"
```

---

## Task 7: Bundle extractor with .bak backup

**Files:**
- Create: `/Users/adhenawer/Code/claude-setups/src/bundle-extract.mjs`
- Create: `/Users/adhenawer/Code/claude-setups/tests/bundle-extract.test.mjs`

- [ ] **Step 1: Write failing tests**

Create `/Users/adhenawer/Code/claude-setups/tests/bundle-extract.test.mjs`:
```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('extractBundle', () => {
  async function makeTar(files) {
    const tar = await import('tar');
    const dir = await mkdtemp(join(tmpdir(), 'cs-mk-'));
    const stage = join(dir, 'stage');
    await mkdir(stage, { recursive: true });
    for (const f of files) {
      const p = join(stage, f.path);
      await mkdir(join(stage, f.path, '..'), { recursive: true });
      await writeFile(p, f.content);
    }
    const outPath = join(dir, 'bundle.tar.gz');
    await tar.c({ gzip: true, file: outPath, cwd: stage }, files.map(f => f.path));
    return { dir, outPath };
  }

  it('extracts files into the claudeHome with $HOME resolved', async () => {
    const { extractBundle } = await import('../src/bundle-extract.mjs');
    const { dir, outPath } = await makeTar([
      { path: 'hooks/a.sh', content: 'source $HOME/.claude/x.sh' },
      { path: 'CLAUDE.md', content: 'hello' },
    ]);
    const claudeHome = join(dir, '.claude');
    try {
      await extractBundle(outPath, claudeHome, { homeDir: '/Users/bob' });
      const hook = await readFile(join(claudeHome, 'hooks/a.sh'), 'utf-8');
      assert.match(hook, /source \/Users\/bob\/\.claude\/x\.sh/);
      const md = await readFile(join(claudeHome, 'CLAUDE.md'), 'utf-8');
      assert.equal(md, 'hello');
    } finally { await rm(dir, { recursive: true }); }
  });

  it('chmods hooks to 0o755', async () => {
    const { extractBundle } = await import('../src/bundle-extract.mjs');
    const { dir, outPath } = await makeTar([
      { path: 'hooks/a.sh', content: '#!/bin/bash\necho hi' },
    ]);
    const claudeHome = join(dir, '.claude');
    try {
      await extractBundle(outPath, claudeHome, { homeDir: '/Users/bob' });
      const s = await stat(join(claudeHome, 'hooks/a.sh'));
      assert.ok(s.mode & 0o100, 'owner execute bit should be set');
    } finally { await rm(dir, { recursive: true }); }
  });

  it('backs up existing file to .bak on conflict', async () => {
    const { extractBundle } = await import('../src/bundle-extract.mjs');
    const { dir, outPath } = await makeTar([
      { path: 'CLAUDE.md', content: 'new content' },
    ]);
    const claudeHome = join(dir, '.claude');
    await mkdir(claudeHome, { recursive: true });
    await writeFile(join(claudeHome, 'CLAUDE.md'), 'old content');
    try {
      const result = await extractBundle(outPath, claudeHome, { homeDir: '/Users/bob' });
      const backup = await readFile(join(claudeHome, 'CLAUDE.md.bak'), 'utf-8');
      assert.equal(backup, 'old content');
      const current = await readFile(join(claudeHome, 'CLAUDE.md'), 'utf-8');
      assert.equal(current, 'new content');
      assert.ok(result.backups.includes('CLAUDE.md'));
    } finally { await rm(dir, { recursive: true }); }
  });

  it('skips files that match existing content (idempotent)', async () => {
    const { extractBundle } = await import('../src/bundle-extract.mjs');
    const { dir, outPath } = await makeTar([
      { path: 'CLAUDE.md', content: 'same' },
    ]);
    const claudeHome = join(dir, '.claude');
    await mkdir(claudeHome, { recursive: true });
    await writeFile(join(claudeHome, 'CLAUDE.md'), 'same');
    try {
      const result = await extractBundle(outPath, claudeHome, { homeDir: '/Users/bob' });
      // No backup should be created for unchanged content
      await assert.rejects(
        readFile(join(claudeHome, 'CLAUDE.md.bak'), 'utf-8'),
        /ENOENT/
      );
      assert.equal(result.backups.length, 0);
    } finally { await rm(dir, { recursive: true }); }
  });

  it('rejects tarballs with absolute or traversal paths', async () => {
    const { extractBundle } = await import('../src/bundle-extract.mjs');
    const { dir, outPath } = await makeTar([
      { path: '../escape.sh', content: 'x' },  // attempted traversal
    ]);
    const claudeHome = join(dir, '.claude');
    try {
      await assert.rejects(
        extractBundle(outPath, claudeHome, { homeDir: '/Users/bob' }),
        /disallowed path/i
      );
    } finally { await rm(dir, { recursive: true }); }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test 2>&1 | tail -8`
Expected: 5 failures.

- [ ] **Step 3: Implement**

Create `/Users/adhenawer/Code/claude-setups/src/bundle-extract.mjs`:
```js
import { mkdir, writeFile, rm, readFile, chmod } from 'node:fs/promises';
import { dirname, join, isAbsolute, relative } from 'node:path';
import * as tar from 'tar';
import { fileExists } from './fs-helpers.mjs';
import { resolveString } from './paths.mjs';

export async function extractBundle(tarPath, claudeHome, options = {}) {
  const { homeDir } = options;
  const stagingDir = tarPath + '.extract-staging';
  await mkdir(stagingDir, { recursive: true });
  const backups = [];

  try {
    await tar.extract({ file: tarPath, cwd: stagingDir });

    // Walk the staged tree and write to claudeHome with .bak on conflict
    await walkAndApply(stagingDir, stagingDir, claudeHome, homeDir, backups);
  } finally {
    await rm(stagingDir, { recursive: true, force: true });
  }

  return { backups };
}

async function walkAndApply(root, current, claudeHome, homeDir, backups) {
  const { readdir, stat } = await import('node:fs/promises');
  const entries = await readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(current, entry.name);
    if (entry.isDirectory()) {
      await walkAndApply(root, fullPath, claudeHome, homeDir, backups);
      continue;
    }
    const rel = relative(root, fullPath);

    // Security: reject absolute paths or traversals
    if (isAbsolute(rel) || rel.includes('..') || rel.startsWith('/')) {
      throw new Error(`disallowed path in bundle: ${rel}`);
    }

    const content = await readFile(fullPath, 'utf-8');
    const resolved = homeDir ? resolveString(content, homeDir) : content;
    const targetPath = join(claudeHome, rel);
    await mkdir(dirname(targetPath), { recursive: true });

    if (await fileExists(targetPath)) {
      const existing = await readFile(targetPath, 'utf-8');
      if (existing === resolved) continue;  // idempotent: unchanged
      await writeFile(targetPath + '.bak', existing);
      backups.push(rel);
    }
    await writeFile(targetPath, resolved);

    // chmod +x for hooks
    if (rel.startsWith('hooks/')) {
      await chmod(targetPath, 0o755);
    }
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test 2>&1 | tail -5`
Expected: 5 new passing.

- [ ] **Step 5: Commit**

```bash
git add src/bundle-extract.mjs tests/bundle-extract.test.mjs
git commit -m "feat(v0.3): bundle extractor — resolves \$HOME, .bak backup on conflict, chmod +x hooks, rejects traversal; 5 tests"
```

---

## Task 8: Extend publish with --with-bundle

**Files:**
- Modify: `/Users/adhenawer/Code/claude-setups/src/publish.mjs`
- Modify: `/Users/adhenawer/Code/claude-setups/src/cli.mjs`
- Modify: `/Users/adhenawer/Code/claude-setups/tests/publish.test.mjs`

- [ ] **Step 1: Add failing tests to publish.test.mjs**

Append to `/Users/adhenawer/Code/claude-setups/tests/publish.test.mjs`:
```js
import { mkdtemp as _mkdtemp, rm as _rm, readFile as _readFile } from 'node:fs/promises';
import { tmpdir as _tmpdir } from 'node:os';

describe('publishViaGh with bundle', () => {
  it('builds the bundle, computes sha256, sets descriptor.bundle.present = true, pushes to temp branch', async () => {
    const { publishViaGh } = await import('../src/publish.mjs');
    const ghCalls = [];
    const mockGh = async (args, opts) => {
      ghCalls.push({ args, stdin: opts?.stdin });
      if (args[0] === 'api' && args[1]?.includes('refs')) {
        // Simulate git ref create response
        return { stdout: '', stderr: '', code: 0 };
      }
      return { stdout: 'https://github.com/x/y/issues/42', stderr: '', code: 0 };
    };
    const result = await publishViaGh({
      claudeHome: FIXTURES,
      author: 'alice',
      slug: 'with-bundle',
      title: 'T',
      description: 'D',
      tags: ['test'],
      registryRepo: 'x/y',
      withBundle: true,
      bundlePicker: async (files) => files,  // approve everything (testing shortcut)
      gh: mockGh,
    });
    assert.equal(result.status, 'ok');
    // Verify at least one gh call was to push the bundle
    const pushCall = ghCalls.find(c => c.args[0] === 'api' && c.args.some(a => String(a).includes('refs')));
    assert.ok(pushCall, 'should have pushed bundle ref');
    // Descriptor should have bundle.present = true
    const issueCall = ghCalls.find(c => c.args[0] === 'issue');
    const bodyIdx = issueCall.args.indexOf('--body');
    const body = JSON.parse(issueCall.args[bodyIdx + 1]);
    assert.equal(body.bundle.present, true);
    assert.ok(body.bundle.sha256);
    assert.ok(Array.isArray(body.bundle.files));
  });

  it('publishes without bundle when withBundle is false/omitted', async () => {
    const { publishViaGh } = await import('../src/publish.mjs');
    const ghCalls = [];
    const mockGh = async (args, opts) => {
      ghCalls.push({ args, stdin: opts?.stdin });
      return { stdout: 'https://github.com/x/y/issues/42', stderr: '', code: 0 };
    };
    await publishViaGh({
      claudeHome: FIXTURES,
      author: 'alice',
      slug: 'no-bundle',
      title: 'T',
      description: 'D',
      tags: ['test'],
      registryRepo: 'x/y',
      gh: mockGh,
    });
    const issueCall = ghCalls.find(c => c.args[0] === 'issue');
    const bodyIdx = issueCall.args.indexOf('--body');
    const body = JSON.parse(issueCall.args[bodyIdx + 1]);
    assert.equal(body.bundle.present, false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test 2>&1 | tail -8`
Expected: 2 failures.

- [ ] **Step 3: Extend publish.mjs**

Replace `/Users/adhenawer/Code/claude-setups/src/publish.mjs` with:
```js
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { collect } from './collect.mjs';
import { buildDescriptor } from './descriptor.mjs';
import { runGh } from './gh.mjs';
import { collectBundleCandidates } from './bundle-collect.mjs';
import { previewFiles } from './preview.mjs';
import { buildBundle } from './bundle-build.mjs';

/**
 * Publish a setup via gh CLI.
 * Supports optional bundle (--with-bundle).
 */
export async function publishViaGh(opts) {
  const {
    claudeHome, author, slug, title, description, tags,
    registryRepo,
    withBundle = false,
    bundlePicker = previewFiles,  // testing hook
    gh = runGh,
  } = opts;

  const collected = await collect(claudeHome);

  // Bundle assembly, if requested
  let bundleInfo = { present: false };
  let tempTarPath = null;
  if (withBundle) {
    const candidates = await collectBundleCandidates(claudeHome);
    const approved = await bundlePicker(candidates);
    if (approved.length > 0) {
      const tempDir = await mkdtemp(join(tmpdir(), 'cs-pub-'));
      tempTarPath = join(tempDir, `${slug}.tar.gz`);
      const homeDir = dirname(claudeHome);
      const built = await buildBundle(approved, tempTarPath, { homeDir });
      bundleInfo = {
        present: true,
        sha256: built.sha256,
        files: built.files,
      };
    }
  }

  const descriptor = buildDescriptor({
    author, slug, title, description, tags,
    plugins: collected.plugins,
    marketplaces: collected.marketplaces,
    mcpServers: collected.mcpServers,
  });
  // Inject bundle metadata after build (buildDescriptor sets { present: false } default)
  descriptor.bundle = bundleInfo;
  if (bundleInfo.present) {
    // Provide canonical bundle URL hint for gallery rendering
    descriptor.bundle.url =
      `https://${registryRepo.split('/')[0]}.github.io/${registryRepo.split('/')[1]}/bundles/${author}/${slug}.tar.gz`;
  }

  // Push bundle tarball to temp branch (if present)
  if (bundleInfo.present && tempTarPath) {
    const tempBranch = `bundle/${author}-${slug}-${Date.now()}`;
    // Read tarball bytes as base64
    const tarBytes = await readFile(tempTarPath);
    const base64 = tarBytes.toString('base64');

    // Create a blob, then a tree, then a commit, then a ref — using gh api
    // Simplified: we push a single-file commit to the temp branch.
    // The ingest Action then moves the file to data/bundles/ and deletes the branch.

    // 1. Get default branch HEAD sha (for parent)
    const headRes = await gh(
      ['api', `repos/${registryRepo}/git/refs/heads/main`, '--jq', '.object.sha'],
      {}
    );
    const parentSha = headRes.stdout.trim();

    // 2. Create blob
    const blobRes = await gh(
      [
        'api', `repos/${registryRepo}/git/blobs`,
        '-X', 'POST',
        '-f', `content=${base64}`,
        '-f', 'encoding=base64',
        '--jq', '.sha',
      ],
      {}
    );
    const blobSha = blobRes.stdout.trim();

    // 3. Create tree (with our bundle file placed at bundle-pending/<author>-<slug>.tar.gz)
    const treePath = `bundle-pending/${author}-${slug}.tar.gz`;
    const treeRes = await gh(
      [
        'api', `repos/${registryRepo}/git/trees`,
        '-X', 'POST',
        '-f', `base_tree=${parentSha}`,
        '-f', `tree[0][path]=${treePath}`,
        '-f', 'tree[0][mode]=100644',
        '-f', 'tree[0][type]=blob',
        '-f', `tree[0][sha]=${blobSha}`,
        '--jq', '.sha',
      ],
      {}
    );
    const treeSha = treeRes.stdout.trim();

    // 4. Create commit
    const commitRes = await gh(
      [
        'api', `repos/${registryRepo}/git/commits`,
        '-X', 'POST',
        '-f', `message=bundle pending for ${author}/${slug}`,
        '-f', `tree=${treeSha}`,
        '-f', `parents[]=${parentSha}`,
        '--jq', '.sha',
      ],
      {}
    );
    const commitSha = commitRes.stdout.trim();

    // 5. Create ref (the new branch)
    await gh(
      [
        'api', `repos/${registryRepo}/git/refs`,
        '-X', 'POST',
        '-f', `ref=refs/heads/${tempBranch}`,
        '-f', `sha=${commitSha}`,
      ],
      {}
    );

    // Reference the branch in descriptor metadata so the Action can find it
    descriptor.bundle.pendingBranch = tempBranch;

    // Clean up local staging
    await rm(dirname(tempTarPath), { recursive: true, force: true });
  }

  // Create the issue with the descriptor body
  const body = JSON.stringify(descriptor, null, 2);
  const result = await gh(
    [
      'issue', 'create',
      '--repo', registryRepo,
      '--title', `[setup] ${author}/${slug}: ${title}`,
      '--body', body,
      '--label', 'setup:submission',
    ],
    {}
  );
  if (result.code !== 0) {
    throw new Error(`gh issue create failed (exit ${result.code}): ${result.stderr}`);
  }
  const issueUrl = result.stdout.trim();
  return { status: 'ok', issueUrl, descriptor };
}

export function buildBrowserFallbackUrl(registryRepo, descriptor) {
  const base = `https://github.com/${registryRepo}/issues/new`;
  const params = new URLSearchParams({
    template: 'setup-submission.yml',
    descriptor: JSON.stringify(descriptor),
  });
  return `${base}?${params.toString()}`;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test 2>&1 | tail -5`
Expected: 2 new passing.

- [ ] **Step 5: Update CLI to accept --with-bundle flag**

Edit `/Users/adhenawer/Code/claude-setups/src/cli.mjs` — modify `cmdPublish`:
```js
async function cmdPublish(parsed) {
  const { title, description, tags, author, slug, 'registry-repo': registryRepo } = parsed.flags;
  const withBundle = Boolean(parsed.flags['with-bundle']);

  if (!title || !description || !tags || !author || !slug) {
    console.error('Error: publish requires --title, --description, --tags, --author, --slug');
    console.error('Optional: --with-bundle (include hooks, CLAUDE.md, skills with per-file review)');
    process.exit(1);
  }

  const { publishViaGh } = await import('./publish.mjs');
  const claudeHome = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
  const registry = registryRepo || 'adhenawer/claude-setups-registry';

  const result = await publishViaGh({
    claudeHome,
    author, slug, title, description,
    tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    registryRepo: registry,
    withBundle,
  });

  console.log(JSON.stringify({
    status: 'ok',
    issueUrl: result.issueUrl,
    slug, author,
    bundleFiles: result.descriptor.bundle?.files?.length || 0,
  }));
}
```

- [ ] **Step 6: Commit**

```bash
git add src/publish.mjs src/cli.mjs tests/publish.test.mjs
git commit -m "feat(v0.3): publishViaGh accepts --with-bundle; pushes bundle to temp branch via gh api; 2 new tests"
```

---

## Task 9: Mirror extension — fetch + extract bundle

**Files:**
- Modify: `/Users/adhenawer/Code/claude-setups/src/mirror.mjs`
- Modify: `/Users/adhenawer/Code/claude-setups/tests/mirror.test.mjs`

- [ ] **Step 1: Write failing test for bundle mirror**

Append to `/Users/adhenawer/Code/claude-setups/tests/mirror.test.mjs`:
```js
describe('mirror with bundle', () => {
  it('extracts bundle files into target claudeHome after install steps', async () => {
    const { mirror } = await import('../src/mirror.mjs');
    const { mkdtemp: _m, rm: _r, readFile: _rf, mkdir: _mk, writeFile: _wf } = await import('node:fs/promises');
    const { tmpdir: _t } = await import('node:os');
    const { join: _j } = await import('node:path');
    const tar = await import('tar');

    // Build a mock bundle + serve it via HTTP
    const dir = await _m(_j(_t(), 'cs-mir-bundle-'));
    try {
      const stage = _j(dir, 'stage');
      await _mk(stage, { recursive: true });
      await _mk(_j(stage, 'hooks'), { recursive: true });
      await _wf(_j(stage, 'hooks/a.sh'), '#!/bin/bash\necho bundled');
      await _wf(_j(stage, 'CLAUDE.md'), 'bundled md');
      const bundlePath = _j(dir, 'bundle.tar.gz');
      await tar.c({ gzip: true, file: bundlePath, cwd: stage }, ['hooks/a.sh', 'CLAUDE.md']);

      // Spin up two HTTP endpoints: descriptor.json and bundle.tar.gz
      const { createServer } = await import('node:http');
      const bundleBytes = await _rf(bundlePath);
      const descriptor = {
        schemaVersion: '1.0.0',
        id: { author: 'alice', slug: 'withbundle' },
        version: 1,
        title: 'T', description: 'D', tags: ['x'],
        author: { handle: 'alice', url: 'https://github.com/alice' },
        createdAt: '2026-04-19T00:00:00Z', license: 'MIT',
        plugins: [], marketplaces: [], mcpServers: [],
        bundle: { present: true, url: '', files: [] },
      };
      let serverUrl;
      await new Promise(resolvePromise => {
        const server = createServer((req, res) => {
          if (req.url.endsWith('.tar.gz')) {
            res.writeHead(200, { 'content-type': 'application/gzip' });
            res.end(bundleBytes);
          } else {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify(descriptor));
          }
        });
        server.listen(0, '127.0.0.1', () => {
          const port = server.address().port;
          serverUrl = `http://127.0.0.1:${port}`;
          descriptor.bundle.url = `${serverUrl}/bundle.tar.gz`;
          const claudeHome = _j(dir, '.claude');
          mirror(`${serverUrl}/descriptor.json`, {
            claudeHome,
            homeDir: dirname(claudeHome),
            listPlugins: async () => [],
            listMarketplaces: async () => [],
            listMcpServers: async () => [],
            marketplaceAdd: async () => {},
            pluginInstall: async () => {},
            mcpAdd: async () => {},
          }).then(async (r) => {
            server.close();
            assert.equal(r.status, 'ok');
            const hook = await _rf(_j(claudeHome, 'hooks/a.sh'), 'utf-8');
            assert.match(hook, /echo bundled/);
            resolvePromise();
          }).catch((e) => { server.close(); throw e; });
        });
      });
    } finally { await _r(dir, { recursive: true }); }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test 2>&1 | tail -8`
Expected: 1 failure (mirror doesn't yet fetch+extract bundle).

- [ ] **Step 3: Extend mirror.mjs**

Edit `/Users/adhenawer/Code/claude-setups/src/mirror.mjs` — add import + extend `mirror`:
```js
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { extractBundle } from './bundle-extract.mjs';
```

Replace the `export async function mirror` with:
```js
export async function mirror(urlOrId, options = {}) {
  const descriptor = await fetchDescriptor(options.url || urlOrId);
  const plan = await computePlan(descriptor, options);
  if (options.dryRun) return { status: 'plan', descriptor, plan };

  const execResult = await executePlan(plan, options);

  // Bundle extraction (if present)
  let bundleResult = null;
  if (descriptor.bundle?.present && descriptor.bundle?.url) {
    const res = await fetch(descriptor.bundle.url);
    if (!res.ok) {
      return {
        status: 'partial',
        descriptor, plan,
        successes: execResult.successes,
        failures: [...execResult.failures, { kind: 'bundle', name: 'download', error: `HTTP ${res.status}` }],
      };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const tempDir = await mkdtemp(join(tmpdir(), 'cs-mir-'));
    const tarPath = join(tempDir, 'bundle.tar.gz');
    try {
      await writeFile(tarPath, buf);
      const claudeHome = options.claudeHome || join(homedir(), '.claude');
      const homeDir = options.homeDir || dirname(claudeHome);
      bundleResult = await extractBundle(tarPath, claudeHome, { homeDir });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  return {
    status: execResult.ok ? 'ok' : 'partial',
    descriptor, plan,
    successes: execResult.successes,
    failures: execResult.failures,
    bundle: bundleResult,
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test 2>&1 | tail -5`
Expected: 1 new passing.

- [ ] **Step 5: Commit**

```bash
git add src/mirror.mjs tests/mirror.test.mjs
git commit -m "feat(v0.3): mirror fetches + extracts bundle into claudeHome with .bak on conflict; 1 round-trip test"
```

---

## Task 10: Registry ingest — move bundle from temp branch

**Files:**
- Modify: `/Users/adhenawer/Code/claude-setups-registry/scripts/ingest.mjs`
- Modify: `/Users/adhenawer/Code/claude-setups-registry/scripts/validate-descriptor.mjs`
- Modify: `/Users/adhenawer/Code/claude-setups-registry/.github/workflows/ingest.yml`
- Create: `/Users/adhenawer/Code/claude-setups-registry/scripts/tests/bundle-ingest.test.mjs`

- [ ] **Step 1: Write failing tests for validator bundle rules**

Create `/Users/adhenawer/Code/claude-setups-registry/scripts/tests/bundle-ingest.test.mjs`:
```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const BASE = {
  schemaVersion: '1.0.0',
  id: { author: 'alice', slug: 'demo' },
  version: 1,
  title: 'T', description: 'D', tags: ['x'],
  author: { handle: 'alice', url: 'https://github.com/alice' },
  createdAt: '2026-04-19T00:00:00Z', license: 'MIT',
  plugins: [], marketplaces: [], mcpServers: [],
};

describe('validate with bundle', () => {
  it('accepts bundle.present=false (no bundle fields needed)', async () => {
    const { validate } = await import('../validate-descriptor.mjs');
    assert.doesNotThrow(() => validate({ ...BASE, bundle: { present: false } }));
  });

  it('requires bundle.sha256, bundle.files, bundle.pendingBranch when present', async () => {
    const { validate } = await import('../validate-descriptor.mjs');
    assert.throws(() => validate({ ...BASE, bundle: { present: true } }), /bundle\.sha256|bundle\.files|pendingBranch/);
  });

  it('rejects bundle.files[] with absolute paths', async () => {
    const { validate } = await import('../validate-descriptor.mjs');
    assert.throws(() => validate({
      ...BASE,
      bundle: {
        present: true,
        sha256: 'x', pendingBranch: 'bundle/x',
        files: [{ path: '/etc/passwd', size: 1, sha256: 'x' }],
      },
    }), /absolute/i);
  });

  it('rejects bundle.files[] with ".." traversal', async () => {
    const { validate } = await import('../validate-descriptor.mjs');
    assert.throws(() => validate({
      ...BASE,
      bundle: {
        present: true,
        sha256: 'x', pendingBranch: 'bundle/x',
        files: [{ path: '../etc/passwd', size: 1, sha256: 'x' }],
      },
    }), /traversal|\.\./);
  });

  it('rejects bundle.files[] referencing settings.json or .claude.json', async () => {
    const { validate } = await import('../validate-descriptor.mjs');
    assert.throws(() => validate({
      ...BASE,
      bundle: {
        present: true,
        sha256: 'x', pendingBranch: 'bundle/x',
        files: [{ path: 'settings.json', size: 1, sha256: 'x' }],
      },
    }), /settings\.json/);

    assert.throws(() => validate({
      ...BASE,
      bundle: {
        present: true,
        sha256: 'x', pendingBranch: 'bundle/x',
        files: [{ path: '.claude.json', size: 1, sha256: 'x' }],
      },
    }), /\.claude\.json/);
  });

  it('accepts files under hooks/, skills/, commands/, agents/, and root *.md', async () => {
    const { validate } = await import('../validate-descriptor.mjs');
    assert.doesNotThrow(() => validate({
      ...BASE,
      bundle: {
        present: true, sha256: 'x', pendingBranch: 'bundle/x',
        files: [
          { path: 'hooks/a.sh', size: 1, sha256: 'a' },
          { path: 'CLAUDE.md', size: 1, sha256: 'b' },
          { path: 'skills/x/SKILL.md', size: 1, sha256: 'c' },
          { path: 'commands/y.md', size: 1, sha256: 'd' },
          { path: 'agents/z.md', size: 1, sha256: 'e' },
        ],
      },
    }));
  });

  it('rejects files outside allowed prefixes (e.g. projects/, docs/)', async () => {
    const { validate } = await import('../validate-descriptor.mjs');
    assert.throws(() => validate({
      ...BASE,
      bundle: {
        present: true, sha256: 'x', pendingBranch: 'bundle/x',
        files: [{ path: 'docs/anything.md', size: 1, sha256: 'x' }],
      },
    }), /allowed prefix|disallowed path/i);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd /Users/adhenawer/Code/claude-setups-registry && npm test 2>&1 | tail -5`
Expected: 7 failures (validator doesn't check bundle yet).

- [ ] **Step 3: Extend validate-descriptor.mjs**

Edit `/Users/adhenawer/Code/claude-setups-registry/scripts/validate-descriptor.mjs`:
```js
const ALLOWED_PREFIXES = ['hooks/', 'skills/', 'commands/', 'agents/'];

function isAllowedBundlePath(p) {
  // Root *.md is always allowed
  if (/^[a-z0-9_-]+\.md$/i.test(p)) return true;
  // Otherwise must start with an allowed prefix
  return ALLOWED_PREFIXES.some(prefix => p.startsWith(prefix));
}

function validateBundle(bundle) {
  if (!bundle || typeof bundle !== 'object') throw new Error('bundle must be an object');
  if (typeof bundle.present !== 'boolean') throw new Error('bundle.present must be boolean');
  if (!bundle.present) return;

  if (!bundle.sha256) throw new Error('bundle.sha256 required when present');
  if (!bundle.pendingBranch) throw new Error('bundle.pendingBranch required when present');
  if (!Array.isArray(bundle.files)) throw new Error('bundle.files must be array');

  for (const f of bundle.files) {
    if (!f.path) throw new Error('bundle.files[].path required');
    if (f.path.startsWith('/')) throw new Error(`bundle.files[]: absolute path rejected: ${f.path}`);
    if (f.path.includes('..')) throw new Error(`bundle.files[]: traversal rejected: ${f.path}`);
    if (f.path === 'settings.json' || f.path.startsWith('settings.')) {
      throw new Error(`bundle must NEVER include settings.json: ${f.path}`);
    }
    if (f.path === '.claude.json' || f.path.includes('/.claude.json')) {
      throw new Error(`bundle must NEVER include .claude.json: ${f.path}`);
    }
    if (!isAllowedBundlePath(f.path)) {
      throw new Error(`bundle.files[]: disallowed path (not under allowed prefix): ${f.path}`);
    }
  }
}
```

Also call `validateBundle(d.bundle)` inside the main `validate` function (after mcpServers check):
```js
  if (d.bundle) validateBundle(d.bundle);
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test 2>&1 | tail -5`
Expected: 7 new passing.

- [ ] **Step 5: Extend ingest.mjs to move bundle**

Edit `/Users/adhenawer/Code/claude-setups-registry/scripts/ingest.mjs`:
```js
import { mkdir, writeFile, rename, access, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { validate } from './validate-descriptor.mjs';

export async function ingestIssue({ dataRoot, issueBody, issueAuthor, aliases = {} }) {
  let descriptor;
  try {
    descriptor = JSON.parse(issueBody);
  } catch (e) {
    return { ok: false, reason: `invalid JSON in issue body: ${e.message}` };
  }
  try {
    validate(descriptor, { issueAuthor });
  } catch (e) {
    return { ok: false, reason: `validation: ${e.message}` };
  }

  descriptor.tags = descriptor.tags.map(t => aliases[t] || t);

  const setupDir = join(dataRoot, 'setups', descriptor.id.author);
  await mkdir(setupDir, { recursive: true });
  const setupPath = join(setupDir, `${descriptor.id.slug}.json`);
  await writeFile(setupPath, JSON.stringify(descriptor, null, 2));

  // Handle bundle move from the pending branch (the Action checked out the pending branch
  // and placed the file at bundle-pending/<author>-<slug>.tar.gz before calling us).
  if (descriptor.bundle?.present) {
    const bundleDir = join(dataRoot, 'bundles', descriptor.id.author);
    await mkdir(bundleDir, { recursive: true });
    const src = join('bundle-pending', `${descriptor.id.author}-${descriptor.id.slug}.tar.gz`);
    const dst = join(bundleDir, `${descriptor.id.slug}.tar.gz`);
    try {
      await access(src);
    } catch {
      return { ok: false, reason: `bundle file not found at ${src}` };
    }
    await rename(src, dst);
  }

  return { ok: true, path: setupPath, slug: descriptor.id.slug };
}
```

- [ ] **Step 6: Update ingest workflow — checkout pending branch if referenced**

Edit `/Users/adhenawer/Code/claude-setups-registry/.github/workflows/ingest.yml` — update the checkout step + add bundle fetch:
```yaml
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          fetch-depth: 0
      - name: Merge bundle-pending branch content if referenced
        env:
          ISSUE_BODY: ${{ github.event.issue.body }}
        run: |
          node -e "
          const body = process.env.ISSUE_BODY;
          try {
            const d = JSON.parse(body);
            if (d.bundle && d.bundle.present && d.bundle.pendingBranch) {
              console.log('BRANCH:' + d.bundle.pendingBranch);
            }
          } catch {}
          " | tee /tmp/branch.txt
          BRANCH=$(grep '^BRANCH:' /tmp/branch.txt | sed 's/^BRANCH://')
          if [ -n "$BRANCH" ]; then
            echo "Fetching bundle from $BRANCH"
            git fetch origin "$BRANCH"
            git checkout "origin/$BRANCH" -- bundle-pending/
          fi
```

After the existing "Run ingest" step, add a cleanup step:
```yaml
      - name: Delete pending bundle branch (on success)
        if: success()
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ISSUE_BODY: ${{ github.event.issue.body }}
        run: |
          BRANCH=$(node -e "
          try {
            const d = JSON.parse(process.env.ISSUE_BODY);
            if (d.bundle?.pendingBranch) console.log(d.bundle.pendingBranch);
          } catch {}
          ")
          if [ -n "$BRANCH" ]; then
            gh api -X DELETE "repos/${{ github.repository }}/git/refs/heads/$BRANCH" || true
          fi
```

- [ ] **Step 7: Commit**

```bash
cd /Users/adhenawer/Code/claude-setups-registry
git add scripts/ingest.mjs scripts/validate-descriptor.mjs scripts/tests/bundle-ingest.test.mjs .github/workflows/ingest.yml
git commit -m "feat(v0.3): bundle validation + move from pending branch + branch cleanup; 7 new validator tests"
```

---

## Task 11: Round-trip publish → mirror with bundle

**Files:**
- Create: `/Users/adhenawer/Code/claude-setups/tests/bundle-round-trip.test.mjs`

- [ ] **Step 1: Write the round-trip test**

Create `/Users/adhenawer/Code/claude-setups/tests/bundle-round-trip.test.mjs`:
```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { resolve, dirname as _d } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = _d(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, 'fixtures/fake-claude-home');

describe('bundle round-trip (publisher → mirror)', () => {
  it('publisher builds bundle → mirror extracts into target with .bak backups', async () => {
    const { collectBundleCandidates } = await import('../src/bundle-collect.mjs');
    const { buildBundle } = await import('../src/bundle-build.mjs');
    const { extractBundle } = await import('../src/bundle-extract.mjs');

    const dir = await mkdtemp(join(tmpdir(), 'cs-rt-'));
    try {
      // Publisher: collect + build
      const candidates = await collectBundleCandidates(FIXTURES);
      assert.ok(candidates.length > 0, 'fixtures should have bundle candidates');
      const outPath = join(dir, 'bundle.tar.gz');
      const built = await buildBundle(candidates, outPath, { homeDir: dirname(FIXTURES) });
      assert.ok(built.sha256);

      // Mirror: extract into target with one pre-existing file to trigger .bak
      const targetHome = join(dir, 'target');
      await mkdir(targetHome, { recursive: true });
      await writeFile(join(targetHome, 'CLAUDE.md'), 'OLD CONTENT');

      const result = await extractBundle(outPath, targetHome, { homeDir: dirname(targetHome) });

      // Verify .bak of CLAUDE.md
      const bak = await readFile(join(targetHome, 'CLAUDE.md.bak'), 'utf-8');
      assert.equal(bak, 'OLD CONTENT');
      const current = await readFile(join(targetHome, 'CLAUDE.md'), 'utf-8');
      assert.match(current, /Global instructions/, 'should have the fixture content now');

      // Verify hooks extracted + executable
      const hook = await readFile(join(targetHome, 'hooks/auto-stage.sh'), 'utf-8');
      assert.match(hook, /auto-staged/);

      // Skills extracted recursively
      const skill = await readFile(join(targetHome, 'skills/pr-review/SKILL.md'), 'utf-8');
      assert.match(skill, /pr-review/);

      // Check that no settings.json / .claude.json snuck in
      await assert.rejects(
        readFile(join(targetHome, 'settings.json'), 'utf-8'),
        /ENOENT/
      );
    } finally { await rm(dir, { recursive: true }); }
  });
});
```

- [ ] **Step 2: Run the round-trip**

Run: `cd /Users/adhenawer/Code/claude-setups && npm test 2>&1 | tail -5`
Expected: 1 new passing.

- [ ] **Step 3: Commit**

```bash
git add tests/bundle-round-trip.test.mjs
git commit -m "test(v0.3): bundle round-trip (collect → build → extract) with .bak verification and settings.json absence check"
```

---

## Task 12: Gallery — render bundle file list

**Files:**
- Modify: `/Users/adhenawer/Code/claude-setups-registry/site/setup.html`
- Modify: `/Users/adhenawer/Code/claude-setups-registry/site/build.mjs`

- [ ] **Step 1: Update setup.html**

In `/Users/adhenawer/Code/claude-setups-registry/site/setup.html`, before the `Descriptor` section, add:
```html
    <section>
      <h2>Bundle files</h2>
      %%BUNDLE_SECTION%%
    </section>
```

- [ ] **Step 2: Update build.mjs to render bundle section**

In `/Users/adhenawer/Code/claude-setups-registry/site/build.mjs`, add a helper + extend `renderDetail`:
```js
function renderBundleSection(d) {
  if (!d.bundle?.present || !d.bundle.files?.length) {
    return '<p>No bundle (descriptor-only setup — only plugin/marketplace/MCP identifiers).</p>';
  }
  const rows = d.bundle.files.map(f => `
    <tr>
      <td><code>${escapeHtml(f.path)}</code></td>
      <td>${f.size} bytes</td>
      <td><code>${f.sha256.slice(0, 12)}…</code></td>
    </tr>
  `).join('');
  const bundleUrl = `../../../bundles/${d.id.author}/${d.id.slug}.tar.gz`;
  return `
    <p>Download the bundle: <a href="${bundleUrl}">${d.id.slug}.tar.gz</a></p>
    <table>
      <thead><tr><th>path</th><th>size</th><th>sha256</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}
```

And in `renderDetail`, add the replacement:
```js
    .replace(/%%BUNDLE_SECTION%%/g, renderBundleSection(d));
```

- [ ] **Step 3: Smoke-build**

```bash
cd /Users/adhenawer/Code/claude-setups-registry
mkdir -p data/setups/smoke
cat > data/setups/smoke/demo.json <<'EOF'
{"schemaVersion":"1.0.0","id":{"author":"smoke","slug":"demo"},"version":1,"title":"T","description":"D","tags":["t"],"author":{"handle":"smoke","url":"https://github.com/smoke"},"createdAt":"2026-04-19T00:00:00Z","license":"MIT","plugins":[],"marketplaces":[],"mcpServers":[],"bundle":{"present":true,"sha256":"abc","files":[{"path":"hooks/a.sh","size":10,"sha256":"xyz"}]}}
EOF
node site/build.mjs
grep -c "hooks/a.sh" site-build/s/smoke/demo.html
rm -rf data/setups/smoke site-build
```
Expected: ≥ 1.

- [ ] **Step 4: Commit**

```bash
git add site/setup.html site/build.mjs
git commit -m "feat(gallery,v0.3): render bundle file list on detail page"
```

---

## Task 13: Release v0.3.0 + final docs

**Files:**
- Modify: `/Users/adhenawer/Code/claude-setups/README.md`
- Modify: `/Users/adhenawer/Code/claude-setups-registry/README.md`

- [ ] **Step 1: Update CLI README**

Replace status line in `/Users/adhenawer/Code/claude-setups/README.md`:
```markdown
> **Status:** v0.3.0 — publish (with optional `--with-bundle`), mirror (with bundle extraction), revoke. All three plans (v0.1, v0.2, v0.3) complete. Ready for npm publish.
```

- [ ] **Step 2: Add bundle example to How publishing works**

In `/Users/adhenawer/Code/claude-setups/README.md`, in "How publishing works" section, add:
```markdown
### With bundle (opt-in)

```bash
npx -y claude-setups publish --with-bundle \
  --author alice --slug my-setup \
  --title "My setup" --description "..." --tags py,backend
```

The `--with-bundle` flag triggers file-by-file interactive preview: you see each hook script, markdown file, skill, command, and agent; the tool runs a gitleaks regex scan and warns about suspicious content; you toggle include/exclude per file; nothing is uploaded until you type `publish` to confirm.

`settings.json`, `~/.claude.json`, and MCP `env` sections are architecturally unreachable — no code path exists to read them. You cannot leak what the tool cannot read.
```

- [ ] **Step 3: Final test run**

Run: `cd /Users/adhenawer/Code/claude-setups && npm test 2>&1 | tail -5`
Expected: all tests passing (v0.1 + v0.2 + v0.3 — approximately 100+ tests).

Run: `cd /Users/adhenawer/Code/claude-setups-registry && npm test 2>&1 | tail -5`
Expected: all registry tests passing (validator + ingest + revoke + bundle).

- [ ] **Step 4: Commit + publish to npm**

```bash
cd /Users/adhenawer/Code/claude-setups
git add README.md
git commit -m "release: v0.3.0 — bundles + gitleaks; all 3 plans complete; ready for npm publish"

# NOW the user wanted publishing. Confirm with them + run:
# npm publish --dry-run
# # review output
# npm publish --access public
```

⚠️ **Before running `npm publish` explicitly ask the user to confirm.** The user said publishing happens only after v0.1 + v0.2 + v0.3 are all done. This is the end of Plan 3, so ask:

> "All three plans are executed and committed. Tests green across all three repos. Ready to run `npm publish --access public` to release claude-setups@0.3.0? (yes/no)"

On `yes`, run `npm publish --dry-run` first, show the output, then run `npm publish --access public` for real.

- [ ] **Step 5: Announce**

On successful publish, report:
> "claude-setups@0.3.0 live on npm. Registry repo at github.com/adhenawer/claude-setups-registry. Gallery at https://adhenawer.github.io/claude-setups-registry/. Announce on Reddit / Discord / Twitter when ready."

---

## Self-review (already applied)

**Spec coverage:**
- ✅ Path normalization port → Task 1
- ✅ Bundle candidate collector with allowlisted dirs + NEVER settings.json → Task 3
- ✅ Gitleaks regex port with 13 curated patterns → Task 4
- ✅ Interactive file preview + include/exclude UX → Task 5
- ✅ Bundle builder (tar.create + sha256) → Task 6
- ✅ Bundle extractor (.bak, chmod, idempotent, traversal-safe) → Task 7
- ✅ Publish integration with --with-bundle + temp-branch transport → Task 8
- ✅ Mirror integration — fetch + extract bundle → Task 9
- ✅ Registry-side bundle validation + move from temp branch + cleanup → Task 10
- ✅ End-to-end round-trip test → Task 11
- ✅ Gallery rendering of bundle file list → Task 12
- ✅ Release v0.3.0 + npm publish (after explicit user confirm) → Task 13

**Placeholder scan:** no TBDs. All code complete.

**Type consistency:** `descriptor.bundle` shape in Task 8 (publish) matches Task 10 (server-side validator) and Task 12 (gallery render). `bundle.files[]` has `path`, `size`, `sha256` consistently. Extractor in Task 7 honors the allowlist enforced by validator in Task 10.

**Risk notes:**
- Task 8's gh api sequence for pushing the bundle to a branch (blob → tree → commit → ref) is standard but has several moving parts. If a step fails, the branch might be partially created; the user can manually delete it. In practice GitHub deletes orphan blobs on GC; branches persist until explicit DELETE.
- Task 10's ingest workflow fetches `origin/bundle/*` branch content into `bundle-pending/`. If the checkout step fails (branch missing, force-pushed elsewhere), the ingest reports failure and the issue stays open.
- Task 7's traversal check uses `path.relative` + `isAbsolute`. Could be hardened further with a prefix-check against `claudeHome` resolved absolute, but the allowlist already enforces this server-side (Task 10), so the extractor's check is defense-in-depth.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-19-claude-setups-v0.3-bundles-gitleaks.md`.

**Recommendation:** run in a new session AFTER v0.2 (Plan 2) has been fully executed. Use subagent-driven-development. This plan interacts with two git repos + npm publish + gitleaks TOML parsing — clean context per task is crucial.

**This is the final plan of the v1 series.** On successful completion of all 13 tasks here, v0.3.0 is ready for npm publish; claude-setups is live.
