import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('loadGitleaksRules', () => {
  it('parses the bundled TOML into an array of rules', async () => {
    const { loadGitleaksRules } = await import('../src/gitleaks.mjs');
    const rules = await loadGitleaksRules();
    assert.ok(rules.length >= 10);
    for (const r of rules) {
      assert.ok(r.id);
      assert.ok(r.description);
      assert.ok(r.regex instanceof RegExp);
    }
  });
});

describe('scanContent', () => {
  it('detects AWS access key', async () => {
    const { scanContent } = await import('../src/gitleaks.mjs');
    const matches = await scanContent(`aws_key = "AKIAIOSFODNN7EXAMPLE"`, 'file.txt');
    assert.ok(matches.some(m => m.ruleId === 'aws-access-key'));
  });

  it('detects GitHub PAT', async () => {
    const { scanContent } = await import('../src/gitleaks.mjs');
    const matches = await scanContent(
      `token = "ghp_abcdefghijklmnopqrstuvwxyz0123456789"`,
      'f.txt'
    );
    assert.ok(matches.some(m => m.ruleId === 'github-pat'));
  });

  it('detects Anthropic API key', async () => {
    const { scanContent } = await import('../src/gitleaks.mjs');
    const matches = await scanContent(
      `ANTHROPIC=sk-ant-api03-${'x'.repeat(95)}`,
      'f.txt'
    );
    assert.ok(matches.some(m => m.ruleId === 'anthropic-api-key'));
  });

  it('returns line numbers', async () => {
    const { scanContent } = await import('../src/gitleaks.mjs');
    const matches = await scanContent(
      `line1\nline2\ntoken=AKIAIOSFODNN7EXAMPLE\nline4`,
      'f.txt'
    );
    assert.ok(matches.length > 0);
    assert.equal(matches[0].line, 3);
  });

  it('returns [] on clean content', async () => {
    const { scanContent } = await import('../src/gitleaks.mjs');
    const matches = await scanContent(`# This is a clean README with no secrets.`, 'f.txt');
    assert.deepEqual(matches, []);
  });
});
