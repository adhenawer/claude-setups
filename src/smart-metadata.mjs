import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadSpecialties } from './specialties.mjs';

const SCHEMA = {
  type: 'object',
  properties: {
    author: { type: 'string', description: 'GitHub username of the publisher' },
    slug: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]{1,49}$', description: 'URL-friendly identifier' },
    title: { type: 'string', maxLength: 80 },
    description: { type: 'string', maxLength: 500 },
    tags: { type: 'array', items: { type: 'string' }, maxItems: 10 },
    specialties: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3 },
  },
  required: ['author', 'slug', 'title', 'description', 'tags', 'specialties'],
};

function runClaude(args) {
  return new Promise((resolve) => {
    const child = spawn('claude', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.on('error', () => resolve(null));
    child.on('close', code => resolve(code === 0 ? stdout : null));
  });
}

export async function isClaudeAvailable() {
  const result = await runClaude(['--version']);
  return result !== null;
}

export async function generateMetadata(claudeHome, collected) {
  const specialties = await loadSpecialties();
  const specialtyList = Object.entries(specialties)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  let claudeMd = '';
  try {
    claudeMd = await readFile(join(claudeHome, 'CLAUDE.md'), 'utf-8');
    if (claudeMd.length > 2000) claudeMd = claudeMd.slice(0, 2000) + '\n...(truncated)';
  } catch {}

  const context = [
    `Plugins: ${collected.plugins.map(p => p.name).join(', ') || 'none'}`,
    `MCP servers: ${collected.mcpServers.map(m => m.name).join(', ') || 'none'}`,
    `Marketplaces: ${collected.marketplaces.map(m => m.name).join(', ') || 'none'}`,
    claudeMd ? `\nCLAUDE.md:\n${claudeMd}` : '',
  ].join('\n');

  const prompt = `You are analyzing a Claude Code setup to generate publish metadata.

Setup contents:
${context}

Available specialties (pick 1-3):
${specialtyList}

Generate metadata for publishing this setup. Infer the developer's profile from their plugins, MCP servers, and CLAUDE.md content.
- author: infer GitHub username from git config or use "unknown"
- slug: short kebab-case identifier describing this setup
- title: concise human-readable title (max 80 chars)
- description: what makes this setup useful (max 500 chars)
- tags: relevant keywords (lowercase, max 10)
- specialties: pick 1-3 from the list above that best match this setup

Return ONLY the JSON object.`;

  const output = await runClaude([
    '-p', prompt,
    '--output-format', 'json',
    '--json-schema', JSON.stringify(SCHEMA),
    '--model', 'haiku',
    '--bare',
    '--max-turns', '1',
  ]);

  if (!output) return null;

  try {
    const parsed = JSON.parse(output.trim());
    const validSpecialties = Object.keys(specialties);
    parsed.specialties = (parsed.specialties || []).filter(s => validSpecialties.includes(s));
    if (parsed.specialties.length === 0) parsed.specialties = ['other'];
    return parsed;
  } catch {
    return null;
  }
}
