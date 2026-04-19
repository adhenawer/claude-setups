import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('tildeHome', () => {
  it('replaces HOME prefix with tilde', async () => {
    const { tildeHome } = await import('../src/output.mjs');
    const { homedir } = await import('node:os');
    assert.equal(tildeHome(homedir() + '/x/y'), '~/x/y');
  });

  it('leaves unrelated paths untouched', async () => {
    const { tildeHome } = await import('../src/output.mjs');
    assert.equal(tildeHome('/tmp/foo'), '/tmp/foo');
  });
});

describe('shouldOutputJson', () => {
  it('true when --json in args', async () => {
    const { shouldOutputJson } = await import('../src/output.mjs');
    assert.equal(shouldOutputJson(['x', '--json']), true);
  });

  it('true when stdout is not a TTY (piped)', async () => {
    const { shouldOutputJson } = await import('../src/output.mjs');
    // In node --test stdout is not a TTY, so this should be true
    assert.equal(shouldOutputJson([]), true);
  });
});
