import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, 'fixtures/fake-claude-home');

describe('publishViaGh', () => {
  it('builds descriptor and posts an issue via injected gh runner', async () => {
    const { publishViaGh } = await import('../src/publish.mjs');
    const ghCalls = [];
    const mockGh = async (args, opts) => {
      ghCalls.push({ args, stdin: opts?.stdin });
      return { stdout: 'https://github.com/x/y/issues/42\n', stderr: '', code: 0 };
    };
    const result = await publishViaGh({
      claudeHome: FIXTURES,
      author: 'alice',
      slug: 'my-setup',
      title: 'My setup',
      description: 'desc',
      tags: ['test'],
      specialties: ['backend'],
      registryRepo: 'adhenawer/claude-setups-registry',
      gh: mockGh,
    });
    assert.equal(result.status, 'ok');
    assert.match(result.issueUrl, /issues\/42/);
    const issueCall = ghCalls.find(c => c.args[0] === 'issue');
    assert.ok(issueCall, 'should have called gh issue create');
    assert.ok(issueCall.args.includes('--repo'));
    assert.ok(issueCall.args.includes('adhenawer/claude-setups-registry'));
    assert.ok(issueCall.args.includes('--label'));
  });

  it('includes validated descriptor as issue body', async () => {
    const { publishViaGh } = await import('../src/publish.mjs');
    const ghCalls = [];
    const mockGh = async (args, opts) => {
      ghCalls.push({ args, stdin: opts?.stdin });
      return { stdout: 'https://github.com/x/y/issues/1', stderr: '', code: 0 };
    };
    await publishViaGh({
      claudeHome: FIXTURES, author: 'alice', slug: 'my-setup',
      title: 'T', description: 'D', tags: ['t'],
      specialties: ['backend'],
      registryRepo: 'x/y', gh: mockGh,
    });
    const issueCall = ghCalls.find(c => c.args[0] === 'issue');
    const bodyIdx = issueCall.args.indexOf('--body');
    assert.ok(bodyIdx > 0);
    const body = issueCall.args[bodyIdx + 1];
    assert.match(body, /"schemaVersion": "1\.0\.0"/);
    assert.match(body, /"slug": "my-setup"/);
    assert.ok(!body.includes('LEAK_SENTINEL'), 'MCP env must not appear in body');
    assert.ok(!body.includes('MUST_NOT_LEAK'), 'oauthAccount must not appear in body');
  });

  it('throws when gh call fails', async () => {
    const { publishViaGh } = await import('../src/publish.mjs');
    const failingGh = async () => ({ stdout: '', stderr: 'auth required', code: 1 });
    await assert.rejects(
      publishViaGh({
        claudeHome: FIXTURES, author: 'a', slug: 'b-cd',
        title: 'T', description: 'D', tags: ['t'],
        specialties: ['backend'],
        registryRepo: 'x/y', gh: failingGh,
      }),
      /gh issue create failed/i
    );
  });
});
