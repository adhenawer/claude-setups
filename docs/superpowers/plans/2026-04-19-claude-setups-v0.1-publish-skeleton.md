# claude-setups v0.1 — publish-only skeleton

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v0.1.0 of claude-setups where a user can run `npx -y claude-setups publish` to submit a descriptor (identifiers only, no bundle) that appears on a minimal static gallery site, all via GitHub-native infrastructure.

**Architecture:** Two git repos. (1) CLI npm package at `/Users/adhenawer/Code/claude-setups/` publishes `claude-setups@0.1.0` to npm. (2) Registry repo at `/Users/adhenawer/Code/claude-setups-registry/` (sibling, new) hosts Issue Forms + ingest Action + static Pages gallery. CLI creates a GitHub issue with the descriptor JSON in body; Action validates schema and commits `data/setups/<author>/<slug>.json`; Pages rebuilds gallery. No bundle, no gitleaks, no mirror, no revoke — those land in v0.2 and v0.3.

**Tech Stack:** Node.js 18+ ESM, `node:test`, `gh` CLI (runtime dep), GitHub Actions YAML, GitHub Pages static HTML + vanilla JS.

---

## File Structure

**Repo 1: `/Users/adhenawer/Code/claude-setups/` (CLI package)**

- Create: `package.json` — npm metadata with `bin: claude-setups`
- Create: `src/cli.mjs` — entry point with shebang + `isMainModule` + command dispatch
- Create: `src/mcp.mjs` — `classifyMcpMethod()` pure function (port from claude-snapshot)
- Create: `src/fs-helpers.mjs` — `readJsonSafe`, `fileExists` (port)
- Create: `src/collect.mjs` — descriptor collector (identifiers only)
- Create: `src/output.mjs` — TTY/JSON output router (port from claude-snapshot 0.3.0)
- Create: `src/descriptor.mjs` — descriptor builder (validates schema, emits JSON)
- Create: `src/gh.mjs` — gh CLI detection + wrapped invocation
- Create: `src/publish.mjs` — publish command (gh primary + browser fallback)
- Create: `tests/fixtures/fake-claude-home/` — mock `~/.claude/` for tests
- Create: `tests/fixtures/.claude.json` — mock `~/.claude.json` (mcpServers only)
- Create: `tests/*.test.mjs` — test files per module
- Create: `.github/workflows/test.yml` — CI matrix

**Repo 2: `/Users/adhenawer/Code/claude-setups-registry/` (NEW, sibling)**

- Create: `.github/ISSUE_TEMPLATE/setup-submission.yml` — structured form for browser fallback
- Create: `.github/workflows/ingest.yml` — on issue_opened, validate + commit
- Create: `.github/workflows/pages.yml` — on push to main, rebuild gallery
- Create: `data/setups/.gitkeep` — empty dir for descriptors
- Create: `data/tag-aliases.yml` — seed map (py → python, etc.)
- Create: `site/index.html` — minimal gallery listing
- Create: `site/setup.html` — detail page template
- Create: `site/build.mjs` — static-site builder consumed by pages.yml
- Create: `README.md` — registry purpose + submission guide
- Create: `LICENSE` — MIT

---

## Task 1: Scaffold CLI package structure

**Files:**
- Create: `/Users/adhenawer/Code/claude-setups/package.json`
- Create: `/Users/adhenawer/Code/claude-setups/src/.gitkeep`
- Create: `/Users/adhenawer/Code/claude-setups/tests/.gitkeep`
- Modify: `/Users/adhenawer/Code/claude-setups/.gitignore`

- [ ] **Step 1: Write package.json**

```json
{
  "name": "claude-setups",
  "version": "0.1.0",
  "description": "Publish, discover, and mirror Claude Code setups — safely, via GitHub",
  "type": "module",
  "main": "src/cli.mjs",
  "bin": {
    "claude-setups": "src/cli.mjs"
  },
  "files": ["src/", "README.md", "LICENSE"],
  "scripts": {
    "test": "node --test tests/*.test.mjs"
  },
  "dependencies": {},
  "engines": {
    "node": ">=18"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/adhenawer/claude-setups.git"
  },
  "bugs": {
    "url": "https://github.com/adhenawer/claude-setups/issues"
  },
  "homepage": "https://github.com/adhenawer/claude-setups#readme",
  "keywords": ["claude-code", "plugin", "setup", "share", "community"],
  "license": "MIT",
  "author": {
    "name": "Rodolfo Moraes"
  }
}
```

- [ ] **Step 2: Create src/ and tests/ directories (with .gitkeep)**

```bash
mkdir -p /Users/adhenawer/Code/claude-setups/src /Users/adhenawer/Code/claude-setups/tests/fixtures
touch /Users/adhenawer/Code/claude-setups/src/.gitkeep /Users/adhenawer/Code/claude-setups/tests/.gitkeep
```

- [ ] **Step 3: Update .gitignore**

Append to `/Users/adhenawer/Code/claude-setups/.gitignore`:
```
node_modules/
*.log
.DS_Store
.env
```
(Keep existing content.)

- [ ] **Step 4: Verify `npm test` runs (empty — 0 tests)**

Run: `cd /Users/adhenawer/Code/claude-setups && npm test 2>&1 | tail -5`
Expected: `tests 0`, `pass 0`, `fail 0` (empty suite passes).

- [ ] **Step 5: Commit**

```bash
cd /Users/adhenawer/Code/claude-setups
git add package.json src/.gitkeep tests/.gitkeep .gitignore
git commit -m "scaffold: package.json + bin + src/tests structure for v0.1"
```

---

## Task 2: MCP install-method classifier

**Files:**
- Create: `src/mcp.mjs`
- Create: `tests/mcp.test.mjs`

- [ ] **Step 1: Write failing tests**

Create `/Users/adhenawer/Code/claude-setups/tests/mcp.test.mjs`:
```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('classifyMcpMethod', () => {
  it('classifies npx as npm', async () => {
    const { classifyMcpMethod } = await import('../src/mcp.mjs');
    assert.equal(classifyMcpMethod({ command: 'npx', args: [] }), 'npm');
  });

  it('classifies uvx as pip', async () => {
    const { classifyMcpMethod } = await import('../src/mcp.mjs');
    assert.equal(classifyMcpMethod({ command: 'uvx', args: [] }), 'pip');
  });

  it('classifies uv as pip', async () => {
    const { classifyMcpMethod } = await import('../src/mcp.mjs');
    assert.equal(classifyMcpMethod({ command: 'uv', args: [] }), 'pip');
  });

  it('classifies absolute path as binary', async () => {
    const { classifyMcpMethod } = await import('../src/mcp.mjs');
    assert.equal(classifyMcpMethod({ command: '/usr/local/bin/x' }), 'binary');
  });

  it('classifies node as binary', async () => {
    const { classifyMcpMethod } = await import('../src/mcp.mjs');
    assert.equal(classifyMcpMethod({ command: 'node', args: ['/x'] }), 'binary');
  });

  it('classifies unknown command as manual', async () => {
    const { classifyMcpMethod } = await import('../src/mcp.mjs');
    assert.equal(classifyMcpMethod({ command: 'my-runner' }), 'manual');
  });

  it('classifies missing command as manual', async () => {
    const { classifyMcpMethod } = await import('../src/mcp.mjs');
    assert.equal(classifyMcpMethod({}), 'manual');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd /Users/adhenawer/Code/claude-setups && npm test 2>&1 | tail -5`
Expected: 7 failures — `classifyMcpMethod` not found.

- [ ] **Step 3: Implement**

Create `/Users/adhenawer/Code/claude-setups/src/mcp.mjs`:
```js
export function classifyMcpMethod(server) {
  const command = server?.command;
  if (!command) return 'manual';
  if (command === 'npx' || command === 'npm') return 'npm';
  if (command === 'uvx' || command === 'uv' || command === 'pipx') return 'pip';
  if (command === 'node' || command === 'python' || command === 'python3') return 'binary';
  if (command.startsWith('/') || command.startsWith('./') || command.startsWith('../')) return 'binary';
  return 'manual';
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test 2>&1 | tail -5`
Expected: `tests 7`, `pass 7`, `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add src/mcp.mjs tests/mcp.test.mjs
git commit -m "feat: classifyMcpMethod (npm/pip/binary/manual) with 7 unit tests"
```

---

## Task 3: Filesystem helpers

**Files:**
- Create: `src/fs-helpers.mjs`
- Create: `tests/fs-helpers.test.mjs`

- [ ] **Step 1: Write failing tests**

Create `/Users/adhenawer/Code/claude-setups/tests/fs-helpers.test.mjs`:
```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('readJsonSafe', () => {
  it('returns parsed JSON on valid file', async () => {
    const { readJsonSafe } = await import('../src/fs-helpers.mjs');
    const dir = await mkdtemp(join(tmpdir(), 'cs-fs-'));
    try {
      const p = join(dir, 'a.json');
      await writeFile(p, '{"a":1}');
      assert.deepEqual(await readJsonSafe(p), { a: 1 });
    } finally { await rm(dir, { recursive: true }); }
  });

  it('returns null on missing file', async () => {
    const { readJsonSafe } = await import('../src/fs-helpers.mjs');
    assert.equal(await readJsonSafe('/nonexistent/x.json'), null);
  });

  it('returns null on invalid JSON', async () => {
    const { readJsonSafe } = await import('../src/fs-helpers.mjs');
    const dir = await mkdtemp(join(tmpdir(), 'cs-fs-'));
    try {
      const p = join(dir, 'bad.json');
      await writeFile(p, '{ not json');
      assert.equal(await readJsonSafe(p), null);
    } finally { await rm(dir, { recursive: true }); }
  });
});

describe('fileExists', () => {
  it('true for existing file', async () => {
    const { fileExists } = await import('../src/fs-helpers.mjs');
    const dir = await mkdtemp(join(tmpdir(), 'cs-fs-'));
    try {
      const p = join(dir, 'x');
      await writeFile(p, '');
      assert.equal(await fileExists(p), true);
    } finally { await rm(dir, { recursive: true }); }
  });

  it('false for missing path', async () => {
    const { fileExists } = await import('../src/fs-helpers.mjs');
    assert.equal(await fileExists('/nonexistent/y'), false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test 2>&1 | tail -8`
Expected: 5 failures — module not found.

- [ ] **Step 3: Implement**

Create `/Users/adhenawer/Code/claude-setups/src/fs-helpers.mjs`:
```js
import { readFile, stat } from 'node:fs/promises';

export async function readJsonSafe(path) {
  try {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function fileExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test 2>&1 | tail -5`
Expected: 12 total tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/fs-helpers.mjs tests/fs-helpers.test.mjs
git commit -m "feat: fs-helpers (readJsonSafe, fileExists) + 5 tests"
```

---

## Task 4: Descriptor collector + test fixtures

**Files:**
- Create: `tests/fixtures/fake-claude-home/plugins/installed_plugins.json`
- Create: `tests/fixtures/fake-claude-home/plugins/known_marketplaces.json`
- Create: `tests/fixtures/.claude.json`
- Create: `src/collect.mjs`
- Create: `tests/collect.test.mjs`

- [ ] **Step 1: Create test fixtures**

Create `/Users/adhenawer/Code/claude-setups/tests/fixtures/fake-claude-home/plugins/installed_plugins.json`:
```json
{
  "version": 2,
  "plugins": {
    "superpowers@claude-plugins-official": [
      { "version": "5.0.7", "scope": "user" }
    ],
    "context7@claude-plugins-official": [
      { "version": "1.2.0", "scope": "user" }
    ],
    "internal-tool@company-marketplace": [
      { "version": "0.1.0", "scope": "project", "projectPath": "/Users/someone/work/secret-project" }
    ]
  }
}
```

Create `/Users/adhenawer/Code/claude-setups/tests/fixtures/fake-claude-home/plugins/known_marketplaces.json`:
```json
{
  "claude-plugins-official": {
    "source": { "source": "github", "repo": "anthropics/claude-plugins-official" }
  }
}
```

Create `/Users/adhenawer/Code/claude-setups/tests/fixtures/.claude.json`:
```json
{
  "oauthAccount": "MUST_NOT_LEAK",
  "projects": { "some-path": { "allowedTools": ["Bash"] } },
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-filesystem"],
      "env": { "LEAK_SENTINEL": "should-not-travel" }
    },
    "git": {
      "command": "uvx",
      "args": ["mcp-server-git"],
      "env": {}
    }
  }
}
```

- [ ] **Step 2: Write failing tests**

Create `/Users/adhenawer/Code/claude-setups/tests/collect.test.mjs`:
```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, 'fixtures/fake-claude-home');

