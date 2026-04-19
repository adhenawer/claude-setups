import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const FILES = [
  { relativePath: 'hooks/a.sh', size: 100, content: 'echo hi' },
  { relativePath: 'CLAUDE.md', size: 200, content: '# CLAUDE.md' },
  { relativePath: 'hooks/leak.sh', size: 150, content: 'TOKEN=ghp_abcdefghijklmnopqrstuvwxyz0123456789' },
];

describe('previewFiles (interactive)', () => {
  it('includes all files when user presses Enter (default Y) for each', async () => {
    const { previewFiles } = await import('../src/preview.mjs');
    let calls = 0;
    const ask = async () => { calls++; return ''; };
    const included = await previewFiles(FILES, { ask });
    assert.equal(included.length, 3);
    assert.equal(calls, 3);
  });

  it('excludes files where user types "n"', async () => {
    const { previewFiles } = await import('../src/preview.mjs');
    const responses = ['', 'n', ''];
    let i = 0;
    const ask = async () => responses[i++];
    const included = await previewFiles(FILES, { ask });
    assert.deepEqual(included.map(f => f.relativePath), ['hooks/a.sh', 'hooks/leak.sh']);
  });

  it('passes regex matches through to the prompt (for display)', async () => {
    const { previewFiles } = await import('../src/preview.mjs');
    const prompted = [];
    const ask = async (file, matches) => {
      prompted.push({ file: file.relativePath, matchCount: matches.length });
      return '';
    };
    await previewFiles(FILES, { ask });
    const leak = prompted.find(p => p.file === 'hooks/leak.sh');
    assert.ok(leak.matchCount >= 1, 'leak.sh should have regex matches');
  });
});
