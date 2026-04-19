import { collect } from './collect.mjs';
import { buildDescriptor } from './descriptor.mjs';
import { runGh } from './gh.mjs';

/**
 * Publish a setup via gh CLI.
 * @param {object} opts
 * @param {string} opts.claudeHome
 * @param {string} opts.author
 * @param {string} opts.slug
 * @param {string} opts.title
 * @param {string} opts.description
 * @param {string[]} opts.tags
 * @param {string} opts.registryRepo  e.g. "adhenawer/claude-setups-registry"
 * @param {Function} [opts.gh]         injected gh runner (for testing)
 */
export async function publishViaGh(opts) {
  const {
    claudeHome, author, slug, title, description, tags,
    registryRepo,
    gh = runGh,
  } = opts;

  const collected = await collect(claudeHome);
  const descriptor = buildDescriptor({
    author, slug, title, description, tags,
    plugins: collected.plugins,
    marketplaces: collected.marketplaces,
    mcpServers: collected.mcpServers,
  });

  const body = JSON.stringify(descriptor, null, 2);
  const result = await gh(
    [
      'issue', 'create',
      '--repo', registryRepo,
      '--title', `[setup] ${author}/${slug}: ${title}`,
      '--body', body,
      '--label', 'setup:submission',
    ],
    {}
  );
  if (result.code !== 0) {
    throw new Error(`gh issue create failed (exit ${result.code}): ${result.stderr}`);
  }
  const issueUrl = result.stdout.trim();
  return { status: 'ok', issueUrl, descriptor };
}

/**
 * Build the URL for the browser-fallback Issue Form.
 * Not used in unit tests; exercised in end-to-end test.
 */
export function buildBrowserFallbackUrl(registryRepo, descriptor) {
  const base = `https://github.com/${registryRepo}/issues/new`;
  const params = new URLSearchParams({
    template: 'setup-submission.yml',
    descriptor: JSON.stringify(descriptor),
  });
  return `${base}?${params.toString()}`;
}
