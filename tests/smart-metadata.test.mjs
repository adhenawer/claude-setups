import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('smart-metadata', () => {
  it('exports isClaudeAvailable and generateMetadata', async () => {
    const mod = await import('../src/smart-metadata.mjs');
    assert.equal(typeof mod.isClaudeAvailable, 'function');
    assert.equal(typeof mod.generateMetadata, 'function');
  });

  it('isClaudeAvailable returns a boolean', async () => {
    const { isClaudeAvailable } = await import('../src/smart-metadata.mjs');
    const result = await isClaudeAvailable();
    assert.equal(typeof result, 'boolean');
  });
});
