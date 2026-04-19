import { join, dirname } from 'node:path';
import { readJsonSafe, fileExists } from './fs-helpers.mjs';
import { classifyMcpMethod } from './mcp.mjs';

/**
 * Read identifiers from ~/.claude/ and ~/.claude.json.
 * Explicitly NEVER reads: settings.json, .claude.json as a whole,
 * env sections, hook bodies, *.md contents.
 */
export async function collect(claudeHome) {
  const plugins = [];
  const installedRaw = await readJsonSafe(join(claudeHome, 'plugins/installed_plugins.json'));
  if (installedRaw?.plugins) {
    for (const [key, entries] of Object.entries(installedRaw.plugins)) {
      const userScoped = entries.filter(e => e.scope === 'user');
      if (userScoped.length === 0) continue;
      const [name, marketplace] = key.split('@');
      plugins.push({ name, marketplace, version: userScoped[0].version });
    }
  }

  const marketplaces = [];
  const mktRaw = await readJsonSafe(join(claudeHome, 'plugins/known_marketplaces.json'));
  if (mktRaw) {
    for (const [name, config] of Object.entries(mktRaw)) {
      marketplaces.push({
        name,
        source: config.source?.source || 'github',
        repo: config.source?.repo || '',
      });
    }
  }

  const mcpServers = [];
  const claudeJsonPath = join(dirname(claudeHome), '.claude.json');
  if (await fileExists(claudeJsonPath)) {
    const raw = await readJsonSafe(claudeJsonPath);
    if (raw?.mcpServers) {
      for (const [name, config] of Object.entries(raw.mcpServers)) {
        mcpServers.push({
          name,
          command: config.command,
          args: config.args || [],
          method: classifyMcpMethod(config),
        });
      }
    }
  }

  return { plugins, marketplaces, mcpServers };
}
