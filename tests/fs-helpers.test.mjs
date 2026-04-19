import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('readJsonSafe', () => {
  it('returns parsed JSON on valid file', async () => {
    const { readJsonSafe } = await import('../src/fs-helpers.mjs');
    const dir = await mkdtemp(join(tmpdir(), 'cs-fs-'));
    try {
      const p = join(dir, 'a.json');
      await writeFile(p, '{"a":1}');
      assert.deepEqual(await readJsonSafe(p), { a: 1 });
    } finally { await rm(dir, { recursive: true }); }
  });

  it('returns null on missing file', async () => {
    const { readJsonSafe } = await import('../src/fs-helpers.mjs');
    assert.equal(await readJsonSafe('/nonexistent/x.json'), null);
  });

  it('returns null on invalid JSON', async () => {
    const { readJsonSafe } = await import('../src/fs-helpers.mjs');
    const dir = await mkdtemp(join(tmpdir(), 'cs-fs-'));
    try {
      const p = join(dir, 'bad.json');
      await writeFile(p, '{ not json');
      assert.equal(await readJsonSafe(p), null);
    } finally { await rm(dir, { recursive: true }); }
  });
});

describe('fileExists', () => {
  it('true for existing file', async () => {
    const { fileExists } = await import('../src/fs-helpers.mjs');
    const dir = await mkdtemp(join(tmpdir(), 'cs-fs-'));
    try {
      const p = join(dir, 'x');
      await writeFile(p, '');
      assert.equal(await fileExists(p), true);
    } finally { await rm(dir, { recursive: true }); }
  });

  it('false for missing path', async () => {
    const { fileExists } = await import('../src/fs-helpers.mjs');
    assert.equal(await fileExists('/nonexistent/y'), false);
  });
});
