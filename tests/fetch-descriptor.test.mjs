import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(__dirname, 'fixtures/sample-descriptor.json');

function startServer(body, status = 200, contentType = 'application/json') {
  return new Promise(resolvePromise => {
    const server = createServer((req, res) => {
      res.writeHead(status, { 'content-type': contentType });
      res.end(body);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolvePromise({ url: `http://127.0.0.1:${port}/`, server });
    });
  });
}

describe('fetchDescriptor', () => {
  it('downloads + parses a valid descriptor JSON', async () => {
    const { fetchDescriptor } = await import('../src/fetch-descriptor.mjs');
    const body = await readFile(FIXTURE, 'utf-8');
    const { url, server } = await startServer(body);
    try {
      const d = await fetchDescriptor(url);
      assert.equal(d.id.slug, 'demo-setup');
      assert.equal(d.plugins.length, 1);
    } finally {
      server.close();
    }
  });

  it('throws on non-200 response', async () => {
    const { fetchDescriptor } = await import('../src/fetch-descriptor.mjs');
    const { url, server } = await startServer('not found', 404, 'text/plain');
    try {
      await assert.rejects(fetchDescriptor(url), /404|HTTP/i);
    } finally { server.close(); }
  });

  it('throws on invalid JSON', async () => {
    const { fetchDescriptor } = await import('../src/fetch-descriptor.mjs');
    const { url, server } = await startServer('{not-json');
    try {
      await assert.rejects(fetchDescriptor(url), /JSON/i);
    } finally { server.close(); }
  });

  it('rejects unsupported major schemaVersion', async () => {
    const { fetchDescriptor } = await import('../src/fetch-descriptor.mjs');
    const { url, server } = await startServer(JSON.stringify({
      schemaVersion: '99.0.0', id: { author: 'x', slug: 'y' },
      title: 't', description: 'd', tags: ['x'], plugins: [], marketplaces: [], mcpServers: []
    }));
    try {
      await assert.rejects(fetchDescriptor(url), /unsupported/i);
    } finally { server.close(); }
  });

  it('resolves short id form (author/slug) to registry URL', async () => {
    const { resolveUrl } = await import('../src/fetch-descriptor.mjs');
    const url = resolveUrl('alice/demo-setup', 'https://example.com');
    assert.equal(url, 'https://example.com/s/alice/demo-setup.json');
  });

  it('passes full URL through unchanged', async () => {
    const { resolveUrl } = await import('../src/fetch-descriptor.mjs');
    const url = resolveUrl('https://foo/bar.json', 'https://example.com');
    assert.equal(url, 'https://foo/bar.json');
  });
});
