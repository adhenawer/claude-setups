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
