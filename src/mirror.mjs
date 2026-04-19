import { fetchDescriptor } from './fetch-descriptor.mjs';
import {
  marketplaceAdd as defaultMarketplaceAdd,
  pluginInstall as defaultPluginInstall,
  mcpAdd as defaultMcpAdd,
  listInstalledPlugins,
  listMarketplaces,
  listMcpServers,
} from './claude.mjs';

export async function computePlan(descriptor, options = {}) {
  const {
    listPlugins = listInstalledPlugins,
    listMarketplaces: lm = listMarketplaces,
    listMcpServers: lms = listMcpServers,
  } = options;

  const installedPlugins = await listPlugins();
  const installedMarkets = await lm();
  const installedMcps = await lms();

  const hasPluginAt = (name, marketplace, version) => installedPlugins.some(
    p => p.name === name && p.marketplace === marketplace && p.version === version
  );
  const hasMarketplace = name => installedMarkets.some(m => m.name === name);
  const hasMcp = name => installedMcps.some(m => m.name === name);

  return {
    marketplaces: {
      new: descriptor.marketplaces.filter(m => !hasMarketplace(m.name)),
      existing: descriptor.marketplaces.filter(m => hasMarketplace(m.name)),
    },
    plugins: {
      new: descriptor.plugins.filter(p => !hasPluginAt(p.name, p.marketplace, p.version)),
      existing: descriptor.plugins.filter(p => hasPluginAt(p.name, p.marketplace, p.version)),
    },
    mcpServers: {
      new: descriptor.mcpServers.filter(s => !hasMcp(s.name)),
      existing: descriptor.mcpServers.filter(s => hasMcp(s.name)),
    },
  };
}

export async function executePlan(plan, options = {}) {
  const {
    marketplaceAdd = defaultMarketplaceAdd,
    pluginInstall = defaultPluginInstall,
    mcpAdd = defaultMcpAdd,
  } = options;

  const successes = [];
  const failures = [];

  for (const m of plan.marketplaces.new) {
    try {
      await marketplaceAdd(m.name, m.repo);
      successes.push({ kind: 'marketplace', name: m.name });
    } catch (e) {
      failures.push({ kind: 'marketplace', name: m.name, error: e.message });
    }
  }

  for (const p of plan.plugins.new) {
    try {
      await pluginInstall(p.name, p.marketplace, p.version);
      successes.push({ kind: 'plugin', name: p.name });
    } catch (e) {
      failures.push({ kind: 'plugin', name: p.name, error: e.message });
    }
  }

  for (const s of plan.mcpServers.new) {
    try {
      await mcpAdd(s.name, s.command, s.args);
      successes.push({ kind: 'mcp', name: s.name });
    } catch (e) {
      failures.push({ kind: 'mcp', name: s.name, error: e.message });
    }
  }

  return { ok: failures.length === 0, successes, failures };
}

export async function mirror(urlOrId, options = {}) {
  const descriptor = await fetchDescriptor(options.url || urlOrId);
  const plan = await computePlan(descriptor, options);
  if (options.dryRun) return { status: 'plan', descriptor, plan };
  const result = await executePlan(plan, options);
  return {
    status: result.ok ? 'ok' : 'partial',
    descriptor,
    plan,
    successes: result.successes,
    failures: result.failures,
  };
}
