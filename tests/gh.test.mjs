import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('isGhAvailable', () => {
  it('returns a boolean (detection runs without error)', async () => {
    const { isGhAvailable } = await import('../src/gh.mjs');
    const result = await isGhAvailable();
    assert.equal(typeof result, 'boolean');
  });
});

describe('runGh', () => {
  it('throws with a structured error when binary missing', async () => {
    const { runGh } = await import('../src/gh.mjs');
    await assert.rejects(
      runGh(['definitely-not-a-real-subcommand-xyz'], { ghBin: '/nonexistent/gh' }),
      /gh binary not found/i
    );
  });

  it('returns { stdout, stderr, code } on successful execution (using echo as stand-in)', async () => {
    const { runGh } = await import('../src/gh.mjs');
    // Use /bin/echo as a stand-in for gh so this test doesn't depend on real gh.
    const result = await runGh(['hello'], { ghBin: '/bin/echo' });
    assert.equal(result.code, 0);
    assert.match(result.stdout, /hello/);
  });
});
