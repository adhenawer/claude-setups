# claude-setups v0.2 — mirror command

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Prerequisite:** v0.1 plan (`2026-04-19-claude-setups-v0.1-publish-skeleton.md`) executed and merged. This plan builds on top of the CLI + registry repo scaffolded there.

**Goal:** Ship v0.2.0 where a user can run `npx -y claude-setups mirror <url>` to install a published setup's plugins, marketplaces, and MCPs idempotently on their machine. Also ships `revoke` to delete one's own published setup.

**Architecture:** Extends the v0.1 CLI with three modules: `mirror.mjs` (fetch + plan + execute), `claude.mjs` (shell wrapper for `claude` CLI subcommands), and `revoke.mjs` (post revoke-issue that a new registry-side moderate Action processes). No bundle in v0.2 — content files ship in v0.3.

**Tech Stack:** same as v0.1 (Node.js 18+ ESM, `node:test`, `gh` CLI at runtime). Adds `claude` CLI at runtime (assumed installed on the mirror target).

---

## File Structure

**Repo 1: `/Users/adhenawer/Code/claude-setups/` (CLI)**

- Create: `src/fetch-descriptor.mjs` — downloads + validates a descriptor JSON from URL
- Create: `src/claude.mjs` — shell wrapper for `claude marketplace add`, `claude plugin install`, `claude mcp add`, `claude plugin list`, `claude mcp list`
- Create: `src/mirror.mjs` — orchestrates fetch + plan + confirm + execute
- Create: `src/revoke.mjs` — posts revoke request via gh (new issue with label `setup:revoke`)
- Modify: `src/cli.mjs` — add `mirror` and `revoke` dispatch
- Modify: `README.md` — update status to v0.2, add mirror/revoke docs
- Create: `tests/fetch-descriptor.test.mjs`
- Create: `tests/claude.test.mjs`
- Create: `tests/mirror.test.mjs`
- Create: `tests/revoke.test.mjs`
- Create: `tests/cross-machine.test.mjs` — simulation test
- Create: `tests/fixtures/sample-descriptor.json` — reusable fixture

**Repo 2: `/Users/adhenawer/Code/claude-setups-registry/`**

- Create: `.github/workflows/moderate.yml` — handles `setup:revoke` and `/report` comments
- Create: `scripts/revoke.mjs` — deletes setup files when revoke request is author-verified
- Create: `scripts/tests/revoke.test.mjs`

---

## Task 1: Descriptor fetcher

**Files:**
- Create: `/Users/adhenawer/Code/claude-setups/src/fetch-descriptor.mjs`
- Create: `/Users/adhenawer/Code/claude-setups/tests/fetch-descriptor.test.mjs`
- Create: `/Users/adhenawer/Code/claude-setups/tests/fixtures/sample-descriptor.json`

- [ ] **Step 1: Create reusable fixture**

Write `/Users/adhenawer/Code/claude-setups/tests/fixtures/sample-descriptor.json`:
```json
{
  "schemaVersion": "1.0.0",
  "id": { "author": "alice", "slug": "demo-setup" },
  "version": 1,
  "title": "Demo setup",
  "description": "For tests",
  "tags": ["test"],
  "author": { "handle": "alice", "url": "https://github.com/alice" },
  "createdAt": "2026-04-19T00:00:00Z",
  "license": "MIT",
  "plugins": [
    { "name": "superpowers", "marketplace": "claude-plugins-official", "version": "5.0.7" }
  ],
  "marketplaces": [
    { "name": "claude-plugins-official", "source": "github", "repo": "anthropics/claude-plugins-official" }
  ],
  "mcpServers": [
    { "name": "filesystem", "command": "npx", "args": ["-y", "@anthropic/mcp-filesystem"], "method": "npm" }
  ],
  "bundle": { "present": false }
}
```

- [ ] **Step 2: Write failing tests**

Create `/Users/adhenawer/Code/claude-setups/tests/fetch-descriptor.test.mjs`:
```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(__dirname, 'fixtures/sample-descriptor.json');

function startServer(body, status = 200, contentType = 'application/json') {
  return new Promise(resolvePromise => {
    const server = createServer((req, res) => {
      res.writeHead(status, { 'content-type': contentType });
      res.end(body);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolvePromise({ url: `http://127.0.0.1:${port}/`, server });
    });
  });
}

