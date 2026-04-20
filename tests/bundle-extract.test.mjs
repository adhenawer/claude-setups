import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('extractBundle', () => {
  async function makeTar(files) {
    const tar = await import('tar');
    const dir = await mkdtemp(join(tmpdir(), 'cs-mk-'));
    const stage = join(dir, 'stage');
    await mkdir(stage, { recursive: true });
    for (const f of files) {
      const p = join(stage, f.path);
      await mkdir(join(stage, f.path, '..'), { recursive: true });
      await writeFile(p, f.content);
    }
    const outPath = join(dir, 'bundle.tar.gz');
    await tar.c({ gzip: true, file: outPath, cwd: stage }, files.map(f => f.path));
    return { dir, outPath };
  }

  it('extracts files into the claudeHome with $HOME resolved', async () => {
    const { extractBundle } = await import('../src/bundle-extract.mjs');
    const { dir, outPath } = await makeTar([
      { path: 'hooks/a.sh', content: 'source $HOME/.claude/x.sh' },
      { path: 'CLAUDE.md', content: 'hello' },
    ]);
    const claudeHome = join(dir, '.claude');
    try {
      await extractBundle(outPath, claudeHome, { homeDir: '/Users/bob' });
      const hook = await readFile(join(claudeHome, 'hooks/a.sh'), 'utf-8');
      assert.match(hook, /source \/Users\/bob\/\.claude\/x\.sh/);
      const md = await readFile(join(claudeHome, 'CLAUDE.md'), 'utf-8');
      assert.equal(md, 'hello');
    } finally { await rm(dir, { recursive: true }); }
  });

  it('chmods hooks to 0o755', async () => {
    const { extractBundle } = await import('../src/bundle-extract.mjs');
    const { dir, outPath } = await makeTar([
      { path: 'hooks/a.sh', content: '#!/bin/bash\necho hi' },
    ]);
    const claudeHome = join(dir, '.claude');
    try {
      await extractBundle(outPath, claudeHome, { homeDir: '/Users/bob' });
      const s = await stat(join(claudeHome, 'hooks/a.sh'));
      assert.ok(s.mode & 0o100, 'owner execute bit should be set');
    } finally { await rm(dir, { recursive: true }); }
  });

  it('backs up existing file to .bak on conflict', async () => {
    const { extractBundle } = await import('../src/bundle-extract.mjs');
    const { dir, outPath } = await makeTar([
      { path: 'CLAUDE.md', content: 'new content' },
    ]);
    const claudeHome = join(dir, '.claude');
    await mkdir(claudeHome, { recursive: true });
    await writeFile(join(claudeHome, 'CLAUDE.md'), 'old content');
    try {
      const result = await extractBundle(outPath, claudeHome, { homeDir: '/Users/bob' });
      const backup = await readFile(join(claudeHome, 'CLAUDE.md.bak'), 'utf-8');
      assert.equal(backup, 'old content');
      const current = await readFile(join(claudeHome, 'CLAUDE.md'), 'utf-8');
      assert.equal(current, 'new content');
      assert.ok(result.backups.includes('CLAUDE.md'));
    } finally { await rm(dir, { recursive: true }); }
  });

  it('skips files that match existing content (idempotent)', async () => {
    const { extractBundle } = await import('../src/bundle-extract.mjs');
    const { dir, outPath } = await makeTar([
      { path: 'CLAUDE.md', content: 'same' },
    ]);
    const claudeHome = join(dir, '.claude');
    await mkdir(claudeHome, { recursive: true });
    await writeFile(join(claudeHome, 'CLAUDE.md'), 'same');
    try {
      const result = await extractBundle(outPath, claudeHome, { homeDir: '/Users/bob' });
      await assert.rejects(
        readFile(join(claudeHome, 'CLAUDE.md.bak'), 'utf-8'),
        /ENOENT/
      );
      assert.equal(result.backups.length, 0);
    } finally { await rm(dir, { recursive: true }); }
  });

  it('rejects tarballs with absolute or traversal paths', async () => {
    const { extractBundle } = await import('../src/bundle-extract.mjs');
    const { dir, outPath } = await makeTar([
      { path: '../escape.sh', content: 'x' },
    ]);
    const claudeHome = join(dir, '.claude');
    try {
      await assert.rejects(
        extractBundle(outPath, claudeHome, { homeDir: '/Users/bob' }),
        /disallowed path/i
      );
    } finally { await rm(dir, { recursive: true }); }
  });
});
