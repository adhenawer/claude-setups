import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('classifyMcpMethod', () => {
  it('classifies npx as npm', async () => {
    const { classifyMcpMethod } = await import('../src/mcp.mjs');
    assert.equal(classifyMcpMethod({ command: 'npx', args: [] }), 'npm');
  });

  it('classifies uvx as pip', async () => {
    const { classifyMcpMethod } = await import('../src/mcp.mjs');
    assert.equal(classifyMcpMethod({ command: 'uvx', args: [] }), 'pip');
  });

  it('classifies uv as pip', async () => {
    const { classifyMcpMethod } = await import('../src/mcp.mjs');
    assert.equal(classifyMcpMethod({ command: 'uv', args: [] }), 'pip');
  });

  it('classifies absolute path as binary', async () => {
    const { classifyMcpMethod } = await import('../src/mcp.mjs');
    assert.equal(classifyMcpMethod({ command: '/usr/local/bin/x' }), 'binary');
  });

  it('classifies node as binary', async () => {
    const { classifyMcpMethod } = await import('../src/mcp.mjs');
    assert.equal(classifyMcpMethod({ command: 'node', args: ['/x'] }), 'binary');
  });

  it('classifies unknown command as manual', async () => {
    const { classifyMcpMethod } = await import('../src/mcp.mjs');
    assert.equal(classifyMcpMethod({ command: 'my-runner' }), 'manual');
  });

  it('classifies missing command as manual', async () => {
    const { classifyMcpMethod } = await import('../src/mcp.mjs');
    assert.equal(classifyMcpMethod({}), 'manual');
  });
});