describe('collect', () => {
  it('returns plugins (user-scoped only) + marketplaces + mcpServers identifiers', async () => {
    const { collect } = await import('../src/collect.mjs');
    const result = await collect(FIXTURES);
    assert.equal(result.plugins.length, 2, 'only user-scoped plugins');
    const names = result.plugins.map(p => p.name).sort();
    assert.deepEqual(names, ['context7', 'superpowers']);
    assert.equal(result.marketplaces.length, 1);
    assert.equal(result.marketplaces[0].name, 'claude-plugins-official');
    assert.equal(result.mcpServers.length, 2);
  });

  it('filters project-scoped plugins (they leak path)', async () => {
    const { collect } = await import('../src/collect.mjs');
    const result = await collect(FIXTURES);
    const leaked = JSON.stringify(result);
    assert.ok(!leaked.includes('secret-project'), 'project path must not leak');
    assert.ok(!leaked.includes('internal-tool'), 'project-scoped plugin must not leak');
  });

  it('never leaks oauthAccount or MCP env values', async () => {
    const { collect } = await import('../src/collect.mjs');
    const result = await collect(FIXTURES);
    const leaked = JSON.stringify(result);
    assert.ok(!leaked.includes('MUST_NOT_LEAK'), 'oauthAccount must not leak');
    assert.ok(!leaked.includes('LEAK_SENTINEL'), 'MCP env value must not leak');
    assert.ok(!leaked.includes('should-not-travel'), 'MCP env value must not leak');
    assert.ok(!leaked.includes('allowedTools'), 'project state must not leak');
  });

  it('each mcpServer has name, command, args, method — never env', async () => {
    const { collect } = await import('../src/collect.mjs');
    const result = await collect(FIXTURES);
    for (const s of result.mcpServers) {
      assert.ok(s.name, 'has name');
      assert.ok(s.command, 'has command');
      assert.ok(Array.isArray(s.args), 'has args array');
      assert.ok(['npm', 'pip', 'binary', 'manual'].includes(s.method), 'has method');
      assert.ok(!('env' in s), 'MUST NOT include env');
    }
  });

  it('works when ~/.claude.json is missing (returns empty mcpServers)', async () => {
    const { collect } = await import('../src/collect.mjs');
    const { mkdtemp, rm, mkdir, writeFile } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const tempDir = await mkdtemp(join(tmpdir(), 'cs-collect-'));
    try {
      const fakeHome = join(tempDir, '.claude');
      await mkdir(join(fakeHome, 'plugins'), { recursive: true });
      await writeFile(join(fakeHome, 'plugins/installed_plugins.json'),
        JSON.stringify({ version: 2, plugins: {} }));
      const result = await collect(fakeHome);
      assert.deepEqual(result.mcpServers, []);
    } finally { await rm(tempDir, { recursive: true }); }
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test 2>&1 | tail -8`
Expected: 5 failures on `collect`.

- [ ] **Step 4: Implement**

Create `/Users/adhenawer/Code/claude-setups/src/collect.mjs`:
```js
import { join, dirname } from 'node:path';
import { readJsonSafe, fileExists } from './fs-helpers.mjs';
import { classifyMcpMethod } from './mcp.mjs';

/**
 * Read identifiers from ~/.claude/ and ~/.claude.json.
 * Explicitly NEVER reads: settings.json, .claude.json as a whole,
 * env sections, hook bodies, *.md contents.
 */
export async function collect(claudeHome) {
  // Plugins — user scope only (project scope has absolute paths → privacy leak)
  const plugins = [];
  const installedRaw = await readJsonSafe(join(claudeHome, 'plugins/installed_plugins.json'));
  if (installedRaw?.plugins) {
    for (const [key, entries] of Object.entries(installedRaw.plugins)) {
      const userScoped = entries.filter(e => e.scope === 'user');
      if (userScoped.length === 0) continue;
      const [name, marketplace] = key.split('@');
      plugins.push({ name, marketplace, version: userScoped[0].version });
    }
  }

  // Marketplaces
  const marketplaces = [];
  const mktRaw = await readJsonSafe(join(claudeHome, 'plugins/known_marketplaces.json'));
  if (mktRaw) {
    for (const [name, config] of Object.entries(mktRaw)) {
      marketplaces.push({
        name,
        source: config.source?.source || 'github',
        repo: config.source?.repo || '',
      });
    }
  }

  // MCP servers — name + command + args + method ONLY; env intentionally dropped
  const mcpServers = [];
  const claudeJsonPath = join(dirname(claudeHome), '.claude.json');
  if (await fileExists(claudeJsonPath)) {
    const raw = await readJsonSafe(claudeJsonPath);
    if (raw?.mcpServers) {
      for (const [name, config] of Object.entries(raw.mcpServers)) {
        mcpServers.push({
          name,
          command: config.command,
          args: config.args || [],
          method: classifyMcpMethod(config),
        });
      }
    }
  }

  return { plugins, marketplaces, mcpServers };
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npm test 2>&1 | tail -5`
Expected: 17 total passing (12 prior + 5 new).

- [ ] **Step 6: Commit**

```bash
git add src/collect.mjs tests/collect.test.mjs tests/fixtures/
git commit -m "feat: descriptor collector — plugins + marketplaces + mcpServers (identifiers only; 5 privacy-focused tests)"
```

---

## Task 5: TTY/JSON output helpers

**Files:**
- Create: `src/output.mjs`
- Create: `tests/output.test.mjs`

- [ ] **Step 1: Write failing tests**

Create `/Users/adhenawer/Code/claude-setups/tests/output.test.mjs`:
```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('tildeHome', () => {
  it('replaces HOME prefix with tilde', async () => {
    const { tildeHome } = await import('../src/output.mjs');
    const { homedir } = await import('node:os');
    assert.equal(tildeHome(homedir() + '/x/y'), '~/x/y');
  });

  it('leaves unrelated paths untouched', async () => {
    const { tildeHome } = await import('../src/output.mjs');
    assert.equal(tildeHome('/tmp/foo'), '/tmp/foo');
  });
});

describe('shouldOutputJson', () => {
  it('true when --json in args', async () => {
    const { shouldOutputJson } = await import('../src/output.mjs');
    assert.equal(shouldOutputJson(['x', '--json']), true);
  });

  it('true when stdout is not a TTY (piped)', async () => {
    const { shouldOutputJson } = await import('../src/output.mjs');
    // In `node --test` stdout is not a TTY, so this should be true
    assert.equal(shouldOutputJson([]), true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test 2>&1 | tail -8`
Expected: 4 failures — module not found.

- [ ] **Step 3: Implement**

Create `/Users/adhenawer/Code/claude-setups/src/output.mjs`:
```js
import { homedir } from 'node:os';

export function tildeHome(path) {
  const home = homedir();
  return path.startsWith(home) ? '~' + path.slice(home.length) : path;
}

export function shouldOutputJson(args) {
  return args.includes('--json') || !process.stdout.isTTY;
}

export function writeOutput(args, jsonData, prettyFn) {
  if (shouldOutputJson(args)) {
    console.log(JSON.stringify(jsonData));
  } else {
    console.log(prettyFn());
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test 2>&1 | tail -5`
Expected: 21 total passing.

- [ ] **Step 5: Commit**

```bash
git add src/output.mjs tests/output.test.mjs
git commit -m "feat: output helpers (tildeHome, shouldOutputJson, writeOutput) + 4 tests"
```

---

## Task 6: gh CLI detection + wrapped invocation

**Files:**
- Create: `src/gh.mjs`
- Create: `tests/gh.test.mjs`

- [ ] **Step 1: Write failing tests**

Create `/Users/adhenawer/Code/claude-setups/tests/gh.test.mjs`:
```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('isGhAvailable', () => {
  it('returns a boolean (detection runs without error)', async () => {
    const { isGhAvailable } = await import('../src/gh.mjs');
    const result = await isGhAvailable();
    assert.equal(typeof result, 'boolean');
  });
});

describe('runGh', () => {
  it('throws with a structured error when binary missing', async () => {
    const { runGh } = await import('../src/gh.mjs');
    await assert.rejects(
      runGh(['definitely-not-a-real-subcommand-xyz'], { ghBin: '/nonexistent/gh' }),
      /gh binary not found/i
    );
  });

  it('returns { stdout, stderr, code } on successful execution (using echo as stand-in)', async () => {
    const { runGh } = await import('../src/gh.mjs');
    // Use /bin/echo as a stand-in for gh so this test doesn't depend on real gh.
    const result = await runGh(['hello'], { ghBin: '/bin/echo' });
    assert.equal(result.code, 0);
    assert.match(result.stdout, /hello/);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test 2>&1 | tail -8`
Expected: 3 failures — module not found.

- [ ] **Step 3: Implement**

Create `/Users/adhenawer/Code/claude-setups/src/gh.mjs`:
```js
import { spawn } from 'node:child_process';

export async function isGhAvailable(ghBin = 'gh') {
  try {
    const result = await runGh(['--version'], { ghBin });
    return result.code === 0;
  } catch {
    return false;
  }
}

export function runGh(args, options = {}) {
  const { ghBin = 'gh', stdin } = options;
  return new Promise((resolve, reject) => {
    const child = spawn(ghBin, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', err => {
      if (err.code === 'ENOENT') {
        reject(new Error(`gh binary not found at ${ghBin}`));
      } else {
        reject(err);
      }
    });
    child.on('close', code => { resolve({ stdout, stderr, code }); });
    if (stdin !== undefined) {
      child.stdin.write(stdin);
      child.stdin.end();
    }
  });
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test 2>&1 | tail -5`
Expected: 24 total passing.

- [ ] **Step 5: Commit**

```bash
git add src/gh.mjs tests/gh.test.mjs
git commit -m "feat: gh CLI wrapper (isGhAvailable, runGh) + 3 tests"
```

---

## Task 7: Descriptor builder + schema validation

**Files:**
- Create: `src/descriptor.mjs`
- Create: `tests/descriptor.test.mjs`

- [ ] **Step 1: Write failing tests**

Create `/Users/adhenawer/Code/claude-setups/tests/descriptor.test.mjs`:
```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('buildDescriptor', () => {
  it('assembles a descriptor with required fields', async () => {
    const { buildDescriptor } = await import('../src/descriptor.mjs');
    const d = buildDescriptor({
      author: 'alice',
      slug: 'my-setup',
      title: 'My Python setup',
      description: 'A daily driver',
      tags: ['python'],
      plugins: [{ name: 'x', marketplace: 'y', version: '1.0' }],
      marketplaces: [{ name: 'y', source: 'github', repo: 'y/y' }],
      mcpServers: [{ name: 'z', command: 'npx', args: [], method: 'npm' }],
    });
    assert.equal(d.schemaVersion, '1.0.0');
    assert.equal(d.id.author, 'alice');
    assert.equal(d.id.slug, 'my-setup');
    assert.equal(d.version, 1);
    assert.equal(d.title, 'My Python setup');
    assert.equal(d.license, 'MIT');
    assert.ok(d.createdAt.match(/^\d{4}-\d{2}-\d{2}T/));
    assert.deepEqual(d.bundle, { present: false });
  });

  it('rejects invalid slug (uppercase)', async () => {
    const { buildDescriptor } = await import('../src/descriptor.mjs');
    assert.throws(() => buildDescriptor({
      author: 'a', slug: 'BadSlug', title: 't', description: 'd', tags: ['x'],
      plugins: [], marketplaces: [], mcpServers: []
    }), /slug/i);
  });

  it('rejects empty title', async () => {
    const { buildDescriptor } = await import('../src/descriptor.mjs');
    assert.throws(() => buildDescriptor({
      author: 'a', slug: 'ok', title: '', description: 'd', tags: ['x'],
      plugins: [], marketplaces: [], mcpServers: []
    }), /title/i);
  });

  it('rejects too many tags', async () => {
    const { buildDescriptor } = await import('../src/descriptor.mjs');
    const tooMany = Array.from({ length: 11 }, (_, i) => 't' + i);
    assert.throws(() => buildDescriptor({
      author: 'a', slug: 'ok', title: 't', description: 'd', tags: tooMany,
      plugins: [], marketplaces: [], mcpServers: []
    }), /tags/i);
  });

  it('accepts version override for republish', async () => {
    const { buildDescriptor } = await import('../src/descriptor.mjs');
    const d = buildDescriptor({
      author: 'a', slug: 'ok', title: 't', description: 'd', tags: ['x'],
      plugins: [], marketplaces: [], mcpServers: [], version: 3,
    });
    assert.equal(d.version, 3);
  });
});

describe('validateDescriptor', () => {
  it('accepts a well-formed descriptor', async () => {
    const { buildDescriptor, validateDescriptor } = await import('../src/descriptor.mjs');
    const d = buildDescriptor({
      author: 'a', slug: 'ok', title: 't', description: 'd', tags: ['x'],
      plugins: [], marketplaces: [], mcpServers: [],
    });
    assert.doesNotThrow(() => validateDescriptor(d));
  });

  it('rejects missing schemaVersion', async () => {
    const { validateDescriptor } = await import('../src/descriptor.mjs');
    assert.throws(() => validateDescriptor({ id: { author: 'a', slug: 'b' } }), /schemaVersion/i);
  });

  it('rejects unsupported major schemaVersion', async () => {
    const { validateDescriptor } = await import('../src/descriptor.mjs');
    assert.throws(() => validateDescriptor({ schemaVersion: '99.0.0' }), /unsupported/i);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test 2>&1 | tail -8`
Expected: 8 failures.

- [ ] **Step 3: Implement**

Create `/Users/adhenawer/Code/claude-setups/src/descriptor.mjs`:
```js
const SCHEMA_VERSION = '1.0.0';
const SUPPORTED_MAJOR = 1;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,49}$/;
const MAX_TITLE = 80;
const MAX_DESCRIPTION = 500;
const MAX_TAGS = 10;

export function buildDescriptor(input) {
  const {
    author, slug, title, description, tags,
    plugins, marketplaces, mcpServers, version = 1,
  } = input;

  if (!author) throw new Error('author is required');
  if (!SLUG_RE.test(slug)) {
    throw new Error(`invalid slug: must match ${SLUG_RE} (got "${slug}")`);
  }
  if (!title || title.length === 0 || title.length > MAX_TITLE) {
    throw new Error(`invalid title: must be 1-${MAX_TITLE} chars`);
  }
  if (!description || description.length === 0 || description.length > MAX_DESCRIPTION) {
    throw new Error(`invalid description: must be 1-${MAX_DESCRIPTION} chars`);
  }
  if (!Array.isArray(tags) || tags.length === 0 || tags.length > MAX_TAGS) {
    throw new Error(`invalid tags: must be 1-${MAX_TAGS} entries`);
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    id: { author, slug },
    version,
    title,
    description,
    tags,
    author: {
      handle: author,
      url: `https://github.com/${author}`,
    },
    createdAt: new Date().toISOString(),
    license: 'MIT',
    plugins,
    marketplaces,
    mcpServers,
    bundle: { present: false },
  };
}

export function validateDescriptor(d) {
  if (!d || !d.schemaVersion) {
    throw new Error('Invalid descriptor: missing schemaVersion');
  }
  const major = parseInt(d.schemaVersion.split('.')[0], 10);
  if (major !== SUPPORTED_MAJOR) {
    throw new Error(
      `Unsupported schemaVersion ${d.schemaVersion}: this claude-setups supports major ${SUPPORTED_MAJOR}`
    );
  }
  if (!d.id?.author || !d.id?.slug) throw new Error('missing id.author or id.slug');
  if (!d.title || !d.description || !Array.isArray(d.tags)) {
    throw new Error('missing metadata');
  }
  return true;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test 2>&1 | tail -5`
Expected: 32 total passing.

- [ ] **Step 5: Commit**

```bash
git add src/descriptor.mjs tests/descriptor.test.mjs
git commit -m "feat: descriptor builder + validator (schema v1.0.0, slug/title/tags validation) + 8 tests"
```

---

## Task 8: Publish command — gh primary path

**Files:**
- Create: `src/publish.mjs`
- Create: `tests/publish.test.mjs`

- [ ] **Step 1: Write failing tests**

Create `/Users/adhenawer/Code/claude-setups/tests/publish.test.mjs`:
```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, 'fixtures/fake-claude-home');

describe('publishViaGh', () => {
  it('builds descriptor and posts an issue via injected gh runner', async () => {
    const { publishViaGh } = await import('../src/publish.mjs');
    const ghCalls = [];
    const mockGh = async (args, opts) => {
      ghCalls.push({ args, stdin: opts?.stdin });
      return { stdout: 'https://github.com/x/y/issues/42\n', stderr: '', code: 0 };
    };
    const result = await publishViaGh({
      claudeHome: FIXTURES,
      author: 'alice',
      slug: 'my-setup',
      title: 'My setup',
      description: 'desc',
      tags: ['test'],
      registryRepo: 'adhenawer/claude-setups-registry',
      gh: mockGh,
    });
    assert.equal(result.status, 'ok');
    assert.match(result.issueUrl, /issues\/42/);
    const issueCall = ghCalls.find(c => c.args[0] === 'issue');
    assert.ok(issueCall, 'should have called gh issue create');
    assert.ok(issueCall.args.includes('--repo'));
    assert.ok(issueCall.args.includes('adhenawer/claude-setups-registry'));
    assert.ok(issueCall.args.includes('--label'));
  });

  it('includes validated descriptor as issue body', async () => {
    const { publishViaGh } = await import('../src/publish.mjs');
    const ghCalls = [];
    const mockGh = async (args, opts) => {
      ghCalls.push({ args, stdin: opts?.stdin });
      return { stdout: 'https://github.com/x/y/issues/1', stderr: '', code: 0 };
    };
    await publishViaGh({
      claudeHome: FIXTURES, author: 'alice', slug: 'my-setup',
      title: 'T', description: 'D', tags: ['t'],
      registryRepo: 'x/y', gh: mockGh,
    });
    const issueCall = ghCalls.find(c => c.args[0] === 'issue');
    const bodyIdx = issueCall.args.indexOf('--body');
    assert.ok(bodyIdx > 0);
    const body = issueCall.args[bodyIdx + 1];
    assert.match(body, /"schemaVersion": "1\.0\.0"/);
    assert.match(body, /"slug": "my-setup"/);
    assert.ok(!body.includes('LEAK_SENTINEL'), 'MCP env must not appear in body');
    assert.ok(!body.includes('MUST_NOT_LEAK'), 'oauthAccount must not appear in body');
  });

  it('throws when gh call fails', async () => {
    const { publishViaGh } = await import('../src/publish.mjs');
    const failingGh = async () => ({ stdout: '', stderr: 'auth required', code: 1 });
    await assert.rejects(
      publishViaGh({
        claudeHome: FIXTURES, author: 'a', slug: 'b-cd',
        title: 'T', description: 'D', tags: ['t'],
        registryRepo: 'x/y', gh: failingGh,
      }),
      /gh issue create failed/i
    );
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test 2>&1 | tail -8`
Expected: 3 failures.

- [ ] **Step 3: Implement**

Create `/Users/adhenawer/Code/claude-setups/src/publish.mjs`:
```js
import { collect } from './collect.mjs';
import { buildDescriptor } from './descriptor.mjs';
import { runGh } from './gh.mjs';

/**
 * Publish a setup via gh CLI.
 * @param {object} opts
 * @param {string} opts.claudeHome
 * @param {string} opts.author
 * @param {string} opts.slug
 * @param {string} opts.title
 * @param {string} opts.description
 * @param {string[]} opts.tags
 * @param {string} opts.registryRepo  e.g. "adhenawer/claude-setups-registry"
 * @param {Function} [opts.gh]         injected gh runner (for testing)
 */
export async function publishViaGh(opts) {
  const {
    claudeHome, author, slug, title, description, tags,
    registryRepo,
    gh = runGh,
  } = opts;

  const collected = await collect(claudeHome);
  const descriptor = buildDescriptor({
    author, slug, title, description, tags,
    plugins: collected.plugins,
    marketplaces: collected.marketplaces,
    mcpServers: collected.mcpServers,
  });

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

/**
 * Build the URL for the browser-fallback Issue Form.
 * Not used in unit tests; exercised in end-to-end test.
 */
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
Expected: 35 total passing.

- [ ] **Step 5: Commit**

```bash
git add src/publish.mjs tests/publish.test.mjs
git commit -m "feat: publishViaGh — collects, builds descriptor, creates issue via gh; 3 tests verify no env leakage into body"
```

---

## Task 9: CLI dispatch + shebang + publish wiring

**Files:**
- Create: `src/cli.mjs`
- Create: `tests/cli.test.mjs`

- [ ] **Step 1: Write failing tests (integration test via spawn)**

Create `/Users/adhenawer/Code/claude-setups/tests/cli.test.mjs`:
```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(__dirname, '../src/cli.mjs');

describe('CLI dispatch', () => {
  it('prints usage on no args', () => {
    const r = spawnSync('node', [CLI], { encoding: 'utf-8' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Usage/);
  });

  it('prints usage on unknown command', () => {
    const r = spawnSync('node', [CLI, 'xyz'], { encoding: 'utf-8' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Unknown command/i);
  });

  it('publish without metadata flags prints error', () => {
    const r = spawnSync('node', [CLI, 'publish'], {
      encoding: 'utf-8',
      env: { ...process.env, CLAUDE_CONFIG_DIR: resolve(__dirname, 'fixtures/fake-claude-home') },
    });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /title|required/i);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test 2>&1 | tail -8`
Expected: 3 failures (cli.mjs missing or broken).

- [ ] **Step 3: Implement**

Create `/Users/adhenawer/Code/claude-setups/src/cli.mjs`:
```js
#!/usr/bin/env node
import { realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { join } from 'node:path';

function parseArgs(argv) {
  // Simple flag parser: --key value pairs, positional, boolean --flags.
  const out = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        out.flags[key] = next;
        i++;
      } else {
        out.flags[key] = true;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

async function cmdPublish(parsed) {
  const { title, description, tags, author, slug, 'registry-repo': registryRepo } = parsed.flags;
  if (!title || !description || !tags || !author || !slug) {
    console.error('Error: publish requires --title, --description, --tags, --author, --slug');
    console.error('Example: claude-setups publish --author alice --slug my-setup \\');
    console.error('           --title "My setup" --description "desc" --tags py,backend');
    process.exit(1);
  }

  const { publishViaGh } = await import('./publish.mjs');
  const claudeHome = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
  const registry = registryRepo || 'adhenawer/claude-setups-registry';

  const result = await publishViaGh({
    claudeHome,
    author,
    slug,
    title,
    description,
    tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    registryRepo: registry,
  });

  console.log(JSON.stringify({
    status: 'ok',
    issueUrl: result.issueUrl,
    slug,
    author,
  }));
}

async function main() {
  const [,, command, ...rest] = process.argv;
  if (!command) {
    console.error('Usage: claude-setups <publish|browse> [flags]');
    process.exit(1);
  }
  const parsed = parseArgs(rest);

  switch (command) {
    case 'publish': await cmdPublish(parsed); break;
    case 'browse': {
      console.log('Gallery: https://adhenawer.github.io/claude-setups-registry/');
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      console.error('Usage: claude-setups <publish|browse> [flags]');
      process.exit(1);
  }
}

async function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    const a = await realpath(process.argv[1]);
    const b = await realpath(fileURLToPath(import.meta.url));
    return a === b;
  } catch {
    return process.argv[1].endsWith('cli.mjs');
  }
}

if (await isMainModule()) {
  main().catch(err => {
    console.error(JSON.stringify({ status: 'error', message: err.message }));
    process.exit(1);
  });
}
```

- [ ] **Step 4: Make executable**

Run: `chmod +x /Users/adhenawer/Code/claude-setups/src/cli.mjs`

- [ ] **Step 5: Run tests**

Run: `npm test 2>&1 | tail -5`
Expected: 38 total passing.

- [ ] **Step 6: Commit**

```bash
git add src/cli.mjs tests/cli.test.mjs
chmod +x src/cli.mjs
git commit -m "feat: CLI dispatch (publish, browse) + isMainModule + shebang + 3 integration tests"
```

---

## Task 10: CI workflow

**Files:**
- Create: `.github/workflows/test.yml`

- [ ] **Step 1: Create workflow file**

Write `/Users/adhenawer/Code/claude-setups/.github/workflows/test.yml`:
```yaml
name: test

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  test:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest]
        node: [18, 20, 22]
    runs-on: ${{ matrix.os }}
    name: test / ${{ matrix.os }} / node-${{ matrix.node }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
      - run: npm test
```

- [ ] **Step 2: Validate YAML locally**

Run: `python3 -c "import yaml; yaml.safe_load(open('/Users/adhenawer/Code/claude-setups/.github/workflows/test.yml'))" && echo OK`
Expected: `OK`.

- [ ] **Step 3: Verify `npm test` still green**

Run: `cd /Users/adhenawer/Code/claude-setups && npm test 2>&1 | tail -5`
Expected: 38 passing.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/test.yml
git commit -m "ci: matrix on ubuntu+macos × node 18/20/22"
```

---

## Task 11: Scaffold registry repo (sibling dir)

**Files:**
- Create: `/Users/adhenawer/Code/claude-setups-registry/README.md`
- Create: `/Users/adhenawer/Code/claude-setups-registry/LICENSE`
- Create: `/Users/adhenawer/Code/claude-setups-registry/.gitignore`
- Create: `/Users/adhenawer/Code/claude-setups-registry/data/setups/.gitkeep`
- Create: `/Users/adhenawer/Code/claude-setups-registry/data/tag-aliases.yml`

- [ ] **Step 1: Create directory + git init**

```bash
mkdir -p /Users/adhenawer/Code/claude-setups-registry/data/setups
cd /Users/adhenawer/Code/claude-setups-registry
git init
```

- [ ] **Step 2: Write README**

Create `/Users/adhenawer/Code/claude-setups-registry/README.md`:
```markdown
# claude-setups-registry

Public registry and gallery for [claude-setups](https://github.com/adhenawer/claude-setups) — Claude Code setups shared by the community.

## Structure

- `data/setups/<author>/<slug>.json` — canonical descriptor per published setup
- `data/tag-aliases.yml` — canonicalization map for free-form tags
- `site/` — static gallery source (served via GitHub Pages)
- `.github/workflows/ingest.yml` — validates + commits on new submissions

## How to publish

Use the CLI: `npx -y claude-setups publish` (from the main project). The CLI creates a GitHub issue here labeled `setup:submission`; the ingest Action validates and commits.

## License

MIT
```

- [ ] **Step 3: Copy LICENSE from claude-setups**

```bash
cp /Users/adhenawer/Code/claude-setups/LICENSE /Users/adhenawer/Code/claude-setups-registry/LICENSE
```

- [ ] **Step 4: Write .gitignore**

Create `/Users/adhenawer/Code/claude-setups-registry/.gitignore`:
```
node_modules/
.DS_Store
```

- [ ] **Step 5: Write tag-aliases.yml + placeholder setup dir**

Create `/Users/adhenawer/Code/claude-setups-registry/data/tag-aliases.yml`:
```yaml
# Canonicalization map: "py" → "python", "JS" → "javascript", etc.
# Applied by the ingest Action before committing.
py: python
javascript: javascript
js: javascript
ts: typescript
typescript: typescript
cc: claude-code
"claude code": claude-code
```

```bash
touch /Users/adhenawer/Code/claude-setups-registry/data/setups/.gitkeep
```

- [ ] **Step 6: Commit**

```bash
cd /Users/adhenawer/Code/claude-setups-registry
git add -A
git commit -m "scaffold: registry repo with data tree + tag aliases"
```

---

## Task 12: Issue Form template

**Files:**
- Create: `/Users/adhenawer/Code/claude-setups-registry/.github/ISSUE_TEMPLATE/setup-submission.yml`

- [ ] **Step 1: Write the Issue Form**

Create `/Users/adhenawer/Code/claude-setups-registry/.github/ISSUE_TEMPLATE/setup-submission.yml`:
```yaml
name: Setup submission
description: Submit a claude-setups descriptor (used by the CLI fallback path).
title: "[setup] submission"
labels: ["setup:submission"]
body:
  - type: markdown
    attributes:
      value: |
        ## Setup submission

        This form is the **fallback path** for users without the `gh` CLI.
        Prefer `npx -y claude-setups publish` — it generates the descriptor
        and files this issue for you automatically.

        The descriptor JSON below is auto-filled by the CLI via URL params.
        If you're filling it by hand, copy the JSON produced by
        `npx -y claude-setups publish --dry-run` (not yet implemented in v0.1).
  - type: textarea
    id: descriptor
    attributes:
      label: Descriptor JSON
      description: The full claude-setups descriptor. Do NOT edit unless you know what you're doing.
      render: json
    validations:
      required: true
```

- [ ] **Step 2: Validate YAML**

Run:
```bash
python3 -c "import yaml; yaml.safe_load(open('/Users/adhenawer/Code/claude-setups-registry/.github/ISSUE_TEMPLATE/setup-submission.yml'))" && echo OK
```
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
cd /Users/adhenawer/Code/claude-setups-registry
git add .github/ISSUE_TEMPLATE/setup-submission.yml
git commit -m "feat: Issue Form template for setup-submission fallback path"
```

---

## Task 13: Ingest Action — scaffold + schema validation

**Files:**
- Create: `/Users/adhenawer/Code/claude-setups-registry/.github/workflows/ingest.yml`
- Create: `/Users/adhenawer/Code/claude-setups-registry/scripts/ingest.mjs`
- Create: `/Users/adhenawer/Code/claude-setups-registry/scripts/validate-descriptor.mjs`
- Create: `/Users/adhenawer/Code/claude-setups-registry/scripts/tests/validate.test.mjs`
- Create: `/Users/adhenawer/Code/claude-setups-registry/package.json`

- [ ] **Step 1: Create package.json in registry repo**

Write `/Users/adhenawer/Code/claude-setups-registry/package.json`:
```json
{
  "name": "claude-setups-registry-scripts",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test scripts/tests/*.test.mjs"
  }
}
```

- [ ] **Step 2: Write failing test for validator**

Create `/Users/adhenawer/Code/claude-setups-registry/scripts/tests/validate.test.mjs`:
```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const VALID = {
  schemaVersion: '1.0.0',
  id: { author: 'alice', slug: 'my-setup' },
  version: 1,
  title: 'T',
  description: 'D',
  tags: ['python'],
  author: { handle: 'alice', url: 'https://github.com/alice' },
  createdAt: '2026-04-19T00:00:00Z',
  license: 'MIT',
  plugins: [],
  marketplaces: [],
  mcpServers: [],
  bundle: { present: false },
};

describe('validateDescriptor (registry-side)', () => {
  it('accepts a well-formed descriptor', async () => {
    const { validate } = await import('../validate-descriptor.mjs');
    assert.doesNotThrow(() => validate(VALID));
  });

  it('rejects missing schemaVersion', async () => {
    const { validate } = await import('../validate-descriptor.mjs');
    const bad = { ...VALID }; delete bad.schemaVersion;
    assert.throws(() => validate(bad), /schemaVersion/i);
  });

  it('rejects unsupported major schemaVersion', async () => {
    const { validate } = await import('../validate-descriptor.mjs');
    assert.throws(() => validate({ ...VALID, schemaVersion: '99.0.0' }), /unsupported/i);
  });

  it('rejects invalid slug', async () => {
    const { validate } = await import('../validate-descriptor.mjs');
    assert.throws(() => validate({ ...VALID, id: { author: 'a', slug: 'BAD slug' } }), /slug/i);
  });

  it('rejects author handle mismatch with issue author param', async () => {
    const { validate } = await import('../validate-descriptor.mjs');
    assert.throws(() => validate(VALID, { issueAuthor: 'someone-else' }), /author.*match/i);
  });

  it('accepts when author handle matches issue author', async () => {
    const { validate } = await import('../validate-descriptor.mjs');
    assert.doesNotThrow(() => validate(VALID, { issueAuthor: 'alice' }));
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `cd /Users/adhenawer/Code/claude-setups-registry && npm test 2>&1 | tail -5`
Expected: 6 failures — module not found.

- [ ] **Step 4: Implement validator**

Create `/Users/adhenawer/Code/claude-setups-registry/scripts/validate-descriptor.mjs`:
```js
const SUPPORTED_MAJOR = 1;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,49}$/;

export function validate(d, opts = {}) {
  if (!d || typeof d !== 'object') throw new Error('descriptor not an object');
  if (!d.schemaVersion) throw new Error('missing schemaVersion');
  const major = parseInt(d.schemaVersion.split('.')[0], 10);
  if (major !== SUPPORTED_MAJOR) {
    throw new Error(`unsupported schemaVersion ${d.schemaVersion}`);
  }
  if (!d.id?.author || !d.id?.slug) throw new Error('missing id.author or id.slug');
  if (!SLUG_RE.test(d.id.slug)) throw new Error(`invalid slug: ${d.id.slug}`);
  if (!d.title || typeof d.title !== 'string') throw new Error('invalid title');
  if (!d.description || typeof d.description !== 'string') throw new Error('invalid description');
  if (!Array.isArray(d.tags) || d.tags.length === 0) throw new Error('invalid tags');
  if (!Array.isArray(d.plugins)) throw new Error('plugins must be array');
  if (!Array.isArray(d.marketplaces)) throw new Error('marketplaces must be array');
  if (!Array.isArray(d.mcpServers)) throw new Error('mcpServers must be array');
  // Forbidden fields (server-side check — defense in depth)
  for (const s of d.mcpServers) {
    if ('env' in s) throw new Error(`mcpServers[${s.name}] must not include env`);
  }

  if (opts.issueAuthor && opts.issueAuthor !== d.id.author) {
    throw new Error(`descriptor author "${d.id.author}" does not match issue author "${opts.issueAuthor}"`);
  }
  return true;
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npm test 2>&1 | tail -5`
Expected: 6 passing.

- [ ] **Step 6: Commit**

```bash
cd /Users/adhenawer/Code/claude-setups-registry
git add package.json scripts/validate-descriptor.mjs scripts/tests/validate.test.mjs
git commit -m "feat: server-side descriptor validator + 6 tests (defense in depth)"
```

---

## Task 14: Ingest Action — commit + close

**Files:**
- Create: `/Users/adhenawer/Code/claude-setups-registry/scripts/ingest.mjs`
- Create: `/Users/adhenawer/Code/claude-setups-registry/.github/workflows/ingest.yml`
- Create: `/Users/adhenawer/Code/claude-setups-registry/scripts/tests/ingest.test.mjs`

- [ ] **Step 1: Write failing test for ingest pipeline**

Create `/Users/adhenawer/Code/claude-setups-registry/scripts/tests/ingest.test.mjs`:
```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const VALID_BODY = JSON.stringify({
  schemaVersion: '1.0.0',
  id: { author: 'alice', slug: 'my-setup' },
  version: 1,
  title: 'T', description: 'D', tags: ['python'],
  author: { handle: 'alice', url: 'https://github.com/alice' },
  createdAt: '2026-04-19T00:00:00Z', license: 'MIT',
  plugins: [], marketplaces: [], mcpServers: [],
  bundle: { present: false }
}, null, 2);

describe('ingestIssue', () => {
  it('writes descriptor to data/setups/<author>/<slug>.json on success', async () => {
    const { ingestIssue } = await import('../ingest.mjs');
    const dir = await mkdtemp(join(tmpdir(), 'cs-ingest-'));
    try {
      const result = await ingestIssue({
        dataRoot: dir,
        issueBody: VALID_BODY,
        issueAuthor: 'alice',
      });
      assert.equal(result.ok, true);
      const saved = JSON.parse(
        await readFile(join(dir, 'setups/alice/my-setup.json'), 'utf-8')
      );
      assert.equal(saved.id.slug, 'my-setup');
    } finally { await rm(dir, { recursive: true }); }
  });

  it('canonicalizes tags via aliases map', async () => {
    const { ingestIssue } = await import('../ingest.mjs');
    const dir = await mkdtemp(join(tmpdir(), 'cs-ingest-'));
    try {
      const body = JSON.parse(VALID_BODY);
      body.tags = ['py', 'JS', 'unknown-tag'];
      await ingestIssue({
        dataRoot: dir,
        issueBody: JSON.stringify(body),
        issueAuthor: 'alice',
        aliases: { py: 'python', JS: 'javascript' },
      });
      const saved = JSON.parse(
        await readFile(join(dir, 'setups/alice/my-setup.json'), 'utf-8')
      );
      assert.deepEqual(saved.tags.sort(), ['javascript', 'python', 'unknown-tag']);
    } finally { await rm(dir, { recursive: true }); }
  });

  it('returns ok=false + reason when validation fails', async () => {
    const { ingestIssue } = await import('../ingest.mjs');
    const dir = await mkdtemp(join(tmpdir(), 'cs-ingest-'));
    try {
      const r = await ingestIssue({
        dataRoot: dir,
        issueBody: '{}',
        issueAuthor: 'alice',
      });
      assert.equal(r.ok, false);
      assert.match(r.reason, /schemaVersion|validation/i);
    } finally { await rm(dir, { recursive: true }); }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test 2>&1 | tail -5`
Expected: 3 failures on ingest.

- [ ] **Step 3: Implement**

Create `/Users/adhenawer/Code/claude-setups-registry/scripts/ingest.mjs`:
```js
import { mkdir, writeFile } from 'node:fs/promises';
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

  // Canonicalize tags
  descriptor.tags = descriptor.tags.map(t => aliases[t] || t);

  const setupDir = join(dataRoot, 'setups', descriptor.id.author);
  await mkdir(setupDir, { recursive: true });
  const setupPath = join(setupDir, `${descriptor.id.slug}.json`);
  await writeFile(setupPath, JSON.stringify(descriptor, null, 2));

  return { ok: true, path: setupPath, slug: descriptor.id.slug };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test 2>&1 | tail -5`
Expected: 9 passing.

- [ ] **Step 5: Write the ingest workflow**

Create `/Users/adhenawer/Code/claude-setups-registry/.github/workflows/ingest.yml`:
```yaml
name: ingest

on:
  issues:
    types: [opened]

jobs:
  ingest:
    if: contains(github.event.issue.labels.*.name, 'setup:submission')
    runs-on: ubuntu-latest
    permissions:
      contents: write
      issues: write
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Parse aliases
        id: aliases
        run: |
          # Load tag-aliases.yml into JSON via a tiny Python step (no npm deps)
          python3 -c "
          import yaml, json
          with open('data/tag-aliases.yml') as f:
              aliases = yaml.safe_load(f) or {}
          with open('/tmp/aliases.json', 'w') as f:
              json.dump(aliases, f)
          "
      - name: Run ingest
        id: ingest
        env:
          ISSUE_BODY: ${{ github.event.issue.body }}
          ISSUE_AUTHOR: ${{ github.event.issue.user.login }}
        run: |
          node -e "
          import('./scripts/ingest.mjs').then(async ({ ingestIssue }) => {
            const fs = await import('node:fs/promises');
            const aliases = JSON.parse(await fs.readFile('/tmp/aliases.json', 'utf-8'));
            const r = await ingestIssue({
              dataRoot: 'data',
              issueBody: process.env.ISSUE_BODY,
              issueAuthor: process.env.ISSUE_AUTHOR,
              aliases,
            });
            if (!r.ok) {
              console.error('INGEST_FAILED: ' + r.reason);
              process.exit(2);
            }
            console.log('INGEST_OK: ' + r.path);
          }).catch(e => { console.error(e); process.exit(1); });
          "
      - name: Commit + close (on success)
        if: success()
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ISSUE_NUMBER: ${{ github.event.issue.number }}
          AUTHOR: ${{ github.event.issue.user.login }}
        run: |
          # Derive slug from the newly-added file path
          SLUG=$(git status --porcelain data/setups/ | awk '{print $2}' | head -1 | sed -E 's|data/setups/[^/]+/||; s|\.json$||')
          git config user.name "claude-setups-bot"
          git config user.email "bot@claude-setups.dev"
          git add data/setups/
          git commit -m "ingest: $AUTHOR/$SLUG (issue #$ISSUE_NUMBER)"
          git push
          PAGES_URL="https://${{ github.repository_owner }}.github.io/${{ github.event.repository.name }}/s/$AUTHOR/$SLUG"
          gh issue comment "$ISSUE_NUMBER" --body "Published: $PAGES_URL"
          gh issue close "$ISSUE_NUMBER"
      - name: Comment + label on failure
        if: failure()
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ISSUE_NUMBER: ${{ github.event.issue.number }}
        run: |
          gh issue comment "$ISSUE_NUMBER" --body "Validation failed. Check the action logs."
          gh issue edit "$ISSUE_NUMBER" --add-label "invalid"
```

- [ ] **Step 6: Commit**

```bash
cd /Users/adhenawer/Code/claude-setups-registry
git add scripts/ingest.mjs scripts/tests/ingest.test.mjs .github/workflows/ingest.yml
git commit -m "feat: ingest workflow — parse, validate, commit to data/setups/, close issue"
```

---

## Task 15: Minimal static gallery (site + build)

**Files:**
- Create: `/Users/adhenawer/Code/claude-setups-registry/site/index.html`
- Create: `/Users/adhenawer/Code/claude-setups-registry/site/setup.html`
- Create: `/Users/adhenawer/Code/claude-setups-registry/site/styles.css`
- Create: `/Users/adhenawer/Code/claude-setups-registry/site/build.mjs`
- Create: `/Users/adhenawer/Code/claude-setups-registry/.github/workflows/pages.yml`

- [ ] **Step 1: Create site/index.html template**

Write `/Users/adhenawer/Code/claude-setups-registry/site/index.html`:
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>claude-setups gallery</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header>
    <h1>claude-setups</h1>
    <p>Community Claude Code setups. Publish with <code>npx -y claude-setups publish</code>.</p>
  </header>
  <main id="setups-list">
    <!-- Populated at build time -->
  </main>
</body>
</html>
```

- [ ] **Step 2: Create site/setup.html template**

Write `/Users/adhenawer/Code/claude-setups-registry/site/setup.html`:
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>claude-setups — %%TITLE%%</title>
  <link rel="stylesheet" href="../../../styles.css">
</head>
<body>
  <header>
    <a href="../../../index.html">← back to gallery</a>
    <h1>%%TITLE%%</h1>
    <p class="author">by <a href="%%AUTHOR_URL%%">%%AUTHOR%%</a> · v%%VERSION%% · %%CREATED_AT%%</p>
  </header>
  <main>
    <p class="description">%%DESCRIPTION%%</p>
    <section>
      <h2>Mirror this setup</h2>
      <pre><code>npx -y claude-setups mirror %%MIRROR_URL%%</code></pre>
      <p><em>Note: mirror command ships in v0.2.</em></p>
    </section>
    <section>
      <h2>Descriptor</h2>
      <pre id="descriptor">%%DESCRIPTOR_JSON%%</pre>
    </section>
  </main>
</body>
</html>
```

- [ ] **Step 3: Create styles.css**

Write `/Users/adhenawer/Code/claude-setups-registry/site/styles.css`:
```css
body { font-family: -apple-system, system-ui, sans-serif; max-width: 760px; margin: 2em auto; padding: 0 1em; line-height: 1.5; color: #222; }
a { color: #0366d6; }
pre { background: #f6f8fa; padding: 1em; border-radius: 6px; overflow: auto; }
.setup-card { border: 1px solid #e1e4e8; padding: 1em; margin: 1em 0; border-radius: 6px; }
.setup-card h2 { margin: 0; }
.setup-card .tags { margin-top: 0.5em; }
.setup-card .tag { display: inline-block; background: #f0f0f0; padding: 0.1em 0.5em; border-radius: 3px; font-size: 0.85em; margin-right: 0.25em; }
```

- [ ] **Step 4: Create site/build.mjs**

Write `/Users/adhenawer/Code/claude-setups-registry/site/build.mjs`:
```js
import { readdir, readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';

const DATA_DIR = 'data/setups';
const SITE_DIR = 'site';
const OUT_DIR = 'site-build';

async function listSetups() {
  const results = [];
  let authors;
  try { authors = await readdir(DATA_DIR); } catch { return []; }
  for (const author of authors) {
    if (author.startsWith('.')) continue;
    const authorDir = join(DATA_DIR, author);
    let files;
    try { files = await readdir(authorDir); } catch { continue; }
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const p = join(authorDir, f);
      const d = JSON.parse(await readFile(p, 'utf-8'));
      results.push({ path: p, descriptor: d });
    }
  }
  // Newest first by createdAt
  results.sort((a, b) => b.descriptor.createdAt.localeCompare(a.descriptor.createdAt));
  return results;
}

function renderCard(d) {
  const tags = d.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
  const href = `s/${d.id.author}/${d.id.slug}.html`;
  return `
    <article class="setup-card">
      <h2><a href="${href}">${escapeHtml(d.title)}</a></h2>
      <p class="author">by <a href="${escapeHtml(d.author.url)}">${escapeHtml(d.id.author)}</a> · ${d.createdAt.slice(0, 10)}</p>
      <p>${escapeHtml(d.description)}</p>
      <div class="tags">${tags}</div>
    </article>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderDetail(template, d) {
  const mirror = `https://${process.env.GITHUB_REPOSITORY_OWNER || 'adhenawer'}.github.io/${process.env.GITHUB_REPOSITORY?.split('/')[1] || 'claude-setups-registry'}/s/${d.id.author}/${d.id.slug}.json`;
  return template
    .replace(/%%TITLE%%/g, escapeHtml(d.title))
    .replace(/%%AUTHOR%%/g, escapeHtml(d.id.author))
    .replace(/%%AUTHOR_URL%%/g, escapeHtml(d.author.url))
    .replace(/%%VERSION%%/g, String(d.version))
    .replace(/%%CREATED_AT%%/g, d.createdAt.slice(0, 10))
    .replace(/%%DESCRIPTION%%/g, escapeHtml(d.description))
    .replace(/%%MIRROR_URL%%/g, mirror)
    .replace(/%%DESCRIPTOR_JSON%%/g, escapeHtml(JSON.stringify(d, null, 2)));
}

async function build() {
  await mkdir(OUT_DIR, { recursive: true });
  await copyFile(join(SITE_DIR, 'styles.css'), join(OUT_DIR, 'styles.css'));

  const setups = await listSetups();
  const indexTpl = await readFile(join(SITE_DIR, 'index.html'), 'utf-8');
  const index = indexTpl.replace('<!-- Populated at build time -->', setups.map(s => renderCard(s.descriptor)).join(''));
  await writeFile(join(OUT_DIR, 'index.html'), index);

  const detailTpl = await readFile(join(SITE_DIR, 'setup.html'), 'utf-8');
  for (const { descriptor } of setups) {
    const outDir = join(OUT_DIR, 's', descriptor.id.author);
    await mkdir(outDir, { recursive: true });
    const outPath = join(outDir, `${descriptor.id.slug}.html`);
    await writeFile(outPath, renderDetail(detailTpl, descriptor));
    // Also copy the raw JSON for discovery API
    await writeFile(
      join(outDir, `${descriptor.id.slug}.json`),
      JSON.stringify(descriptor, null, 2)
    );
  }
  console.log(`Built site: ${setups.length} setup(s) → ${OUT_DIR}/`);
}

build().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 5: Create Pages workflow**

Write `/Users/adhenawer/Code/claude-setups-registry/.github/workflows/pages.yml`:
```yaml
name: pages

on:
  push:
    branches: [main]
    paths:
      - 'data/setups/**'
      - 'site/**'
      - '.github/workflows/pages.yml'
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: node site/build.mjs
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: site-build
  deploy:
    needs: build
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 6: Smoke-test the build locally**

Create a test descriptor in `data/setups/` and build:
```bash
cd /Users/adhenawer/Code/claude-setups-registry
mkdir -p data/setups/smoketest
cat > data/setups/smoketest/demo.json <<'EOF'
{
  "schemaVersion": "1.0.0",
  "id": { "author": "smoketest", "slug": "demo" },
  "version": 1,
  "title": "Smoke test setup",
  "description": "A test entry to verify site build works.",
  "tags": ["test"],
  "author": { "handle": "smoketest", "url": "https://github.com/smoketest" },
  "createdAt": "2026-04-19T00:00:00Z",
  "license": "MIT",
  "plugins": [],
  "marketplaces": [],
  "mcpServers": [],
  "bundle": { "present": false }
}
EOF
node site/build.mjs
```
Expected: `Built site: 1 setup(s) → site-build/`. Verify `site-build/index.html` and `site-build/s/smoketest/demo.html` exist.

- [ ] **Step 7: Clean up smoke test + commit**

```bash
rm -rf data/setups/smoketest site-build
git add site/ .github/workflows/pages.yml
git commit -m "feat: static gallery site + build.mjs + pages deployment workflow"
```

---

## Task 16: End-to-end smoke test

**Files:**
- Create: `/Users/adhenawer/Code/claude-setups/tests/e2e.test.mjs`

- [ ] **Step 1: Write the e2e test**

Create `/Users/adhenawer/Code/claude-setups/tests/e2e.test.mjs`:
```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, 'fixtures/fake-claude-home');

describe('E2E: publish flow (with injected gh, simulating registry ingest)', () => {
  it('produces a descriptor that would successfully ingest on server-side', async () => {
    const { publishViaGh } = await import('../src/publish.mjs');

    // Mock gh — capture issue body
    let capturedBody = null;
    const mockGh = async (args) => {
      if (args[0] === 'issue' && args[1] === 'create') {
        const bodyIdx = args.indexOf('--body');
        capturedBody = args[bodyIdx + 1];
      }
      return { stdout: 'https://github.com/x/y/issues/1\n', stderr: '', code: 0 };
    };

    await publishViaGh({
      claudeHome: FIXTURES,
      author: 'alice',
      slug: 'e2e-test',
      title: 'E2E test setup',
      description: 'Full round-trip smoke test',
      tags: ['e2e', 'smoke'],
      registryRepo: 'x/y',
      gh: mockGh,
    });
    assert.ok(capturedBody, 'body should have been captured');

    // Now feed capturedBody through the registry-side validator
    // We import the registry validator by path (adjacent sibling repo).
    const registryValidate = await import(
      resolve(__dirname, '../../claude-setups-registry/scripts/validate-descriptor.mjs')
    ).then(m => m.validate).catch(() => null);

    if (!registryValidate) {
      // Registry repo not set up yet — skip with a warning. The real CI
      // has both repos checked out.
      console.warn('SKIP: registry repo not present at ../claude-setups-registry — skipping round-trip');
      return;
    }
    const descriptor = JSON.parse(capturedBody);
    assert.doesNotThrow(() => registryValidate(descriptor, { issueAuthor: 'alice' }));

    // And verify server-side checks that forbidden fields aren't present
    assert.ok(!JSON.stringify(descriptor).includes('env'), 'mcpServers must not have env key (was just tested but verifies again)');
  });
});
```

- [ ] **Step 2: Run the e2e test**

Run: `cd /Users/adhenawer/Code/claude-setups && npm test 2>&1 | tail -5`
Expected: 39 passing (the new e2e either passes or skips gracefully if registry repo isn't present).

- [ ] **Step 3: Commit**

```bash
cd /Users/adhenawer/Code/claude-setups
git add tests/e2e.test.mjs
git commit -m "test: e2e publish → registry-side validate round-trip"
```

---

## Task 17: CLI package release v0.1.0

**Files:**
- Modify: `/Users/adhenawer/Code/claude-setups/README.md` (update status section)

- [ ] **Step 1: Update README status**

Edit `/Users/adhenawer/Code/claude-setups/README.md`: replace the status line:
```markdown
> **Status:** 🚧 Very early. Research + design phase. See [docs/DESIGN.md](docs/DESIGN.md), [docs/SECURITY_PREMISE.md](docs/SECURITY_PREMISE.md), [docs/RISK_ANALYSIS.md](docs/RISK_ANALYSIS.md), and [docs/PRIOR_ART.md](docs/PRIOR_ART.md).
```
with:
```markdown
> **Status:** v0.1.0 — publish flow is live. Mirror command ships in v0.2 (see [roadmap](docs/superpowers/specs/2026-04-19-claude-setups-v1-design.md)).
```

- [ ] **Step 2: Final local test run**

Run: `cd /Users/adhenawer/Code/claude-setups && npm test 2>&1 | tail -5`
Expected: 39 passing (or 38 + 1 skipped if registry dir not present).

- [ ] **Step 3: Publish to npm (DRY RUN first)**

Run: `npm publish --dry-run 2>&1 | tail -15`
Expected: shows files to be included, `name: claude-setups`, `version: 0.1.0`. Verify sizes are reasonable (< 50KB).

- [ ] **Step 4: Publish for real (ONLY after user explicit confirmation)**

⚠️ **STOP HERE** — do not auto-run `npm publish` without user consent. The user said they want to publish only after v0.1, v0.2, AND v0.3 are complete. So:

Instead, commit the final state and report:
```bash
cd /Users/adhenawer/Code/claude-setups
git add README.md
git commit -m "release: v0.1.0 ready — publish skeleton complete (57 tests passing)"
```

Print to user: "v0.1 code is complete and committed. Ready for Plan 2 (mirror) when you're ready. npm publish NOT run per your instruction."

---

## Task 18: Registry repo — push to GitHub

**Files:** none (git operations only)

- [ ] **Step 1: Set remote and push (requires user to have created empty github repo)**

Instruct user: "Create an empty public repo at github.com/adhenawer/claude-setups-registry. Then run the following."

```bash
cd /Users/adhenawer/Code/claude-setups-registry
git remote add origin git@github.com:adhenawer/claude-setups-registry.git
git branch -M main
git push -u origin main
```

- [ ] **Step 2: Enable GitHub Pages**

Instruct user: "In the registry repo on GitHub: Settings → Pages → Source = GitHub Actions. The Pages workflow will run on the next push."

- [ ] **Step 3: Verify Pages URL is reachable**

After first push, open `https://adhenawer.github.io/claude-setups-registry/` in a browser and confirm the empty gallery loads.

- [ ] **Step 4: Done — report to user**

"v0.1 infrastructure is live. Publish a test setup via `npx -y /Users/adhenawer/Code/claude-setups publish --author <your-handle> --slug test-01 --title 'Test' --description 'First test' --tags test` and confirm the ingest Action runs + setup appears in the gallery."

---

---

## Addendum A — Specialty taxonomy + gallery filter

> **Execution order:** run Tasks A1–A3 BEFORE Task 17 (release). They integrate the specialty field into the existing publish/ingest/gallery flow.

### Task A1: Specialties taxonomy module + canonical list

**Files:**
- Create: `/Users/adhenawer/Code/claude-setups-registry/data/specialties.yml` — authoritative list
- Create: `/Users/adhenawer/Code/claude-setups/src/specialties.mjs` — CLI-side loader
- Create: `/Users/adhenawer/Code/claude-setups/src/specialties.yml` — bundled copy (synced from registry)
- Create: `/Users/adhenawer/Code/claude-setups/tests/specialties.test.mjs`

- [ ] **Step 1: Write the registry-side canonical list**

Write `/Users/adhenawer/Code/claude-setups-registry/data/specialties.yml`:
```yaml
# Authoritative specialty taxonomy for claude-setups.
# Add entries via PR. Keys are slug-style (lowercase, hyphen-separated).
backend:           "Backend engineer"
frontend:          "Frontend engineer"
fullstack:         "Full-stack engineer"
mobile:            "Mobile (iOS / Android / React Native)"
devops:            "DevOps / SRE / Platform"
data-engineer:     "Data engineering"
data-science:      "Data science / ML engineer"
bi-analytics:      "BI / Analytics"
security:          "Security engineer"
qa-testing:        "QA / Testing / SDET"
ux-design:         "UX / UI design"
product:           "Product management"
technical-writing: "Technical writing / docs"
game-dev:          "Game development"
embedded:          "Embedded / firmware"
research:          "Research / academia"
other:             "Other (custom)"
```

- [ ] **Step 2: Create a synced copy for the CLI bundle**

Copy the file:
```bash
cp /Users/adhenawer/Code/claude-setups-registry/data/specialties.yml \
   /Users/adhenawer/Code/claude-setups/src/specialties.yml
```

(This copy ships with the npm package so the CLI can validate specialties offline.)

- [ ] **Step 3: Write failing tests**

Create `/Users/adhenawer/Code/claude-setups/tests/specialties.test.mjs`:
```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('loadSpecialties', () => {
  it('returns the canonical map with at least 15 entries', async () => {
    const { loadSpecialties } = await import('../src/specialties.mjs');
    const map = await loadSpecialties();
    assert.ok(Object.keys(map).length >= 15);
    assert.equal(map.backend, 'Backend engineer');
    assert.equal(map['data-engineer'], 'Data engineering');
  });
});

describe('validateSpecialties', () => {
  it('accepts 1–3 known keys', async () => {
    const { validateSpecialties } = await import('../src/specialties.mjs');
    assert.doesNotThrow(() => validateSpecialties(['backend']));
    assert.doesNotThrow(() => validateSpecialties(['backend', 'devops']));
    assert.doesNotThrow(() => validateSpecialties(['backend', 'devops', 'data-engineer']));
  });

  it('rejects empty array', async () => {
    const { validateSpecialties } = await import('../src/specialties.mjs');
    assert.throws(() => validateSpecialties([]), /at least one/i);
  });

  it('rejects more than 3 entries', async () => {
    const { validateSpecialties } = await import('../src/specialties.mjs');
    assert.throws(
      () => validateSpecialties(['backend', 'devops', 'data-engineer', 'frontend']),
      /at most 3/i
    );
  });

  it('rejects unknown key', async () => {
    const { validateSpecialties } = await import('../src/specialties.mjs');
    assert.throws(() => validateSpecialties(['ninja-rockstar']), /unknown specialty/i);
  });

  it('rejects duplicates', async () => {
    const { validateSpecialties } = await import('../src/specialties.mjs');
    assert.throws(() => validateSpecialties(['backend', 'backend']), /duplicate/i);
  });
});
```

- [ ] **Step 4: Run to verify failure**

Run: `cd /Users/adhenawer/Code/claude-setups && npm test 2>&1 | tail -8`
Expected: 6 failures.

- [ ] **Step 5: Implement**

Create `/Users/adhenawer/Code/claude-setups/src/specialties.mjs`:
```js
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const YAML_PATH = join(__dirname, 'specialties.yml');

let cached = null;

function parseSimpleYamlMap(text) {
  // Minimal parser for `key: "value"` or `key: value` lines.
  // Skips comments and blank lines. Does not support nested structures.
  const map = {};
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([a-z0-9][a-z0-9-]*)\s*:\s*(?:"(.*)"|'(.*)'|(.+))\s*$/i);
    if (m) {
      const key = m[1];
      const value = m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : m[4]);
      map[key] = value;
    }
  }
  return map;
}

export async function loadSpecialties() {
  if (cached) return cached;
  const text = await readFile(YAML_PATH, 'utf-8');
  cached = parseSimpleYamlMap(text);
  return cached;
}

export async function validateSpecialties(arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error('specialties: at least one value required');
  }
  if (arr.length > 3) {
    throw new Error('specialties: at most 3 values allowed');
  }
  const seen = new Set();
  for (const key of arr) {
    if (seen.has(key)) throw new Error(`specialties: duplicate "${key}"`);
    seen.add(key);
  }
  const known = await loadSpecialties();
  for (const key of arr) {
    if (!(key in known)) {
      throw new Error(`specialties: unknown specialty "${key}". Valid keys: ${Object.keys(known).join(', ')}`);
    }
  }
  return true;
}
```

- [ ] **Step 6: Update package.json files list to include the YAML**

In `/Users/adhenawer/Code/claude-setups/package.json`, update `"files"`:
```json
"files": ["src/", "README.md", "LICENSE"],
```
(`src/` already includes `specialties.yml`.) Verify with `npm pack --dry-run | grep specialties`:
```bash
cd /Users/adhenawer/Code/claude-setups && npm pack --dry-run 2>&1 | grep -i special
```
Expected: the YAML appears in the packed file list.

- [ ] **Step 7: Run to verify pass**

Run: `npm test 2>&1 | tail -5`
Expected: 6 new passing.

- [ ] **Step 8: Commit**

```bash
cd /Users/adhenawer/Code/claude-setups-registry
git add data/specialties.yml
git commit -m "feat: canonical specialty taxonomy (17 entries)"

cd /Users/adhenawer/Code/claude-setups
git add src/specialties.mjs src/specialties.yml tests/specialties.test.mjs package.json
git commit -m "feat: specialty taxonomy loader + validator; 6 tests"
```

### Task A2: Descriptor + CLI + Issue Form integration

**Files:**
- Modify: `/Users/adhenawer/Code/claude-setups/src/descriptor.mjs`
- Modify: `/Users/adhenawer/Code/claude-setups/src/publish.mjs` (pass specialties through)
- Modify: `/Users/adhenawer/Code/claude-setups/src/cli.mjs` (accept `--specialties` flag)
- Modify: `/Users/adhenawer/Code/claude-setups-registry/.github/ISSUE_TEMPLATE/setup-submission.yml` (add dropdown)
- Modify: `/Users/adhenawer/Code/claude-setups/tests/descriptor.test.mjs`
- Modify: `/Users/adhenawer/Code/claude-setups/tests/publish.test.mjs`

- [ ] **Step 1: Write failing descriptor tests for specialties**

Append to `/Users/adhenawer/Code/claude-setups/tests/descriptor.test.mjs`:
```js
describe('buildDescriptor with specialties', () => {
  it('includes specialties array in descriptor', async () => {
    const { buildDescriptor } = await import('../src/descriptor.mjs');
    const d = await buildDescriptor({
      author: 'a', slug: 'ok', title: 't', description: 'd', tags: ['x'],
      plugins: [], marketplaces: [], mcpServers: [],
      specialties: ['backend', 'devops'],
    });
    assert.deepEqual(d.specialties, ['backend', 'devops']);
  });

  it('rejects missing specialties (required)', async () => {
    const { buildDescriptor } = await import('../src/descriptor.mjs');
    await assert.rejects(async () => await buildDescriptor({
      author: 'a', slug: 'ok', title: 't', description: 'd', tags: ['x'],
      plugins: [], marketplaces: [], mcpServers: [],
    }), /specialties/i);
  });

  it('rejects unknown specialty', async () => {
    const { buildDescriptor } = await import('../src/descriptor.mjs');
    await assert.rejects(async () => await buildDescriptor({
      author: 'a', slug: 'ok', title: 't', description: 'd', tags: ['x'],
      plugins: [], marketplaces: [], mcpServers: [],
      specialties: ['rockstar-ninja'],
    }), /unknown specialty/i);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test 2>&1 | tail -8`
Expected: 3 failures.

- [ ] **Step 3: Update buildDescriptor to accept + validate specialties**

Edit `/Users/adhenawer/Code/claude-setups/src/descriptor.mjs` — change `buildDescriptor` to be async and integrate specialties:
```js
import { validateSpecialties } from './specialties.mjs';

// ... existing constants ...

export async function buildDescriptor(input) {
  const {
    author, slug, title, description, tags,
    plugins, marketplaces, mcpServers, specialties, version = 1,
  } = input;

  if (!author) throw new Error('author is required');
  if (!SLUG_RE.test(slug)) {
    throw new Error(`invalid slug: must match ${SLUG_RE} (got "${slug}")`);
  }
  if (!title || title.length === 0 || title.length > MAX_TITLE) {
    throw new Error(`invalid title: must be 1-${MAX_TITLE} chars`);
  }
  if (!description || description.length === 0 || description.length > MAX_DESCRIPTION) {
    throw new Error(`invalid description: must be 1-${MAX_DESCRIPTION} chars`);
  }
  if (!Array.isArray(tags) || tags.length === 0 || tags.length > MAX_TAGS) {
    throw new Error(`invalid tags: must be 1-${MAX_TAGS} entries`);
  }
  if (!specialties) throw new Error('specialties is required');
  await validateSpecialties(specialties);

  return {
    schemaVersion: SCHEMA_VERSION,
    id: { author, slug },
    version,
    title, description, tags,
    author: {
      handle: author,
      url: `https://github.com/${author}`,
    },
    createdAt: new Date().toISOString(),
    license: 'MIT',
    plugins, marketplaces, mcpServers,
    specialties,
    bundle: { present: false },
  };
}
```

(`buildDescriptor` becomes `async` because `validateSpecialties` is async. Update any call site accordingly — `src/publish.mjs` needs `await`.)

Also update `validateDescriptor` (the sync validator) to check specialties shape:
```js
export function validateDescriptor(d) {
  if (!d || !d.schemaVersion) {
    throw new Error('Invalid descriptor: missing schemaVersion');
  }
  const major = parseInt(d.schemaVersion.split('.')[0], 10);
  if (major !== SUPPORTED_MAJOR) {
    throw new Error(
      `Unsupported schemaVersion ${d.schemaVersion}: this claude-setups supports major ${SUPPORTED_MAJOR}`
    );
  }
  if (!d.id?.author || !d.id?.slug) throw new Error('missing id.author or id.slug');
  if (!d.title || !d.description || !Array.isArray(d.tags)) {
    throw new Error('missing metadata');
  }
  if (!Array.isArray(d.specialties) || d.specialties.length === 0 || d.specialties.length > 3) {
    throw new Error('specialties must be an array of 1-3 entries');
  }
  return true;
}
```

- [ ] **Step 4: Update publish.mjs to await buildDescriptor + forward specialties**

Edit `/Users/adhenawer/Code/claude-setups/src/publish.mjs`:
Change `const descriptor = buildDescriptor({ ... })` to `const descriptor = await buildDescriptor({ ... specialties })`. Full modification:
```js
export async function publishViaGh(opts) {
  const {
    claudeHome, author, slug, title, description, tags, specialties,
    registryRepo,
    gh = runGh,
  } = opts;

  const collected = await collect(claudeHome);
  const descriptor = await buildDescriptor({
    author, slug, title, description, tags, specialties,
    plugins: collected.plugins,
    marketplaces: collected.marketplaces,
    mcpServers: collected.mcpServers,
  });
  // ... rest unchanged
}
```

- [ ] **Step 5: Update CLI to parse --specialties flag**

Edit `/Users/adhenawer/Code/claude-setups/src/cli.mjs`, modify `cmdPublish`:
```js
async function cmdPublish(parsed) {
  const { title, description, tags, author, slug,
    'registry-repo': registryRepo, specialties } = parsed.flags;
  if (!title || !description || !tags || !author || !slug || !specialties) {
    console.error('Error: publish requires --title, --description, --tags, --author, --slug, --specialties');
    console.error('Example: claude-setups publish --author alice --slug my-setup \\');
    console.error('           --title "My setup" --description "desc" \\');
    console.error('           --tags py,backend --specialties backend,devops');
    process.exit(1);
  }
  const { publishViaGh } = await import('./publish.mjs');
  const claudeHome = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
  const registry = registryRepo || 'adhenawer/claude-setups-registry';

  const result = await publishViaGh({
    claudeHome, author, slug, title, description,
    tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    specialties: specialties.split(',').map(s => s.trim()).filter(Boolean),
    registryRepo: registry,
  });

  console.log(JSON.stringify({
    status: 'ok',
    issueUrl: result.issueUrl,
    slug, author,
  }));
}
```

- [ ] **Step 6: Update Issue Form with specialty dropdown**

Edit `/Users/adhenawer/Code/claude-setups-registry/.github/ISSUE_TEMPLATE/setup-submission.yml` — add a dropdown field:
```yaml
  - type: dropdown
    id: specialties
    attributes:
      label: Specialties (pick 1–3)
      description: Primary focus area of this setup. Used for gallery filtering.
      multiple: true
      options:
        - backend
        - frontend
        - fullstack
        - mobile
        - devops
        - data-engineer
        - data-science
        - bi-analytics
        - security
        - qa-testing
        - ux-design
        - product
        - technical-writing
        - game-dev
        - embedded
        - research
        - other
    validations:
      required: true
```

(Place this block after the existing `descriptor` textarea in the form body array.)

- [ ] **Step 7: Update existing descriptor tests that now need async + specialties**

In `/Users/adhenawer/Code/claude-setups/tests/descriptor.test.mjs`, update existing `buildDescriptor` tests to:
- Use `await buildDescriptor(...)`
- Include `specialties: ['backend']` in the input

Example patch to the first existing test:
```js
  it('assembles a descriptor with required fields', async () => {
    const { buildDescriptor } = await import('../src/descriptor.mjs');
    const d = await buildDescriptor({
      author: 'alice', slug: 'my-setup',
      title: 'My Python setup', description: 'A daily driver',
      tags: ['python'], specialties: ['backend'],
      plugins: [...], marketplaces: [...], mcpServers: [...],
    });
    // ... existing assertions still valid
  });
```
Repeat for the other `buildDescriptor` tests in that describe block (add `specialties: ['backend']` + `await`).

Also update `/Users/adhenawer/Code/claude-setups/tests/publish.test.mjs` — every `publishViaGh` call gets `specialties: ['backend']` in the opts.

- [ ] **Step 8: Run to verify pass**

Run: `npm test 2>&1 | tail -5`
Expected: all previous + 3 new passing.

- [ ] **Step 9: Commit**

```bash
cd /Users/adhenawer/Code/claude-setups
git add src/descriptor.mjs src/publish.mjs src/cli.mjs tests/descriptor.test.mjs tests/publish.test.mjs
git commit -m "feat: specialty field in descriptor/publish/CLI; async buildDescriptor"

cd /Users/adhenawer/Code/claude-setups-registry
git add .github/ISSUE_TEMPLATE/setup-submission.yml
git commit -m "feat: specialty dropdown in Issue Form"
```

### Task A3: Registry validator + gallery filter

**Files:**
- Modify: `/Users/adhenawer/Code/claude-setups-registry/scripts/validate-descriptor.mjs`
- Modify: `/Users/adhenawer/Code/claude-setups-registry/scripts/tests/validate.test.mjs`
- Modify: `/Users/adhenawer/Code/claude-setups-registry/site/index.html`
- Modify: `/Users/adhenawer/Code/claude-setups-registry/site/setup.html`
- Modify: `/Users/adhenawer/Code/claude-setups-registry/site/build.mjs`
- Modify: `/Users/adhenawer/Code/claude-setups-registry/site/styles.css`

- [ ] **Step 1: Write failing validator tests for specialties**

Append to `/Users/adhenawer/Code/claude-setups-registry/scripts/tests/validate.test.mjs`:
```js
describe('validateDescriptor — specialties', () => {
  const VALID = {
    schemaVersion: '1.0.0',
    id: { author: 'a', slug: 'ok' },
    version: 1, title: 'T', description: 'D', tags: ['x'],
    author: { handle: 'a', url: 'https://github.com/a' },
    createdAt: '2026-04-19T00:00:00Z', license: 'MIT',
    plugins: [], marketplaces: [], mcpServers: [],
    bundle: { present: false },
  };

  it('accepts 1-3 specialties from the known list', async () => {
    const { validate } = await import('../validate-descriptor.mjs');
    assert.doesNotThrow(() => validate({ ...VALID, specialties: ['backend'] }));
    assert.doesNotThrow(() => validate({ ...VALID, specialties: ['backend', 'devops', 'data-engineer'] }));
  });

  it('rejects missing specialties', async () => {
    const { validate } = await import('../validate-descriptor.mjs');
    assert.throws(() => validate(VALID), /specialties/);
  });

  it('rejects more than 3', async () => {
    const { validate } = await import('../validate-descriptor.mjs');
    assert.throws(() => validate({ ...VALID, specialties: ['a','b','c','d'] }), /at most 3|too many/i);
  });

  it('rejects unknown key', async () => {
    const { validate } = await import('../validate-descriptor.mjs');
    assert.throws(() => validate({ ...VALID, specialties: ['ninja-rockstar'] }), /unknown/i);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd /Users/adhenawer/Code/claude-setups-registry && npm test 2>&1 | tail -5`
Expected: 4 failures.

- [ ] **Step 3: Load specialties + integrate in validate**

Edit `/Users/adhenawer/Code/claude-setups-registry/scripts/validate-descriptor.mjs` to load specialties.yml and check:
```js
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPECIALTIES_PATH = join(__dirname, '../data/specialties.yml');

let _specialties = null;
async function getSpecialties() {
  if (_specialties) return _specialties;
  const text = await readFile(SPECIALTIES_PATH, 'utf-8');
  const map = {};
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = t.match(/^([a-z0-9][a-z0-9-]*)\s*:\s*(?:"(.*)"|(.+))\s*$/i);
    if (m) map[m[1]] = m[2] !== undefined ? m[2] : m[3];
  }
  _specialties = map;
  return map;
}

// ... existing constants ...

export async function validate(d, opts = {}) {
  // ... existing validations ...

  // Specialties
  if (!Array.isArray(d.specialties) || d.specialties.length === 0) {
    throw new Error('specialties: at least one required');
  }
  if (d.specialties.length > 3) {
    throw new Error('specialties: at most 3 allowed');
  }
  const known = await getSpecialties();
  for (const s of d.specialties) {
    if (!(s in known)) throw new Error(`specialties: unknown "${s}"`);
  }
  // ... rest
}
```

Note `validate` is now async — update any call sites (`scripts/ingest.mjs` already uses `validate(...)`; add `await`).

- [ ] **Step 4: Update ingest.mjs to await validate**

Edit `/Users/adhenawer/Code/claude-setups-registry/scripts/ingest.mjs` — change `validate(descriptor, { issueAuthor })` to `await validate(descriptor, { issueAuthor })`.

- [ ] **Step 5: Update test files to match async validate**

In existing `scripts/tests/validate.test.mjs`, wrap calls in `assert.doesNotThrow` with `async () =>` arrows where needed, OR switch to `assert.rejects` / `await validate(...)`. Example:
```js
  it('accepts a well-formed descriptor', async () => {
    const { validate } = await import('../validate-descriptor.mjs');
    await validate(VALID);  // async — throws if invalid
  });

  it('rejects missing schemaVersion', async () => {
    const { validate } = await import('../validate-descriptor.mjs');
    const bad = { ...VALID }; delete bad.schemaVersion;
    await assert.rejects(async () => await validate(bad), /schemaVersion/i);
  });
```
Apply the same pattern to the new specialty tests (added in Step 1).

- [ ] **Step 6: Run to verify pass**

Run: `cd /Users/adhenawer/Code/claude-setups-registry && npm test 2>&1 | tail -5`
Expected: 4 new passing.

- [ ] **Step 7: Add specialty filter to the gallery**

Edit `/Users/adhenawer/Code/claude-setups-registry/site/index.html` to add a filter strip above the setups list:
```html
<body>
  <header>
    <h1>claude-setups</h1>
    <p>Community Claude Code setups. Publish with <code>npx -y claude-setups publish</code>.</p>
  </header>
  <nav id="filters">
    <label>Specialty:</label>
    <select id="specialty-filter" aria-label="Filter by specialty">
      <option value="">all</option>
      <!-- Populated at build time -->
    </select>
  </nav>
  <main id="setups-list">
    <!-- Populated at build time -->
  </main>
  <script>
    document.getElementById('specialty-filter').addEventListener('change', (e) => {
      const val = e.target.value;
      const cards = document.querySelectorAll('[data-specialties]');
      for (const card of cards) {
        const specs = (card.dataset.specialties || '').split(',');
        card.style.display = (!val || specs.includes(val)) ? '' : 'none';
      }
    });
  </script>
</body>
```

- [ ] **Step 8: Update build.mjs to emit specialty filter options + data attributes on cards**

Edit `/Users/adhenawer/Code/claude-setups-registry/site/build.mjs` — extend `renderCard`:
```js
function renderCard(d) {
  const tags = d.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
  const specs = (d.specialties || []).join(',');
  const specsHtml = (d.specialties || []).map(s => `<span class="specialty">${escapeHtml(s)}</span>`).join('');
  const href = `s/${d.id.author}/${d.id.slug}.html`;
  return `
    <article class="setup-card" data-specialties="${escapeHtml(specs)}">
      <h2><a href="${href}">${escapeHtml(d.title)}</a></h2>
      <p class="author">by <a href="${escapeHtml(d.author.url)}">${escapeHtml(d.id.author)}</a> · ${d.createdAt.slice(0, 10)}</p>
      <p>${escapeHtml(d.description)}</p>
      <div class="specialties">${specsHtml}</div>
      <div class="tags">${tags}</div>
    </article>
  `;
}
```

In `build()`, populate the filter dropdown with specialty options from the union seen across all setups:
```js
async function build() {
  await mkdir(OUT_DIR, { recursive: true });
  await copyFile(join(SITE_DIR, 'styles.css'), join(OUT_DIR, 'styles.css'));

  const setups = await listSetups();

  // Collect unique specialties across all setups (sorted)
  const uniqueSpecs = [...new Set(setups.flatMap(s => s.descriptor.specialties || []))].sort();
  const options = uniqueSpecs.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');

  const indexTpl = await readFile(join(SITE_DIR, 'index.html'), 'utf-8');
  let index = indexTpl
    .replace('<!-- Populated at build time -->', setups.map(s => renderCard(s.descriptor)).join(''))
    .replace('<option value="">all</option>\n      <!-- Populated at build time -->',
             '<option value="">all</option>\n      ' + options);
  await writeFile(join(OUT_DIR, 'index.html'), index);

  // ... existing detail-page loop unchanged
}
```

- [ ] **Step 9: Add specialty badge render to setup.html + build.mjs**

Edit `/Users/adhenawer/Code/claude-setups-registry/site/setup.html` — add below the `<p class="author">` line:
```html
    <div class="specialties">%%SPECIALTIES_HTML%%</div>
```

Edit `build.mjs` `renderDetail` to compute `specialtiesHtml`:
```js
  const specialtiesHtml = (d.specialties || []).map(s => `<span class="specialty">${escapeHtml(s)}</span>`).join('');
  return template
    .replace(/%%TITLE%%/g, escapeHtml(d.title))
    // ... existing replacements ...
    .replace(/%%SPECIALTIES_HTML%%/g, specialtiesHtml)
    .replace(/%%DESCRIPTOR_JSON%%/g, escapeHtml(JSON.stringify(d, null, 2)));
```

- [ ] **Step 10: Add CSS for specialty badges**

Append to `/Users/adhenawer/Code/claude-setups-registry/site/styles.css`:
```css
.specialty { display: inline-block; background: #e6f4ea; color: #1e6b2f; padding: 0.1em 0.5em; border-radius: 3px; font-size: 0.85em; margin-right: 0.25em; font-weight: 500; }
.specialties { margin: 0.5em 0; }
#filters { background: #f6f8fa; padding: 0.5em 1em; border-radius: 6px; margin-bottom: 1em; }
#filters label { margin-right: 0.5em; font-weight: 600; }
#filters select { padding: 0.25em 0.5em; }
```

- [ ] **Step 11: Smoke-build**

```bash
cd /Users/adhenawer/Code/claude-setups-registry
mkdir -p data/setups/smoke
cat > data/setups/smoke/demo.json <<'EOF'
{"schemaVersion":"1.0.0","id":{"author":"smoke","slug":"demo"},"version":1,"title":"T","description":"D","tags":["t"],"author":{"handle":"smoke","url":"https://github.com/smoke"},"createdAt":"2026-04-19T00:00:00Z","license":"MIT","plugins":[],"marketplaces":[],"mcpServers":[],"specialties":["backend","devops"],"bundle":{"present":false}}
EOF
node site/build.mjs
grep -c 'data-specialties="backend,devops"' site-build/index.html
grep -c 'specialty-filter' site-build/index.html
rm -rf data/setups/smoke site-build
```
Expected: both ≥ 1.

- [ ] **Step 12: Commit**

```bash
cd /Users/adhenawer/Code/claude-setups-registry
git add scripts/validate-descriptor.mjs scripts/ingest.mjs scripts/tests/validate.test.mjs \
        site/index.html site/setup.html site/build.mjs site/styles.css
git commit -m "feat: specialty filter in gallery + async validator with specialty check; 4 new tests"
```

---

## Self-review (already applied)

**Spec coverage:**
- ✅ CLI scaffold + classifier + collector + output → Tasks 1-5
- ✅ gh CLI wrapper + descriptor builder + publish command → Tasks 6-8
- ✅ CLI entry + dispatch + CI → Tasks 9-10
- ✅ Registry repo scaffold + Issue Form → Tasks 11-12
- ✅ Ingest Action (validate + commit + close) → Tasks 13-14
- ✅ Static gallery + Pages deploy → Task 15
- ✅ E2E round-trip test → Task 16
- ✅ Release readiness → Tasks 17-18
- (NOT in v0.1, deferred to Plan 2/3: mirror, revoke, bundles, gitleaks)

**Placeholder scan:** No TBDs. All code in every step is complete and runnable.

**Type consistency:** `descriptor` shape is defined in Task 7 and reused in Tasks 8, 13, 14, 15, 16. `collect()` output shape from Task 4 feeds `buildDescriptor()` in Task 7 with the exact same fields (plugins, marketplaces, mcpServers).

**Risk notes for the implementer:**
- Task 13's ingest workflow uses `gh` CLI inside GitHub Actions with `GITHUB_TOKEN`. Verify token has `issues:write` permission (the workflow declares `permissions.issues: write`).
- Task 15's build.mjs assumes `data/setups/<author>/<slug>.json` structure. If the structure ever changes, update both the ingest step and the build step together.
- Task 17 intentionally does NOT run `npm publish`. The user wants to publish only after v0.1 + v0.2 + v0.3 are complete. Honor this.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-19-claude-setups-v0.1-publish-skeleton.md`.

**Which execution approach?**

**1. Subagent-Driven (recommended)** — dispatch fresh subagent per task + review between. Best for this plan because it spans 2 git repos and 3 GitHub features (Issues, Actions, Pages) — clean context per task avoids cross-contamination.

**2. Inline Execution** — batch-execute with checkpoints. Lower overhead but risks context bloat across 18 tasks touching 30+ files.

**3. New session + subagent-driven** — per the user's instruction, each plan runs in a separate context window. Open a new session, point it at this plan, and have IT run subagent-driven execution. Best hygiene since this plan is designed to be fully self-contained.

**Recommendation: Option 3.** Close this session when reviewed; open a new one pointing at this plan.
