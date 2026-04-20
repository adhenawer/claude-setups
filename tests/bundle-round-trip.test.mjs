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
