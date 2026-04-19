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
