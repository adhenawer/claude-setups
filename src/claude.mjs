import { spawn } from 'node:child_process';

export function runClaude(args, options = {}) {
  const { claudeBin = 'claude' } = options;
  return new Promise((resolve, reject) => {
    const child = spawn(claudeBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', err => {
      if (err.code === 'ENOENT') {
        reject(new Error(`claude binary not found at ${claudeBin}`));
      } else {
        reject(err);
      }
    });
    child.on('close', code => resolve({ stdout, stderr, code }));
  });
}

export async function marketplaceAdd(name, source, options = {}) {
  const { run = runClaude } = options;
  // Claude CLI: `plugin marketplace add <source>` — name is derived from source
  const r = await run(['plugin', 'marketplace', 'add', source]);
  if (r.code !== 0) throw new Error(`marketplace add failed (${r.code}): ${r.stderr}`);
  return r;
}

export async function pluginInstall(name, marketplace, version, options = {}) {
  const { run = runClaude } = options;
  // Claude CLI: `plugin install <name>@<marketplace>` — version comes from marketplace
  const spec = marketplace ? `${name}@${marketplace}` : name;
  const r = await run(['plugin', 'install', spec]);
  if (r.code !== 0) throw new Error(`plugin install failed (${r.code}): ${r.stderr}`);
  return r;
}

export async function mcpAdd(name, command, args, options = {}) {
  const { run = runClaude } = options;
  const r = await run(['mcp', 'add', name, command, ...args]);
  if (r.code !== 0) throw new Error(`mcp add failed (${r.code}): ${r.stderr}`);
  return r;
}

export async function listInstalledPlugins(options = {}) {
  const { run = runClaude } = options;
  try {
    const r = await run(['plugin', 'list', '--json']);
    if (r.code !== 0) return [];
    const raw = JSON.parse(r.stdout || '[]');
    // Claude CLI returns { id: "name@marketplace", version, ... }
    return raw.map(p => {
      if (p.name && p.marketplace) return p;
      const [name, marketplace] = (p.id || '').split('@');
      return { name, marketplace, version: p.version };
    });
  } catch {
    return [];
  }
}

export async function listMarketplaces(options = {}) {
  const { run = runClaude } = options;
  try {
    const r = await run(['plugin', 'marketplace', 'list', '--json']);
    if (r.code !== 0) return [];
    return JSON.parse(r.stdout || '[]');
  } catch {
    return [];
  }
}

export async function listMcpServers(options = {}) {
  const { run = runClaude } = options;
  try {
    const r = await run(['mcp', 'list', '--format', 'json']);
    if (r.code !== 0) return [];
    return JSON.parse(r.stdout || '[]');
  } catch {
    return [];
  }
}