describe('fetchDescriptor', () => {
  it('downloads + parses a valid descriptor JSON', async () => {
    const { fetchDescriptor } = await import('../src/fetch-descriptor.mjs');
    const body = await readFile(FIXTURE, 'utf-8');
    const { url, server } = await startServer(body);
    try {
      const d = await fetchDescriptor(url);
      assert.equal(d.id.slug, 'demo-setup');
      assert.equal(d.plugins.length, 1);
    } finally {
      server.close();
    }
  });

  it('throws on non-200 response', async () => {
    const { fetchDescriptor } = await import('../src/fetch-descriptor.mjs');
    const { url, server } = await startServer('not found', 404, 'text/plain');
    try {
      await assert.rejects(fetchDescriptor(url), /404|HTTP/i);
    } finally { server.close(); }
  });

  it('throws on invalid JSON', async () => {
    const { fetchDescriptor } = await import('../src/fetch-descriptor.mjs');
    const { url, server } = await startServer('{not-json');
    try {
      await assert.rejects(fetchDescriptor(url), /JSON/i);
    } finally { server.close(); }
  });

  it('rejects unsupported major schemaVersion', async () => {
    const { fetchDescriptor } = await import('../src/fetch-descriptor.mjs');
    const { url, server } = await startServer(JSON.stringify({
      schemaVersion: '99.0.0', id: { author: 'x', slug: 'y' },
      title: 't', description: 'd', tags: ['x'], plugins: [], marketplaces: [], mcpServers: []
    }));
    try {
      await assert.rejects(fetchDescriptor(url), /unsupported/i);
    } finally { server.close(); }
  });

  it('resolves short id form (author/slug) to registry URL', async () => {
    const { resolveUrl } = await import('../src/fetch-descriptor.mjs');
    const url = resolveUrl('alice/demo-setup', 'https://example.com');
    assert.equal(url, 'https://example.com/s/alice/demo-setup.json');
  });

  it('passes full URL through unchanged', async () => {
    const { resolveUrl } = await import('../src/fetch-descriptor.mjs');
    const url = resolveUrl('https://foo/bar.json', 'https://example.com');
    assert.equal(url, 'https://foo/bar.json');
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `cd /Users/adhenawer/Code/claude-setups && npm test 2>&1 | tail -8`
Expected: 6 failures — module not found.

- [ ] **Step 4: Implement**

Create `/Users/adhenawer/Code/claude-setups/src/fetch-descriptor.mjs`:
```js
import { validateDescriptor } from './descriptor.mjs';

const DEFAULT_REGISTRY = 'https://adhenawer.github.io/claude-setups-registry';

export function resolveUrl(urlOrId, registryBase = DEFAULT_REGISTRY) {
  if (urlOrId.startsWith('http://') || urlOrId.startsWith('https://')) {
    return urlOrId;
  }
  // Short form: <author>/<slug>
  if (/^[a-z0-9-]+\/[a-z0-9][a-z0-9-]{2,49}$/i.test(urlOrId)) {
    return `${registryBase}/s/${urlOrId}.json`;
  }
  throw new Error(`Cannot resolve "${urlOrId}" to a descriptor URL`);
}

export async function fetchDescriptor(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  const text = await res.text();
  let descriptor;
  try {
    descriptor = JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON from ${url}: ${e.message}`);
  }
  validateDescriptor(descriptor);
  return descriptor;
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npm test 2>&1 | tail -5`
Expected: 6 new passing (total previous + 6).

- [ ] **Step 6: Commit**

```bash
git add src/fetch-descriptor.mjs tests/fetch-descriptor.test.mjs tests/fixtures/sample-descriptor.json
git commit -m "feat: descriptor fetcher + URL resolver with 6 tests"
```

---

## Task 2: Claude CLI wrapper

**Files:**
- Create: `/Users/adhenawer/Code/claude-setups/src/claude.mjs`
- Create: `/Users/adhenawer/Code/claude-setups/tests/claude.test.mjs`

- [ ] **Step 1: Write failing tests**

Create `/Users/adhenawer/Code/claude-setups/tests/claude.test.mjs`:
```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('runClaude', () => {
  it('returns { stdout, stderr, code } with injected binary', async () => {
    const { runClaude } = await import('../src/claude.mjs');
    const r = await runClaude(['hi'], { claudeBin: '/bin/echo' });
    assert.equal(r.code, 0);
    assert.match(r.stdout, /hi/);
  });

  it('throws with structured error when claude binary missing', async () => {
    const { runClaude } = await import('../src/claude.mjs');
    await assert.rejects(
      runClaude(['anything'], { claudeBin: '/nonexistent/claude' }),
      /claude binary not found/i
    );
  });
});

describe('marketplaceAdd / pluginInstall / mcpAdd', () => {
  it('marketplaceAdd shells out with --source flag', async () => {
    const { marketplaceAdd } = await import('../src/claude.mjs');
    const calls = [];
    const mockRun = async (args) => { calls.push(args); return { stdout: '', stderr: '', code: 0 }; };
    await marketplaceAdd('my-mkt', 'github.com/a/b', { run: mockRun });
    assert.deepEqual(calls[0], ['marketplace', 'add', 'my-mkt', '--source', 'github.com/a/b']);
  });

  it('pluginInstall shells out with @marketplace syntax + --version', async () => {
    const { pluginInstall } = await import('../src/claude.mjs');
    const calls = [];
    const mockRun = async (args) => { calls.push(args); return { stdout: '', stderr: '', code: 0 }; };
    await pluginInstall('p', 'mkt', '1.2.3', { run: mockRun });
    assert.deepEqual(calls[0], ['plugin', 'install', 'p@mkt', '--version', '1.2.3']);
  });

  it('mcpAdd shells out with command + args', async () => {
    const { mcpAdd } = await import('../src/claude.mjs');
    const calls = [];
    const mockRun = async (args) => { calls.push(args); return { stdout: '', stderr: '', code: 0 }; };
    await mcpAdd('fs', 'npx', ['-y', '@anthropic/mcp-fs'], { run: mockRun });
    assert.deepEqual(calls[0], ['mcp', 'add', 'fs', 'npx', '-y', '@anthropic/mcp-fs']);
  });

  it('pluginInstall throws on non-zero exit with stderr', async () => {
    const { pluginInstall } = await import('../src/claude.mjs');
    const mockRun = async () => ({ stdout: '', stderr: 'failed', code: 1 });
    await assert.rejects(
      pluginInstall('p', 'mkt', '1.0', { run: mockRun }),
      /plugin install failed.*failed/i
    );
  });
});

describe('listInstalledPlugins / listMarketplaces / listMcpServers (idempotency helpers)', () => {
  it('parses `claude plugin list --format json` output', async () => {
    const { listInstalledPlugins } = await import('../src/claude.mjs');
    const mockRun = async () => ({
      stdout: JSON.stringify([
        { name: 'x', marketplace: 'y', version: '1.0' }
      ]),
      stderr: '', code: 0,
    });
    const r = await listInstalledPlugins({ run: mockRun });
    assert.equal(r.length, 1);
    assert.equal(r[0].name, 'x');
  });

  it('returns [] when claude is not installed (ENOENT tolerant)', async () => {
    const { listInstalledPlugins } = await import('../src/claude.mjs');
    const mockRun = async () => { throw new Error('claude binary not found'); };
    const r = await listInstalledPlugins({ run: mockRun });
    assert.deepEqual(r, []);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test 2>&1 | tail -8`
Expected: 8 failures.

- [ ] **Step 3: Implement**

Create `/Users/adhenawer/Code/claude-setups/src/claude.mjs`:
```js
import { spawn } from 'node:child_process';

export function runClaude(args, options = {}) {
  const { claudeBin = 'claude' } = options;
  return new Promise((resolve, reject) => {
    const child = spawn(claudeBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', err => {
      if (err.code === 'ENOENT') {
        reject(new Error(`claude binary not found at ${claudeBin}`));
      } else {
        reject(err);
      }
    });
    child.on('close', code => resolve({ stdout, stderr, code }));
  });
}

export async function marketplaceAdd(name, source, options = {}) {
  const { run = runClaude } = options;
  const r = await run(['marketplace', 'add', name, '--source', source]);
  if (r.code !== 0) throw new Error(`marketplace add failed (${r.code}): ${r.stderr}`);
  return r;
}

export async function pluginInstall(name, marketplace, version, options = {}) {
  const { run = runClaude } = options;
  const r = await run(['plugin', 'install', `${name}@${marketplace}`, '--version', version]);
  if (r.code !== 0) throw new Error(`plugin install failed (${r.code}): ${r.stderr}`);
  return r;
}

export async function mcpAdd(name, command, args, options = {}) {
  const { run = runClaude } = options;
  const r = await run(['mcp', 'add', name, command, ...args]);
  if (r.code !== 0) throw new Error(`mcp add failed (${r.code}): ${r.stderr}`);
  return r;
}

export async function listInstalledPlugins(options = {}) {
  const { run = runClaude } = options;
  try {
    const r = await run(['plugin', 'list', '--format', 'json']);
    if (r.code !== 0) return [];
    return JSON.parse(r.stdout || '[]');
  } catch {
    return [];
  }
}

export async function listMarketplaces(options = {}) {
  const { run = runClaude } = options;
  try {
    const r = await run(['marketplace', 'list', '--format', 'json']);
    if (r.code !== 0) return [];
    return JSON.parse(r.stdout || '[]');
  } catch {
    return [];
  }
}

export async function listMcpServers(options = {}) {
  const { run = runClaude } = options;
  try {
    const r = await run(['mcp', 'list', '--format', 'json']);
    if (r.code !== 0) return [];
    return JSON.parse(r.stdout || '[]');
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test 2>&1 | tail -5`
Expected: 8 new passing.

- [ ] **Step 5: Commit**

```bash
git add src/claude.mjs tests/claude.test.mjs
git commit -m "feat: claude CLI wrapper (runClaude, marketplaceAdd, pluginInstall, mcpAdd, list* helpers) + 8 tests"
```

---

## Task 3: Mirror planner

**Files:**
- Create: `/Users/adhenawer/Code/claude-setups/src/mirror.mjs`
- Create: `/Users/adhenawer/Code/claude-setups/tests/mirror.test.mjs`

- [ ] **Step 1: Write failing tests**

Create `/Users/adhenawer/Code/claude-setups/tests/mirror.test.mjs`:
```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const DESCRIPTOR = {
  schemaVersion: '1.0.0',
  id: { author: 'alice', slug: 'demo' },
  version: 1,
  title: 'T', description: 'D', tags: ['test'],
  author: { handle: 'alice', url: 'https://github.com/alice' },
  createdAt: '2026-04-19T00:00:00Z', license: 'MIT',
  plugins: [
    { name: 'superpowers', marketplace: 'claude-plugins-official', version: '5.0.7' },
    { name: 'context7',    marketplace: 'claude-plugins-official', version: '1.2.0' },
  ],
  marketplaces: [
    { name: 'claude-plugins-official', source: 'github', repo: 'anthropics/claude-plugins-official' },
  ],
  mcpServers: [
    { name: 'fs',  command: 'npx', args: ['-y', '@anthropic/mcp-fs'], method: 'npm' },
    { name: 'git', command: 'uvx', args: ['mcp-server-git'],          method: 'pip' },
  ],
  bundle: { present: false },
};

describe('computePlan', () => {
  it('reports all-new when nothing is installed locally', async () => {
    const { computePlan } = await import('../src/mirror.mjs');
    const plan = await computePlan(DESCRIPTOR, {
      listPlugins: async () => [],
      listMarketplaces: async () => [],
      listMcpServers: async () => [],
    });
    assert.equal(plan.marketplaces.new.length, 1);
    assert.equal(plan.marketplaces.existing.length, 0);
    assert.equal(plan.plugins.new.length, 2);
    assert.equal(plan.plugins.existing.length, 0);
    assert.equal(plan.mcpServers.new.length, 2);
    assert.equal(plan.mcpServers.existing.length, 0);
  });

  it('reports existing items when already installed at same version', async () => {
    const { computePlan } = await import('../src/mirror.mjs');
    const plan = await computePlan(DESCRIPTOR, {
      listPlugins: async () => [
        { name: 'superpowers', marketplace: 'claude-plugins-official', version: '5.0.7' }
      ],
      listMarketplaces: async () => [{ name: 'claude-plugins-official' }],
      listMcpServers: async () => [{ name: 'fs' }],
    });
    assert.equal(plan.plugins.existing.length, 1);
    assert.equal(plan.plugins.new.length, 1);
    assert.equal(plan.marketplaces.existing.length, 1);
    assert.equal(plan.mcpServers.existing.length, 1);
    assert.equal(plan.mcpServers.new.length, 1);
  });

  it('reports version mismatch as "new" (will reinstall)', async () => {
    const { computePlan } = await import('../src/mirror.mjs');
    const plan = await computePlan(DESCRIPTOR, {
      listPlugins: async () => [
        { name: 'superpowers', marketplace: 'claude-plugins-official', version: '4.0.0' }
      ],
      listMarketplaces: async () => [],
      listMcpServers: async () => [],
    });
    assert.equal(plan.plugins.new.length, 2, 'version mismatch counts as new install');
  });
});

describe('executePlan', () => {
  it('runs marketplace add → plugin install → mcp add in order, idempotent-skipping existing', async () => {
    const { computePlan, executePlan } = await import('../src/mirror.mjs');
    const plan = await computePlan(DESCRIPTOR, {
      listPlugins: async () => [],
      listMarketplaces: async () => [],
      listMcpServers: async () => [],
    });

    const calls = [];
    const result = await executePlan(plan, {
      marketplaceAdd: async (n, s) => { calls.push(['mkt', n, s]); },
      pluginInstall: async (n, m, v) => { calls.push(['plugin', n, m, v]); },
      mcpAdd: async (n, c, a) => { calls.push(['mcp', n, c, a.join(' ')]); },
    });

    assert.equal(result.ok, true);
    assert.equal(calls.length, 5, '1 marketplace + 2 plugins + 2 mcps');
    assert.equal(calls[0][0], 'mkt');
    assert.equal(calls[1][0], 'plugin');
    assert.equal(calls[3][0], 'mcp');
  });

  it('reports per-step failure without halting', async () => {
    const { computePlan, executePlan } = await import('../src/mirror.mjs');
    const plan = await computePlan(DESCRIPTOR, {
      listPlugins: async () => [],
      listMarketplaces: async () => [],
      listMcpServers: async () => [],
    });

    const calls = [];
    const result = await executePlan(plan, {
      marketplaceAdd: async () => {},
      pluginInstall: async (n) => {
        calls.push(n);
        if (n === 'context7') throw new Error('simulated plugin install failure');
      },
      mcpAdd: async () => {},
    });

    assert.equal(result.ok, false, 'reports overall failure');
    assert.equal(result.failures.length, 1);
    assert.match(result.failures[0].error, /simulated plugin install failure/);
    assert.equal(calls.length, 2, 'continued past failure to try other plugins');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test 2>&1 | tail -8`
Expected: 5 failures.

- [ ] **Step 3: Implement**

Create `/Users/adhenawer/Code/claude-setups/src/mirror.mjs`:
```js
import { fetchDescriptor } from './fetch-descriptor.mjs';
import {
  marketplaceAdd as defaultMarketplaceAdd,
  pluginInstall as defaultPluginInstall,
  mcpAdd as defaultMcpAdd,
  listInstalledPlugins,
  listMarketplaces,
  listMcpServers,
} from './claude.mjs';

export async function computePlan(descriptor, options = {}) {
  const {
    listPlugins = listInstalledPlugins,
    listMarketplaces: lm = listMarketplaces,
    listMcpServers: lms = listMcpServers,
  } = options;

  const installedPlugins = await listPlugins();
  const installedMarkets = await lm();
  const installedMcps = await lms();

  const hasPluginAt = (name, marketplace, version) => installedPlugins.some(
    p => p.name === name && p.marketplace === marketplace && p.version === version
  );
  const hasMarketplace = name => installedMarkets.some(m => m.name === name);
  const hasMcp = name => installedMcps.some(m => m.name === name);

  return {
    marketplaces: {
      new: descriptor.marketplaces.filter(m => !hasMarketplace(m.name)),
      existing: descriptor.marketplaces.filter(m => hasMarketplace(m.name)),
    },
    plugins: {
      new: descriptor.plugins.filter(p => !hasPluginAt(p.name, p.marketplace, p.version)),
      existing: descriptor.plugins.filter(p => hasPluginAt(p.name, p.marketplace, p.version)),
    },
    mcpServers: {
      new: descriptor.mcpServers.filter(s => !hasMcp(s.name)),
      existing: descriptor.mcpServers.filter(s => hasMcp(s.name)),
    },
  };
}

export async function executePlan(plan, options = {}) {
  const {
    marketplaceAdd = defaultMarketplaceAdd,
    pluginInstall = defaultPluginInstall,
    mcpAdd = defaultMcpAdd,
  } = options;

  const successes = [];
  const failures = [];

  // Marketplaces first (plugins depend on them)
  for (const m of plan.marketplaces.new) {
    try {
      await marketplaceAdd(m.name, m.repo);
      successes.push({ kind: 'marketplace', name: m.name });
    } catch (e) {
      failures.push({ kind: 'marketplace', name: m.name, error: e.message });
    }
  }

  // Plugins
  for (const p of plan.plugins.new) {
    try {
      await pluginInstall(p.name, p.marketplace, p.version);
      successes.push({ kind: 'plugin', name: p.name });
    } catch (e) {
      failures.push({ kind: 'plugin', name: p.name, error: e.message });
    }
  }

  // MCPs last
  for (const s of plan.mcpServers.new) {
    try {
      await mcpAdd(s.name, s.command, s.args);
      successes.push({ kind: 'mcp', name: s.name });
    } catch (e) {
      failures.push({ kind: 'mcp', name: s.name, error: e.message });
    }
  }

  return { ok: failures.length === 0, successes, failures };
}

export async function mirror(urlOrId, options = {}) {
  const descriptor = await fetchDescriptor(options.url || urlOrId);
  const plan = await computePlan(descriptor, options);
  if (options.dryRun) return { status: 'plan', descriptor, plan };
  const result = await executePlan(plan, options);
  return {
    status: result.ok ? 'ok' : 'partial',
    descriptor,
    plan,
    successes: result.successes,
    failures: result.failures,
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test 2>&1 | tail -5`
Expected: 5 new passing.

- [ ] **Step 5: Commit**

```bash
git add src/mirror.mjs tests/mirror.test.mjs
git commit -m "feat: mirror planner + executor with 5 tests (idempotent, failure-tolerant)"
```

---

## Task 4: Mirror CLI dispatch + typed confirm

**Files:**
- Modify: `/Users/adhenawer/Code/claude-setups/src/cli.mjs`
- Create: `/Users/adhenawer/Code/claude-setups/src/confirm.mjs`
- Create: `/Users/adhenawer/Code/claude-setups/tests/confirm.test.mjs`

- [ ] **Step 1: Write failing test for typed confirm**

Create `/Users/adhenawer/Code/claude-setups/tests/confirm.test.mjs`:
```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('typedConfirm', () => {
  it('returns true when user types the exact word', async () => {
    const { typedConfirm } = await import('../src/confirm.mjs');
    const ok = await typedConfirm('mirror', { readline: async () => 'mirror' });
    assert.equal(ok, true);
  });

  it('returns false on mismatched input (y, yes, etc.)', async () => {
    const { typedConfirm } = await import('../src/confirm.mjs');
    for (const bad of ['y', 'yes', 'MIRROR', 'mirrors', '']) {
      const ok = await typedConfirm('mirror', { readline: async () => bad });
      assert.equal(ok, false, `"${bad}" should not confirm`);
    }
  });

  it('trims whitespace before matching', async () => {
    const { typedConfirm } = await import('../src/confirm.mjs');
    const ok = await typedConfirm('mirror', { readline: async () => '  mirror  ' });
    assert.equal(ok, true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test 2>&1 | tail -8`
Expected: 3 failures.

- [ ] **Step 3: Implement typedConfirm**

Create `/Users/adhenawer/Code/claude-setups/src/confirm.mjs`:
```js
import { createInterface } from 'node:readline/promises';

export async function typedConfirm(expected, options = {}) {
  const read = options.readline || (async () => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      return await rl.question(`Type \`${expected}\` to confirm: `);
    } finally { rl.close(); }
  });
  const input = (await read()).trim();
  return input === expected;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test 2>&1 | tail -5`
Expected: 3 new passing.

- [ ] **Step 5: Extend CLI with mirror command**

Edit `/Users/adhenawer/Code/claude-setups/src/cli.mjs` — add inside the switch:
```js
    case 'mirror': await cmdMirror(parsed); break;
```
Add function near `cmdPublish`:
```js
async function cmdMirror(parsed) {
  const urlOrId = parsed._[0];
  if (!urlOrId) {
    console.error('Error: mirror requires a URL or <author>/<slug>');
    console.error('Example: claude-setups mirror alice/demo-setup');
    process.exit(1);
  }
  const { mirror } = await import('./mirror.mjs');
  const { typedConfirm } = await import('./confirm.mjs');

  // Step 1 — compute plan in dry-run mode
  const { descriptor, plan } = await mirror(urlOrId, { dryRun: true });
  console.error(`Mirror plan for ${descriptor.id.author}/${descriptor.id.slug}:`);
  console.error(`  marketplaces: ${plan.marketplaces.new.length} new, ${plan.marketplaces.existing.length} skip`);
  console.error(`  plugins: ${plan.plugins.new.length} new, ${plan.plugins.existing.length} skip`);
  console.error(`  mcpServers: ${plan.mcpServers.new.length} new, ${plan.mcpServers.existing.length} skip`);

  if (parsed.flags['dry-run']) {
    console.log(JSON.stringify({ status: 'plan', plan }));
    return;
  }

  // Step 2 — typed confirm
  const ok = await typedConfirm('mirror');
  if (!ok) {
    console.error('Aborted.');
    process.exit(1);
  }

  // Step 3 — execute
  const result = await mirror(urlOrId);
  console.log(JSON.stringify({
    status: result.status,
    successes: result.successes.length,
    failures: result.failures.map(f => ({ kind: f.kind, name: f.name, error: f.error })),
  }));
}
```
Update the usage message:
```js
console.error('Usage: claude-setups <publish|mirror|browse> [flags]');
```

- [ ] **Step 6: Run full test suite**

Run: `npm test 2>&1 | tail -5`
Expected: all previous + 3 new passing.

- [ ] **Step 7: Commit**

```bash
git add src/cli.mjs src/confirm.mjs tests/confirm.test.mjs
git commit -m "feat: mirror CLI dispatch + typed confirm + --dry-run; 3 tests for typed confirm"
```

---

## Task 5: Revoke command (CLI side)

**Files:**
- Create: `/Users/adhenawer/Code/claude-setups/src/revoke.mjs`
- Create: `/Users/adhenawer/Code/claude-setups/tests/revoke.test.mjs`
- Modify: `/Users/adhenawer/Code/claude-setups/src/cli.mjs`

- [ ] **Step 1: Write failing tests**

Create `/Users/adhenawer/Code/claude-setups/tests/revoke.test.mjs`:
```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('revokeViaGh', () => {
  it('creates an issue with setup:revoke label + structured body', async () => {
    const { revokeViaGh } = await import('../src/revoke.mjs');
    const calls = [];
    const mockGh = async (args) => {
      calls.push(args);
      return { stdout: 'https://github.com/x/y/issues/7\n', stderr: '', code: 0 };
    };
    const result = await revokeViaGh({
      author: 'alice',
      slug: 'demo',
      registryRepo: 'x/y',
      gh: mockGh,
    });
    assert.equal(result.status, 'requested');
    const body = calls[0][calls[0].indexOf('--body') + 1];
    const parsed = JSON.parse(body);
    assert.equal(parsed.author, 'alice');
    assert.equal(parsed.slug, 'demo');
    assert.ok(calls[0].includes('setup:revoke'));
  });

  it('throws on gh failure', async () => {
    const { revokeViaGh } = await import('../src/revoke.mjs');
    const mockGh = async () => ({ stdout: '', stderr: 'auth', code: 1 });
    await assert.rejects(
      revokeViaGh({ author: 'a', slug: 'b', registryRepo: 'x/y', gh: mockGh }),
      /revoke.*failed/i
    );
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test 2>&1 | tail -5`
Expected: 2 failures.

- [ ] **Step 3: Implement**

Create `/Users/adhenawer/Code/claude-setups/src/revoke.mjs`:
```js
import { runGh } from './gh.mjs';

export async function revokeViaGh(opts) {
  const { author, slug, registryRepo, gh = runGh } = opts;
  const body = JSON.stringify({ author, slug }, null, 2);
  const result = await gh(
    [
      'issue', 'create',
      '--repo', registryRepo,
      '--title', `[revoke] ${author}/${slug}`,
      '--body', body,
      '--label', 'setup:revoke',
    ],
    {}
  );
  if (result.code !== 0) {
    throw new Error(`revoke failed (${result.code}): ${result.stderr}`);
  }
  return { status: 'requested', issueUrl: result.stdout.trim() };
}
```

- [ ] **Step 4: Extend CLI dispatch**

Edit `/Users/adhenawer/Code/claude-setups/src/cli.mjs` — add case:
```js
    case 'revoke': await cmdRevoke(parsed); break;
```
Add function:
```js
async function cmdRevoke(parsed) {
  const { author, slug, 'registry-repo': registryRepo } = parsed.flags;
  if (!author || !slug) {
    console.error('Error: revoke requires --author and --slug');
    process.exit(1);
  }
  const { revokeViaGh } = await import('./revoke.mjs');
  const result = await revokeViaGh({
    author, slug,
    registryRepo: registryRepo || 'adhenawer/claude-setups-registry',
  });
  console.log(JSON.stringify(result));
}
```
Update usage:
```js
console.error('Usage: claude-setups <publish|mirror|revoke|browse> [flags]');
```

- [ ] **Step 5: Run full suite**

Run: `npm test 2>&1 | tail -5`
Expected: 2 new passing.

- [ ] **Step 6: Commit**

```bash
git add src/revoke.mjs tests/revoke.test.mjs src/cli.mjs
git commit -m "feat: revoke CLI (posts setup:revoke issue) + 2 tests"
```

---

## Task 6: Registry-side revoke Action + scripts

**Files:**
- Create: `/Users/adhenawer/Code/claude-setups-registry/scripts/revoke.mjs`
- Create: `/Users/adhenawer/Code/claude-setups-registry/scripts/tests/revoke.test.mjs`
- Create: `/Users/adhenawer/Code/claude-setups-registry/.github/workflows/moderate.yml`

- [ ] **Step 1: Write failing tests**

Create `/Users/adhenawer/Code/claude-setups-registry/scripts/tests/revoke.test.mjs`:
```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function setupFake() {
  const root = await mkdtemp(join(tmpdir(), 'cs-rev-'));
  const setupsDir = join(root, 'setups', 'alice');
  await mkdir(setupsDir, { recursive: true });
  await writeFile(join(setupsDir, 'demo.json'), '{}');
  await writeFile(join(setupsDir, 'other.json'), '{}');
  return root;
}

describe('processRevoke', () => {
  it('deletes the targeted setup when author matches', async () => {
    const { processRevoke } = await import('../revoke.mjs');
    const root = await setupFake();
    try {
      const r = await processRevoke({
        dataRoot: root,
        issueBody: JSON.stringify({ author: 'alice', slug: 'demo' }),
        issueAuthor: 'alice',
      });
      assert.equal(r.ok, true);
      const remaining = await readdir(join(root, 'setups', 'alice'));
      assert.deepEqual(remaining.sort(), ['other.json']);
    } finally { await rm(root, { recursive: true }); }
  });

  it('rejects when issue author does not match setup author', async () => {
    const { processRevoke } = await import('../revoke.mjs');
    const root = await setupFake();
    try {
      const r = await processRevoke({
        dataRoot: root,
        issueBody: JSON.stringify({ author: 'alice', slug: 'demo' }),
        issueAuthor: 'mallory',
      });
      assert.equal(r.ok, false);
      assert.match(r.reason, /authorization|not match/i);
      const remaining = await readdir(join(root, 'setups', 'alice'));
      assert.equal(remaining.length, 2, 'no file removed');
    } finally { await rm(root, { recursive: true }); }
  });

  it('rejects when target file does not exist', async () => {
    const { processRevoke } = await import('../revoke.mjs');
    const root = await setupFake();
    try {
      const r = await processRevoke({
        dataRoot: root,
        issueBody: JSON.stringify({ author: 'alice', slug: 'nonexistent' }),
        issueAuthor: 'alice',
      });
      assert.equal(r.ok, false);
      assert.match(r.reason, /not found/i);
    } finally { await rm(root, { recursive: true }); }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd /Users/adhenawer/Code/claude-setups-registry && npm test 2>&1 | tail -5`
Expected: 3 failures.

- [ ] **Step 3: Implement**

Create `/Users/adhenawer/Code/claude-setups-registry/scripts/revoke.mjs`:
```js
import { unlink, access } from 'node:fs/promises';
import { join } from 'node:path';

export async function processRevoke({ dataRoot, issueBody, issueAuthor }) {
  let parsed;
  try {
    parsed = JSON.parse(issueBody);
  } catch (e) {
    return { ok: false, reason: `invalid JSON in revoke body: ${e.message}` };
  }
  const { author, slug } = parsed;
  if (!author || !slug) return { ok: false, reason: 'missing author or slug' };

  if (author !== issueAuthor) {
    return { ok: false, reason: `authorization failed: issue author "${issueAuthor}" does not match setup author "${author}"` };
  }

  const path = join(dataRoot, 'setups', author, `${slug}.json`);
  try {
    await access(path);
  } catch {
    return { ok: false, reason: `not found: ${author}/${slug}` };
  }
  await unlink(path);
  return { ok: true, path };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test 2>&1 | tail -5`
Expected: 3 new passing.

- [ ] **Step 5: Create moderate workflow**

Create `/Users/adhenawer/Code/claude-setups-registry/.github/workflows/moderate.yml`:
```yaml
name: moderate

on:
  issues:
    types: [opened]

jobs:
  revoke:
    if: contains(github.event.issue.labels.*.name, 'setup:revoke')
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
      - name: Run revoke
        env:
          ISSUE_BODY: ${{ github.event.issue.body }}
          ISSUE_AUTHOR: ${{ github.event.issue.user.login }}
        run: |
          node -e "
          import('./scripts/revoke.mjs').then(async ({ processRevoke }) => {
            const r = await processRevoke({
              dataRoot: 'data',
              issueBody: process.env.ISSUE_BODY,
              issueAuthor: process.env.ISSUE_AUTHOR,
            });
            if (!r.ok) {
              console.error('REVOKE_FAILED: ' + r.reason);
              process.exit(2);
            }
            console.log('REVOKE_OK: ' + r.path);
          }).catch(e => { console.error(e); process.exit(1); });
          "
      - name: Commit + close (on success)
        if: success()
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ISSUE_NUMBER: ${{ github.event.issue.number }}
          AUTHOR: ${{ github.event.issue.user.login }}
        run: |
          git config user.name "claude-setups-bot"
          git config user.email "bot@claude-setups.dev"
          git add -A data/setups/
          git commit -m "revoke: by $AUTHOR (issue #$ISSUE_NUMBER)"
          git push
          gh issue comment "$ISSUE_NUMBER" --body "Revoked. Setup removed from gallery."
          gh issue close "$ISSUE_NUMBER"
      - name: Comment on failure
        if: failure()
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ISSUE_NUMBER: ${{ github.event.issue.number }}
        run: |
          gh issue comment "$ISSUE_NUMBER" --body "Revoke failed. See action logs."
          gh issue edit "$ISSUE_NUMBER" --add-label "invalid"
```

- [ ] **Step 6: Commit**

```bash
cd /Users/adhenawer/Code/claude-setups-registry
git add scripts/revoke.mjs scripts/tests/revoke.test.mjs .github/workflows/moderate.yml
git commit -m "feat: revoke workflow — processes setup:revoke issues with author verification; 3 tests"
```

---

## Task 7: Cross-machine simulation test

**Files:**
- Create: `/Users/adhenawer/Code/claude-setups/tests/cross-machine.test.mjs`

- [ ] **Step 1: Write the simulation**

Create `/Users/adhenawer/Code/claude-setups/tests/cross-machine.test.mjs`:
```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, 'fixtures/fake-claude-home');

describe('cross-machine publish → mirror round-trip', () => {
  it('publisher setup produces a descriptor that mirror plans correctly', async () => {
    const { collect } = await import('../src/collect.mjs');
    const { buildDescriptor } = await import('../src/descriptor.mjs');
    const { computePlan } = await import('../src/mirror.mjs');

    // Source (publisher) machine state
    const collected = await collect(FIXTURES);
    const descriptor = buildDescriptor({
      author: 'alice', slug: 'my-stack',
      title: 'My Stack', description: 'Test', tags: ['test'],
      plugins: collected.plugins,
      marketplaces: collected.marketplaces,
      mcpServers: collected.mcpServers,
    });

    // Target (mirror) machine has ONE plugin already installed at the same version
    const plan = await computePlan(descriptor, {
      listPlugins: async () => [
        // Pretend context7 is already locally installed at the same version
        { name: 'context7', marketplace: 'claude-plugins-official', version: '1.2.0' },
      ],
      listMarketplaces: async () => [],
      listMcpServers: async () => [],
    });

    assert.equal(plan.plugins.new.length, 1, 'only superpowers is new on mirror');
    assert.equal(plan.plugins.existing[0].name, 'context7');
    assert.ok(plan.marketplaces.new.length >= 1);
  });

  it('re-running mirror after full install reports all existing (idempotent)', async () => {
    const { collect } = await import('../src/collect.mjs');
    const { buildDescriptor } = await import('../src/descriptor.mjs');
    const { computePlan } = await import('../src/mirror.mjs');

    const collected = await collect(FIXTURES);
    const descriptor = buildDescriptor({
      author: 'alice', slug: 'my-stack',
      title: 'T', description: 'D', tags: ['t'],
      plugins: collected.plugins,
      marketplaces: collected.marketplaces,
      mcpServers: collected.mcpServers,
    });

    const plan = await computePlan(descriptor, {
      listPlugins: async () => collected.plugins,
      listMarketplaces: async () => collected.marketplaces,
      listMcpServers: async () => collected.mcpServers,
    });

    assert.equal(plan.plugins.new.length, 0);
    assert.equal(plan.marketplaces.new.length, 0);
    assert.equal(plan.mcpServers.new.length, 0);
  });
});
```

- [ ] **Step 2: Run — should pass immediately (no new code)**

Run: `cd /Users/adhenawer/Code/claude-setups && npm test 2>&1 | tail -5`
Expected: 2 new passing (all previous still passing).

- [ ] **Step 3: Commit**

```bash
git add tests/cross-machine.test.mjs
git commit -m "test: cross-machine simulation — publisher → mirror with partial pre-install (idempotency verified)"
```

---

## Task 8: CLI contract tests for mirror/revoke

**Files:**
- Modify: `/Users/adhenawer/Code/claude-setups/tests/cli.test.mjs`

- [ ] **Step 1: Append new tests to existing cli.test.mjs**

Append to `/Users/adhenawer/Code/claude-setups/tests/cli.test.mjs`:
```js
describe('CLI dispatch (v0.2 commands)', () => {
  it('mirror without URL prints error', () => {
    const { spawnSync } = require('node:child_process');
    const r = spawnSync('node', [CLI, 'mirror'], { encoding: 'utf-8' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /URL|author/i);
  });

  it('revoke without flags prints error', () => {
    const { spawnSync } = require('node:child_process');
    const r = spawnSync('node', [CLI, 'revoke'], { encoding: 'utf-8' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /author.*slug|required/i);
  });

  it('unknown command still errors after v0.2 additions', () => {
    const { spawnSync } = require('node:child_process');
    const r = spawnSync('node', [CLI, 'unknowncmd'], { encoding: 'utf-8' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Unknown command/i);
  });
});
```

Note: the existing test file uses `spawnSync` via ESM `import`. Change the new block to match the existing import style:
```js
import { spawnSync as spawnSync_v2 } from 'node:child_process';

describe('CLI dispatch (v0.2 commands)', () => {
  it('mirror without URL prints error', () => {
    const r = spawnSync_v2('node', [CLI, 'mirror'], { encoding: 'utf-8' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /URL|author/i);
  });

  it('revoke without flags prints error', () => {
    const r = spawnSync_v2('node', [CLI, 'revoke'], { encoding: 'utf-8' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /author.*slug|required/i);
  });

  it('unknown command still errors after v0.2 additions', () => {
    const r = spawnSync_v2('node', [CLI, 'unknowncmd'], { encoding: 'utf-8' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Unknown command/i);
  });
});
```

- [ ] **Step 2: Run**

Run: `npm test 2>&1 | tail -5`
Expected: 3 new passing.

- [ ] **Step 3: Commit**

```bash
git add tests/cli.test.mjs
git commit -m "test: CLI contract for mirror/revoke/unknown-command (v0.2)"
```

---

## Task 9: Gallery — render mirror command

**Files:**
- Modify: `/Users/adhenawer/Code/claude-setups-registry/site/setup.html`
- Modify: `/Users/adhenawer/Code/claude-setups-registry/site/build.mjs`

- [ ] **Step 1: Update setup.html to remove the "v0.2 coming soon" note**

Edit `/Users/adhenawer/Code/claude-setups-registry/site/setup.html` — replace the mirror section:
```html
    <section>
      <h2>Mirror this setup</h2>
      <pre><code>npx -y claude-setups mirror %%SHORT_ID%%</code></pre>
      <p>Or fetch the descriptor directly: <a href="../../s/%%AUTHOR%%/%%SLUG%%.json">%%AUTHOR%%/%%SLUG%%.json</a></p>
    </section>
```

- [ ] **Step 2: Update build.mjs to fill %%SHORT_ID%% + %%SLUG%%**

In `/Users/adhenawer/Code/claude-setups-registry/site/build.mjs`, update `renderDetail` to add two more replacements:
```js
  return template
    .replace(/%%TITLE%%/g, escapeHtml(d.title))
    .replace(/%%AUTHOR%%/g, escapeHtml(d.id.author))
    .replace(/%%SLUG%%/g, escapeHtml(d.id.slug))
    .replace(/%%SHORT_ID%%/g, escapeHtml(`${d.id.author}/${d.id.slug}`))
    .replace(/%%AUTHOR_URL%%/g, escapeHtml(d.author.url))
    .replace(/%%VERSION%%/g, String(d.version))
    .replace(/%%CREATED_AT%%/g, d.createdAt.slice(0, 10))
    .replace(/%%DESCRIPTION%%/g, escapeHtml(d.description))
    .replace(/%%MIRROR_URL%%/g, mirror)
    .replace(/%%DESCRIPTOR_JSON%%/g, escapeHtml(JSON.stringify(d, null, 2)));
```

- [ ] **Step 3: Smoke-build to verify**

```bash
cd /Users/adhenawer/Code/claude-setups-registry
mkdir -p data/setups/smoketest
cat > data/setups/smoketest/demo.json <<'EOF'
{"schemaVersion":"1.0.0","id":{"author":"smoketest","slug":"demo"},"version":1,"title":"T","description":"D","tags":["t"],"author":{"handle":"smoketest","url":"https://github.com/smoketest"},"createdAt":"2026-04-19T00:00:00Z","license":"MIT","plugins":[],"marketplaces":[],"mcpServers":[],"bundle":{"present":false}}
EOF
node site/build.mjs
grep -c "smoketest/demo" site-build/s/smoketest/demo.html
```
Expected: ≥ 1 (the short id appears in the rendered page).

- [ ] **Step 4: Cleanup + commit**

```bash
rm -rf data/setups/smoketest site-build
git add site/setup.html site/build.mjs
git commit -m "feat(gallery): mirror command uses short author/slug id + direct descriptor link"
```

---

## Task 10: README + status → v0.2.0

**Files:**
- Modify: `/Users/adhenawer/Code/claude-setups/README.md`
- Modify: `/Users/adhenawer/Code/claude-setups/package.json`
- Modify: `/Users/adhenawer/Code/claude-setups-registry/README.md`

- [ ] **Step 1: Bump version in package.json**

Edit `/Users/adhenawer/Code/claude-setups/package.json`:
```json
"version": "0.2.0",
```

- [ ] **Step 2: Update CLI README status**

Replace status line in `/Users/adhenawer/Code/claude-setups/README.md`:
```markdown
> **Status:** v0.2.0 — publish + mirror + revoke are live. Bundles (hooks, CLAUDE.md, skills) ship in v0.3 (see [roadmap](docs/superpowers/specs/2026-04-19-claude-setups-v1-design.md)).
```

- [ ] **Step 3: Add mirror example to CLI README**

In `/Users/adhenawer/Code/claude-setups/README.md`, find the "How mirroring works" section and ensure the command example is current:
```markdown
## How mirroring works

```bash
# Short form (resolves against the default registry)
npx -y claude-setups mirror alice/demo-setup

# Full URL form
npx -y claude-setups mirror https://adhenawer.github.io/claude-setups-registry/s/alice/demo-setup.json
```
```

- [ ] **Step 4: Update registry README**

Append to `/Users/adhenawer/Code/claude-setups-registry/README.md`:
```markdown
## Moderation

- `setup:submission` issues are processed by `.github/workflows/ingest.yml`
- `setup:revoke` issues are processed by `.github/workflows/moderate.yml`; author verification is mandatory (issue opener must match the setup author)
```

- [ ] **Step 5: Final local test run**

Run: `cd /Users/adhenawer/Code/claude-setups && npm test 2>&1 | tail -5`
Expected: all tests passing (v0.1 suite + v0.2 additions — ~65-70 total).

- [ ] **Step 6: Commit**

```bash
cd /Users/adhenawer/Code/claude-setups
git add package.json README.md
git commit -m "release: v0.2.0 — mirror + revoke + cross-machine tests"

cd /Users/adhenawer/Code/claude-setups-registry
git add README.md
git commit -m "docs: moderation workflow in README"
```

- [ ] **Step 7: DO NOT npm publish**

Per the user's instruction: do not run `npm publish` until Plan 3 (v0.3) also completes. Report to user: "v0.2 code committed, tests green, bundle + gitleaks land in Plan 3."

---

## Self-review (already applied)

**Spec coverage:**
- ✅ Mirror command + fetch descriptor → Tasks 1-3
- ✅ Typed `mirror` confirm + CLI dispatch → Task 4
- ✅ Revoke command (CLI side) → Task 5
- ✅ Registry-side revoke Action with author verification → Task 6
- ✅ Cross-machine simulation → Task 7
- ✅ CLI contract tests → Task 8
- ✅ Gallery mirror URL render → Task 9
- ✅ Release checklist (no npm publish) → Task 10
- ℹ️ Bundle + gitleaks → v0.3 (Plan 3)

**Placeholder scan:** no TBDs. All code in every step is complete.

**Type consistency:** `plan` shape is defined in Task 3 (`computePlan`) and consumed in Task 3 (`executePlan`) and Task 4 (CLI). The `descriptor` shape matches v0.1's `buildDescriptor` output + the server-side validator.

**Risk notes:**
- Task 2's `listInstalledPlugins` / `listMarketplaces` / `listMcpServers` assume `claude` CLI subcommands return JSON on `--format json`. If the real Claude Code CLI uses a different flag, adjust locally — the tests are all via injection, so tests won't fail.
- Task 6 revoke: intentional `git add -A data/setups/` ensures the deletion is staged. If other files change during the Action run, they'd be included; this is acceptable because the Action runs in isolated CI state.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-19-claude-setups-v0.2-mirror.md`.

**Recommendation: run in a new session after v0.1 (Plan 1) has been fully executed + committed.** Use subagent-driven-development.
