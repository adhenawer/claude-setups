import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('buildDescriptor', () => {
  it('assembles a descriptor with required fields', async () => {
    const { buildDescriptor } = await import('../src/descriptor.mjs');
    const d = await buildDescriptor({
      author: 'alice',
      slug: 'my-setup',
      title: 'My Python setup',
      description: 'A daily driver',
      tags: ['python'],
      plugins: [{ name: 'x', marketplace: 'y', version: '1.0' }],
      marketplaces: [{ name: 'y', source: 'github', repo: 'y/y' }],
      mcpServers: [{ name: 'z', command: 'npx', args: [], method: 'npm' }],
      specialties: ['backend'],
    });
    assert.equal(d.schemaVersion, '1.0.0');
    assert.equal(d.id.author, 'alice');
    assert.equal(d.id.slug, 'my-setup');
    assert.equal(d.version, 1);
    assert.equal(d.title, 'My Python setup');
    assert.equal(d.license, 'MIT');
    assert.ok(d.createdAt.match(/^\d{4}-\d{2}-\d{2}T/));
    assert.deepEqual(d.bundle, { present: false });
  });

  it('rejects invalid slug (uppercase)', async () => {
    const { buildDescriptor } = await import('../src/descriptor.mjs');
    await assert.rejects(async () => await buildDescriptor({
      author: 'a', slug: 'BadSlug', title: 't', description: 'd', tags: ['x'],
      plugins: [], marketplaces: [], mcpServers: [],
      specialties: ['backend'],
    }), /slug/i);
  });

  it('rejects empty title', async () => {
    const { buildDescriptor } = await import('../src/descriptor.mjs');
    await assert.rejects(async () => await buildDescriptor({
      author: 'a', slug: 'ok', title: '', description: 'd', tags: ['x'],
      plugins: [], marketplaces: [], mcpServers: [],
      specialties: ['backend'],
    }), /title/i);
  });

  it('rejects too many tags', async () => {
    const { buildDescriptor } = await import('../src/descriptor.mjs');
    const tooMany = Array.from({ length: 11 }, (_, i) => 't' + i);
    await assert.rejects(async () => await buildDescriptor({
      author: 'a', slug: 'ok', title: 't', description: 'd', tags: tooMany,
      plugins: [], marketplaces: [], mcpServers: [],
      specialties: ['backend'],
    }), /tags/i);
  });

  it('accepts version override for republish', async () => {
    const { buildDescriptor } = await import('../src/descriptor.mjs');
    const d = await buildDescriptor({
      author: 'a', slug: 'ok', title: 't', description: 'd', tags: ['x'],
      plugins: [], marketplaces: [], mcpServers: [], version: 3,
      specialties: ['backend'],
    });
    assert.equal(d.version, 3);
  });
});

describe('validateDescriptor', () => {
  it('accepts a well-formed descriptor', async () => {
    const { buildDescriptor, validateDescriptor } = await import('../src/descriptor.mjs');
    const d = await buildDescriptor({
      author: 'a', slug: 'ok', title: 't', description: 'd', tags: ['x'],
      plugins: [], marketplaces: [], mcpServers: [],
      specialties: ['backend'],
    });
    assert.doesNotThrow(() => validateDescriptor(d));
  });

  it('rejects missing schemaVersion', async () => {
    const { validateDescriptor } = await import('../src/descriptor.mjs');
    assert.throws(() => validateDescriptor({ id: { author: 'a', slug: 'b' } }), /schemaVersion/i);
  });

  it('rejects unsupported major schemaVersion', async () => {
    const { validateDescriptor } = await import('../src/descriptor.mjs');
    assert.throws(() => validateDescriptor({ schemaVersion: '99.0.0' }), /unsupported/i);
  });
});

describe('buildDescriptor with specialties', () => {
  it('includes specialties array in descriptor', async () => {
    const { buildDescriptor } = await import('../src/descriptor.mjs');
    const d = await buildDescriptor({
      author: 'a', slug: 'ok', title: 't', description: 'd', tags: ['x'],
      plugins: [], marketplaces: [], mcpServers: [],
      specialties: ['backend', 'devops'],
    });
    assert.deepEqual(d.specialties, ['backend', 'devops']);
  });

  it('rejects missing specialties (required)', async () => {
    const { buildDescriptor } = await import('../src/descriptor.mjs');
    await assert.rejects(async () => await buildDescriptor({
      author: 'a', slug: 'ok', title: 't', description: 'd', tags: ['x'],
      plugins: [], marketplaces: [], mcpServers: [],
    }), /specialties/i);
  });

  it('rejects unknown specialty', async () => {
    const { buildDescriptor } = await import('../src/descriptor.mjs');
    await assert.rejects(async () => await buildDescriptor({
      author: 'a', slug: 'ok', title: 't', description: 'd', tags: ['x'],
      plugins: [], marketplaces: [], mcpServers: [],
      specialties: ['rockstar-ninja'],
    }), /unknown specialty/i);
  });
});
