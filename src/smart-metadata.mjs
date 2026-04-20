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

function getGitHubUsername() {
  try {
    return execSync('gh api user --jq .login 2>/dev/null', { encoding: 'utf-8' }).trim();
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
    if (!parsed.author || parsed.author === 'unknown' || parsed.author.includes(' ')) {
      parsed.author = getGitHubUsername() || parsed.author || 'unknown';
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function generateOverview(claudeHome, collected, bundleFiles) {
  const bundleFileNames = (bundleFiles || [])
    .map(f => f.relativePath || f.path)
    .join(', ');

  const context = [
    `Plugins: ${collected.plugins.map(p => `${p.name} (${p.marketplace}@${p.version})`).join(', ') || 'none'}`,
    `MCP servers: ${collected.mcpServers.map(m => `${m.name} (${m.command} ${(m.args||[]).join(' ')})`).join(', ') || 'none'}`,
    `Marketplaces: ${collected.marketplaces.map(m => `${m.name} (${m.repo})`).join(', ') || 'none'}`,
    bundleFileNames ? `Bundle files: ${bundleFileNames}` : '',
  ].filter(Boolean).join('\n');

  const prompt = `Write a concise overview for a Claude Code setup. Markdown format.

Summarize what this setup includes and why someone would mirror it. One sentence per component. No file contents, no code blocks, no highlights section. The bundle files will be shown separately in an interactive viewer.

Keep under 1500 characters.

Setup:
${context}`;

  const output = await runClaude([
    '-p', prompt,
    '--output-format', 'text',
    '--model', 'sonnet',
    '--max-turns', '1',
  ]);

  if (!output) return null;
  let cleaned = output
    .replace(/^```markdown\n?/, '')
    .replace(/\n?```\s*$/, '')
    .trim();

  // Claude -p sometimes appends system prompt noise after the actual content.
  // Cut at the last markdown-like line (heading, list item, paragraph, or code block).
  const lines = cleaned.split('\n');
  let lastGoodLine = lines.length - 1;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line === '' || line.startsWith('#') || line.startsWith('-') || line.startsWith('*')
      || line.startsWith('`') || line.startsWith('>') || /^[A-Z]/.test(line) || /[.!)]$/.test(line)) {
      lastGoodLine = i;
      break;
    }
  }
  cleaned = lines.slice(0, lastGoodLine + 1).join('\n').trim();

  return cleaned.length > 2000 ? cleaned.slice(0, 2000) : cleaned;
}
