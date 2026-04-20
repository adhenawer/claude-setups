import { spawn, execSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadSpecialties } from './specialties.mjs';

function runClaude(args) {
  return new Promise((resolve) => {
    const child = spawn('claude', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.on('error', () => resolve(null));
    child.on('close', code => resolve(code === 0 ? stdout : null));
  });
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenced) return fenced[1].trim();
  const braces = text.match(/\{[\s\S]*\}/);
  if (braces) return braces[0].trim();
  return text.trim();
}

export async function isClaudeAvailable() {
  const result = await runClaude(['--version']);
  return result !== null;
}

function getGitUser() {
  try {
    return execSync('git config --global user.name', { encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
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
    claudeMd ? `\nCLAUDE.md (first 2000 chars):\n${claudeMd}` : '',
  ].join('\n');

  const prompt = `You are analyzing a Claude Code setup to generate publish metadata. Return a JSON object with these fields:

{
  "author": "github-username",
  "slug": "short-kebab-case-id",
  "title": "Concise title (max 80 chars)",
  "description": "What makes this setup useful (max 500 chars)",
  "tags": ["lowercase", "keywords"],
  "specialties": ["pick-from-list-below"]
}

Setup contents:
${context}

Available specialties (pick 1-3 that best match):
${specialtyList}

Infer the developer profile from plugins, MCP servers, and CLAUDE.md. For author, use "unknown" if you cannot determine the GitHub username. Return ONLY the JSON object, nothing else.`;

  const output = await runClaude([
    '-p', prompt,
    '--output-format', 'text',
    '--model', 'haiku',
    '--max-turns', '1',
  ]);

  if (!output) return null;

  try {
    const json = extractJson(output);
    const parsed = JSON.parse(json);
    const validSpecialties = Object.keys(specialties);
    parsed.specialties = (parsed.specialties || []).filter(s => validSpecialties.includes(s));
    if (parsed.specialties.length === 0) parsed.specialties = ['other'];
    if (!parsed.author || parsed.author === 'unknown') {
      parsed.author = getGitUser() || 'unknown';
    }
    return parsed;
  } catch {
    return null;
  }
}
