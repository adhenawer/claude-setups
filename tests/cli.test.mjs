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
