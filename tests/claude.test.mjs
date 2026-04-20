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
  it('marketplaceAdd shells out with plugin marketplace add <source>', async () => {
    const { marketplaceAdd } = await import('../src/claude.mjs');
    const calls = [];
    const mockRun = async (args) => { calls.push(args); return { stdout: '', stderr: '', code: 0 }; };
    await marketplaceAdd('my-mkt', 'github.com/a/b', { run: mockRun });
    assert.deepEqual(calls[0], ['plugin', 'marketplace', 'add', 'github.com/a/b']);
  });

  it('pluginInstall shells out with plugin@marketplace syntax', async () => {
    const { pluginInstall } = await import('../src/claude.mjs');
    const calls = [];
    const mockRun = async (args) => { calls.push(args); return { stdout: '', stderr: '', code: 0 }; };
    await pluginInstall('p', 'mkt', '1.2.3', { run: mockRun });
    assert.deepEqual(calls[0], ['plugin', 'install', 'p@mkt']);
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
  it('parses `claude plugin list --json` output', async () => {
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
