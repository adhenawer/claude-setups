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

const COMMON_PLUGINS = new Set([
  'superpowers', 'context7', 'claude-hud', 'claude-mem', 'token-optimizer',
  'frontend-design', 'playwright', 'github', 'plugin-dev', 'snapshot',
]);

export async function generateMetadata(claudeHome, collected, bundleFiles = []) {
  const specialties = await loadSpecialties();
  const specialtyList = Object.entries(specialties)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  let claudeMd = '';
  try {
    claudeMd = await readFile(join(claudeHome, 'CLAUDE.md'), 'utf-8');
    if (claudeMd.length > 2000) claudeMd = claudeMd.slice(0, 2000) + '\n...(truncated)';
  } catch {}

  const rarePlugins = collected.plugins
    .map(p => p.name)
    .filter(n => !COMMON_PLUGINS.has(n));

  const customFiles = (bundleFiles || []).map(f => f.relativePath || f.path);
  const customHooks = customFiles.filter(p => p.startsWith('hooks/'));
  const customSkills = customFiles.filter(p => p.startsWith('skills/'));
  const customCommands = customFiles.filter(p => p.startsWith('commands/'));
  const customAgents = customFiles.filter(p => p.startsWith('agents/'));

  const context = [
    `Plugins (all): ${collected.plugins.map(p => p.name).join(', ') || 'none'}`,
    rarePlugins.length ? `Uncommon plugins (not in top-10): ${rarePlugins.join(', ')}` : 'Uncommon plugins: none',
    `MCP servers: ${collected.mcpServers.map(m => m.name).join(', ') || 'none'}`,
    customHooks.length ? `Custom hooks: ${customHooks.join(', ')}` : 'Custom hooks: none',
    customSkills.length ? `Custom skills: ${customSkills.join(', ')}` : 'Custom skills: none',
    customCommands.length ? `Custom commands: ${customCommands.join(', ')}` : 'Custom commands: none',
    customAgents.length ? `Custom agents: ${customAgents.join(', ')}` : 'Custom agents: none',
    claudeMd ? `\nCLAUDE.md:\n${claudeMd}` : '',
  ].join('\n');

  const prompt = `You are generating metadata for a Claude Code setup publishing to a community gallery.

CRITICAL: The gallery displays setups like GitHub repos — the AUTHOR is the primary identifier. Titles do NOT need to be globally unique. Your job is to produce an HONEST, SPECIFIC title that reflects what makes THIS setup distinctive — not a generic marketing line.

Step 1 — Identify the SIGNATURE (the most distinctive element):
  a) Uncommon plugins (listed below, if any)
  b) Custom hooks, skills, commands, or agents (user-authored, not from plugins)
  c) Distinctive CLAUDE.md conventions (specific patterns, tool-chains, languages)
  d) Unusual MCP servers

Step 2 — Title rules (max 60 chars):
  - If a signature exists → lead with it. Examples:
    "RTK token proxy + subagent routing"
    "Mobile conventions with Expo EAS workflow"
    "Tray API integration setup"
  - If NO signature (only popular plugins, no custom files, generic CLAUDE.md) → be honest:
    "Basic fullstack setup"
    "Standard backend starter"
  - NEVER use generic marketing words: "comprehensive", "advanced", "best practices", "optimized", "production-grade".
  - NEVER title it after what plugins DO — plugins are common; what's distinctive about THIS combination?

Step 3 — Slug rules:
  - Short kebab-case (3-5 words max), derived from the signature
  - Not the title, a URL-friendly identifier

Step 4 — Description (max 300 chars): factual, specific, leads with signature.

Return ONLY this JSON:
{
  "author": "github-username",
  "slug": "signature-based-slug",
  "title": "Signature-first title (max 60 chars)",
  "description": "Factual, max 300 chars",
  "tags": ["lowercase-keywords"],
  "specialties": ["pick-1-to-3"]
}

Setup contents:
${context}

Available specialties:
${specialtyList}

For author, use "unknown" if you cannot determine the GitHub username.`;

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
