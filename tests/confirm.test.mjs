import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('typedConfirm', () => {
  it('returns true when user types the exact word', async () => {
    const { typedConfirm } = await import('../src/confirm.mjs');
    const ok = await typedConfirm('mirror', { readline: async () => 'mirror' });
    assert.equal(ok, true);
  });

  it('returns false on mismatched input (y, yes, etc.)', async () => {
    const { typedConfirm } = await import('../src/confirm.mjs');
    for (const bad of ['y', 'yes', 'MIRROR', 'mirrors', '']) {
      const ok = await typedConfirm('mirror', { readline: async () => bad });
      assert.equal(ok, false, `"${bad}" should not confirm`);
    }
  });

  it('trims whitespace before matching', async () => {
    const { typedConfirm } = await import('../src/confirm.mjs');
    const ok = await typedConfirm('mirror', { readline: async () => '  mirror  ' });
    assert.equal(ok, true);
  });
});
