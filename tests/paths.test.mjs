import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('normalizePaths', () => {
  it('replaces home prefix with $HOME in string values', async () => {
    const { normalizePaths } = await import('../src/paths.mjs');
    const input = { cmd: '/Users/alice/.claude/hooks/x.sh' };
    const out = normalizePaths(input, '/Users/alice');
    assert.equal(out.cmd, '$HOME/.claude/hooks/x.sh');
  });

  it('recurses into nested objects and arrays', async () => {
    const { normalizePaths } = await import('../src/paths.mjs');
    const input = {
      hooks: [
        { command: '/Users/alice/scripts/a.sh' },
        { command: '/tmp/unrelated' },
      ],
    };
    const out = normalizePaths(input, '/Users/alice');
    assert.equal(out.hooks[0].command, '$HOME/scripts/a.sh');
    assert.equal(out.hooks[1].command, '/tmp/unrelated');
  });

  it('escapes regex-special characters in home dir', async () => {
    const { normalizePaths } = await import('../src/paths.mjs');
    const input = { p: '/Users/a.b+c/x' };
    const out = normalizePaths(input, '/Users/a.b+c');
    assert.equal(out.p, '$HOME/x');
  });
});

describe('resolvePaths', () => {
  it('replaces $HOME with given home dir', async () => {
    const { resolvePaths } = await import('../src/paths.mjs');
    const input = { cmd: '$HOME/.claude/hooks/x.sh' };
    const out = resolvePaths(input, '/Users/bob');
    assert.equal(out.cmd, '/Users/bob/.claude/hooks/x.sh');
  });
});

describe('normalizeString / resolveString (single-string helpers for file contents)', () => {
  it('normalizeString replaces home prefix', async () => {
    const { normalizeString } = await import('../src/paths.mjs');
    assert.equal(
      normalizeString('run /Users/alice/.claude/hooks/x.sh', '/Users/alice'),
      'run $HOME/.claude/hooks/x.sh'
    );
  });

  it('resolveString replaces $HOME', async () => {
    const { resolveString } = await import('../src/paths.mjs');
    assert.equal(
      resolveString('run $HOME/.claude/hooks/x.sh', '/Users/bob'),
      'run /Users/bob/.claude/hooks/x.sh'
    );
  });
});
