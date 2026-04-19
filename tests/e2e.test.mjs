import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, 'fixtures/fake-claude-home');

describe('E2E: publish flow (with injected gh, simulating registry ingest)', () => {
  it('produces a descriptor that would successfully ingest on server-side', async () => {
    const { publishViaGh } = await import('../src/publish.mjs');

    let capturedBody = null;
    const mockGh = async (args) => {
      if (args[0] === 'issue' && args[1] === 'create') {
        const bodyIdx = args.indexOf('--body');
        capturedBody = args[bodyIdx + 1];
      }
      return { stdout: 'https://github.com/x/y/issues/1\n', stderr: '', code: 0 };
    };

    await publishViaGh({
      claudeHome: FIXTURES,
      author: 'alice',
      slug: 'e2e-test',
      title: 'E2E test setup',
      description: 'Full round-trip smoke test',
      tags: ['e2e', 'smoke'],
      specialties: ['backend'],
      registryRepo: 'x/y',
      gh: mockGh,
    });
    assert.ok(capturedBody, 'body should have been captured');

    const registryValidate = await import(
      resolve(__dirname, '../../claude-setups-registry/scripts/validate-descriptor.mjs')
    ).then(m => m.validate).catch(() => null);

    if (!registryValidate) {
      console.warn('SKIP: registry repo not present at ../claude-setups-registry — skipping round-trip');
      return;
    }
    const descriptor = JSON.parse(capturedBody);
    assert.doesNotThrow(() => registryValidate(descriptor, { issueAuthor: 'alice' }));

    assert.ok(!JSON.stringify(descriptor).includes('env'), 'mcpServers must not have env key (was just tested but verifies again)');
  });
});
