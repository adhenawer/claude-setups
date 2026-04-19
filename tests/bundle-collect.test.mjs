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
