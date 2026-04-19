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

async function cmdPublish(parsed) {
  const { title, description, tags, author, slug, 'registry-repo': registryRepo } = parsed.flags;
  if (!title || !description || !tags || !author || !slug) {
    console.error('Error: publish requires --title, --description, --tags, --author, --slug');
    console.error('Example: claude-setups publish --author alice --slug my-setup \\');
    console.error('           --title "My setup" --description "desc" --tags py,backend');
    process.exit(1);
  }

  const { publishViaGh } = await import('./publish.mjs');
  const claudeHome = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
  const registry = registryRepo || 'adhenawer/claude-setups-registry';

  const result = await publishViaGh({
    claudeHome,
    author,
    slug,
    title,
    description,
    tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    registryRepo: registry,
  });

  console.log(JSON.stringify({
    status: 'ok',
    issueUrl: result.issueUrl,
    slug,
    author,
  }));
}

async function main() {
  const [,, command, ...rest] = process.argv;
  if (!command) {
    console.error('Usage: claude-setups <publish|browse> [flags]');
    process.exit(1);
  }
  const parsed = parseArgs(rest);

  switch (command) {
    case 'publish': await cmdPublish(parsed); break;
    case 'browse': {
      console.log('Gallery: https://adhenawer.github.io/claude-setups-registry/');
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      console.error('Usage: claude-setups <publish|browse> [flags]');
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
