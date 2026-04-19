import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('revokeViaGh', () => {
  it('creates an issue with setup:revoke label + structured body', async () => {
    const { revokeViaGh } = await import('../src/revoke.mjs');
    const calls = [];
    const mockGh = async (args) => {
      calls.push(args);
      return { stdout: 'https://github.com/x/y/issues/7\n', stderr: '', code: 0 };
    };
    const result = await revokeViaGh({
      author: 'alice',
      slug: 'demo',
      registryRepo: 'x/y',
      gh: mockGh,
    });
    assert.equal(result.status, 'requested');
    const body = calls[0][calls[0].indexOf('--body') + 1];
    const parsed = JSON.parse(body);
    assert.equal(parsed.author, 'alice');
    assert.equal(parsed.slug, 'demo');
    assert.ok(calls[0].includes('setup:revoke'));
  });

  it('throws on gh failure', async () => {
    const { revokeViaGh } = await import('../src/revoke.mjs');
    const mockGh = async () => ({ stdout: '', stderr: 'auth', code: 1 });
    await assert.rejects(
      revokeViaGh({ author: 'a', slug: 'b', registryRepo: 'x/y', gh: mockGh }),
      /revoke.*failed/i
    );
  });
});
