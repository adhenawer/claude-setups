import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('loadSpecialties', () => {
  it('returns the canonical map with at least 15 entries', async () => {
    const { loadSpecialties } = await import('../src/specialties.mjs');
    const map = await loadSpecialties();
    assert.ok(Object.keys(map).length >= 15);
    assert.equal(map.backend, 'Backend engineer');
    assert.equal(map['data-engineer'], 'Data engineering');
  });
});

describe('validateSpecialties', () => {
  it('accepts 1–3 known keys', async () => {
    const { validateSpecialties } = await import('../src/specialties.mjs');
    assert.doesNotThrow(() => validateSpecialties(['backend']));
    assert.doesNotThrow(() => validateSpecialties(['backend', 'devops']));
    assert.doesNotThrow(() => validateSpecialties(['backend', 'devops', 'data-engineer']));
  });

  it('rejects empty array', async () => {
    const { validateSpecialties } = await import('../src/specialties.mjs');
    assert.throws(() => validateSpecialties([]), /at least one/i);
  });

  it('rejects more than 3 entries', async () => {
    const { validateSpecialties } = await import('../src/specialties.mjs');
    assert.throws(
      () => validateSpecialties(['backend', 'devops', 'data-engineer', 'frontend']),
      /at most 3/i
    );
  });

  it('rejects unknown key', async () => {
    const { validateSpecialties } = await import('../src/specialties.mjs');
    assert.throws(() => validateSpecialties(['ninja-rockstar']), /unknown specialty/i);
  });

  it('rejects duplicates', async () => {
    const { validateSpecialties } = await import('../src/specialties.mjs');
    assert.throws(() => validateSpecialties(['backend', 'backend']), /duplicate/i);
  });
});
