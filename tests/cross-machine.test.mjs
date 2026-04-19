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

    const collected = await collect(FIXTURES);
    const descriptor = await buildDescriptor({
      author: 'alice', slug: 'my-stack',
      title: 'My Stack', description: 'Test', tags: ['test'],
      specialties: ['backend'],
      plugins: collected.plugins,
      marketplaces: collected.marketplaces,
      mcpServers: collected.mcpServers,
    });

    const plan = await computePlan(descriptor, {
      listPlugins: async () => [
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
    const descriptor = await buildDescriptor({
      author: 'alice', slug: 'my-stack',
      title: 'T', description: 'D', tags: ['t'],
      specialties: ['backend'],
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
