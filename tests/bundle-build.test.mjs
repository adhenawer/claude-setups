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
        createHash('sha256').update('hi').digest('hex'),
      );
    } finally { await rm(dir, { recursive: true }); }
  });
});
