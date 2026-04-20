#!/usr/bin/env node
import { realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { join } from 'node:path';

function parseArgs(argv) {
  const out = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        out.flags[key] = next;
        i++;
      } else {
        out.flags[key] = true;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

async function promptLine(question) {
  const { createInterface } = await import('node:readline');
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise(resolve => {
    rl.question(question, answer => { rl.close(); resolve(answer.trim()); });
  });
}

async function resolveMetadata(parsed, claudeHome, withBundle) {
  const flags = parsed.flags;
  const hasAllFlags = flags.title && flags.description && flags.tags
    && flags.author && flags.slug && flags.specialties;

  if (hasAllFlags) {
    return {
      author: flags.author,
      slug: flags.slug,
      title: flags.title,
      description: flags.description,
      tags: flags.tags.split(',').map(t => t.trim()).filter(Boolean),
      specialties: flags.specialties.split(',').map(s => s.trim()).filter(Boolean),
    };
  }

  const { collect } = await import('./collect.mjs');
  const collected = await collect(claudeHome);

  let bundleFiles = [];
  if (withBundle) {
    const { collectBundleCandidates } = await import('./bundle-collect.mjs');
    bundleFiles = await collectBundleCandidates(claudeHome);
  }

  const { isClaudeAvailable, generateMetadata } = await import('./smart-metadata.mjs');
  if (await isClaudeAvailable()) {
    console.error('Analyzing your setup with Claude...');
    const suggested = await generateMetadata(claudeHome, collected, bundleFiles);
    if (suggested) {
      console.error('');
      console.error(`  author:       ${suggested.author}`);
      console.error(`  slug:         ${suggested.slug}`);
      console.error(`  title:        ${suggested.title}`);
      console.error(`  description:  ${suggested.description}`);
      console.error(`  tags:         ${suggested.tags.join(', ')}`);
      console.error(`  specialties:  ${suggested.specialties.join(', ')}`);
      console.error('');
      const answer = await promptLine('Accept these? (y to accept, n to edit) ');
      if (answer.toLowerCase() === 'y' || answer === '') {
        return suggested;
      }
      return {
        author: (await promptLine(`author [${suggested.author}]: `)) || suggested.author,
        slug: (await promptLine(`slug [${suggested.slug}]: `)) || suggested.slug,
        title: (await promptLine(`title [${suggested.title}]: `)) || suggested.title,
        description: (await promptLine(`description [${suggested.description}]: `)) || suggested.description,
        tags: ((await promptLine(`tags [${suggested.tags.join(',')}]: `)) || suggested.tags.join(',')).split(',').map(t => t.trim()).filter(Boolean),
        specialties: ((await promptLine(`specialties [${suggested.specialties.join(',')}]: `)) || suggested.specialties.join(',')).split(',').map(s => s.trim()).filter(Boolean),
      };
    }
  }

  if (!process.stdin.isTTY) {
    console.error('Error: publish requires metadata. Use flags (--author, --slug, --title, --description, --tags, --specialties) or run interactively.');
    process.exit(1);
  }

  console.error('Enter setup metadata:');
  return {
    author: flags.author || await promptLine('author (GitHub username): '),
    slug: flags.slug || await promptLine('slug (e.g. my-setup): '),
    title: flags.title || await promptLine('title: '),
    description: flags.description || await promptLine('description: '),
    tags: (flags.tags || await promptLine('tags (comma-separated): ')).split(',').map(t => t.trim()).filter(Boolean),
    specialties: (flags.specialties || await promptLine('specialties (comma-separated): ')).split(',').map(s => s.trim()).filter(Boolean),
  };
}

async function cmdPublish(parsed) {
  const withBundle = !parsed.flags['no-bundle'];
  const claudeHome = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
  const registryRepo = parsed.flags['registry-repo'] || 'adhenawer/claude-setups-registry';

  const meta = await resolveMetadata(parsed, claudeHome, withBundle);

  let overview = null;
  const { isClaudeAvailable, generateOverview } = await import('./smart-metadata.mjs');
  if (await isClaudeAvailable()) {
    console.error('Generating detailed overview...');
    const { collect } = await import('./collect.mjs');
    const collected = await collect(claudeHome);
    let bundleFiles = [];
    if (withBundle) {
      const { collectBundleCandidates } = await import('./bundle-collect.mjs');
      bundleFiles = await collectBundleCandidates(claudeHome);
    }
    overview = await generateOverview(claudeHome, collected, bundleFiles);
    if (overview) {
      console.error('\n--- Overview preview ---\n');
      console.error(overview);
      console.error('\n--- End of overview ---\n');
    }
  }

  const { publishViaGh } = await import('./publish.mjs');
  const result = await publishViaGh({
    claudeHome,
    author: meta.author,
    slug: meta.slug,
    title: meta.title,
    description: meta.description,
    tags: meta.tags,
    specialties: meta.specialties,
    registryRepo: registryRepo,
    withBundle,
    overview,
  });

  console.log(JSON.stringify({
    status: 'ok',
    issueUrl: result.issueUrl,
    slug: meta.slug,
    author: meta.author,
    bundleFiles: result.descriptor.bundle?.files?.length || 0,
  }));
}

async function cmdMirror(parsed) {
  const urlOrId = parsed._[0];
  if (!urlOrId) {
    console.error('Error: mirror requires a URL or <author>/<slug>');
    console.error('Example: claude-setups mirror alice/demo-setup');
    process.exit(1);
  }
  const { mirror } = await import('./mirror.mjs');
  const { typedConfirm } = await import('./confirm.mjs');

  const { descriptor, plan } = await mirror(urlOrId, { dryRun: true });
  console.error(`Mirror plan for ${descriptor.id.author}/${descriptor.id.slug}:`);
  console.error(`  marketplaces: ${plan.marketplaces.new.length} new, ${plan.marketplaces.existing.length} skip`);
  console.error(`  plugins: ${plan.plugins.new.length} new, ${plan.plugins.existing.length} skip`);
  console.error(`  mcpServers: ${plan.mcpServers.new.length} new, ${plan.mcpServers.existing.length} skip`);

  if (parsed.flags['dry-run']) {
    console.log(JSON.stringify({ status: 'plan', plan }));
    return;
  }

  const ok = await typedConfirm('mirror');
  if (!ok) {
    console.error('Aborted.');
    process.exit(1);
  }

  const result = await mirror(urlOrId);
  console.log(JSON.stringify({
    status: result.status,
    successes: result.successes.length,
    failures: result.failures.map(f => ({ kind: f.kind, name: f.name, error: f.error })),
  }));
}

async function cmdRevoke(parsed) {
  const { author, slug, 'registry-repo': registryRepo } = parsed.flags;
  if (!author || !slug) {
    console.error('Error: revoke requires --author and --slug');
    process.exit(1);
  }
  const { revokeViaGh } = await import('./revoke.mjs');
  const result = await revokeViaGh({
    author, slug,
    registryRepo: registryRepo || 'adhenawer/claude-setups-registry',
  });
  console.log(JSON.stringify(result));
}

async function main() {
  const [,, command, ...rest] = process.argv;
  if (!command) {
    console.error('Usage: claude-setups <publish|mirror|revoke|browse> [flags]');
    process.exit(1);
  }
  const parsed = parseArgs(rest);

  switch (command) {
    case 'publish': await cmdPublish(parsed); break;
    case 'mirror': await cmdMirror(parsed); break;
    case 'revoke': await cmdRevoke(parsed); break;
    case 'browse': {
      console.log('Gallery: https://adhenawer.github.io/claude-setups-registry/');
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      console.error('Usage: claude-setups <publish|mirror|revoke|browse> [flags]');
      process.exit(1);
  }
}

async function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    const a = await realpath(process.argv[1]);
    const b = await realpath(fileURLToPath(import.meta.url));
    return a === b;
  } catch {
    return process.argv[1].endsWith('cli.mjs');
  }
}

if (await isMainModule()) {
  main().catch(err => {
    console.error(JSON.stringify({ status: 'error', message: err.message }));
    process.exit(1);
  });
}
