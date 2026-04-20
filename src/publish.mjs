import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { collect } from './collect.mjs';
import { buildDescriptor } from './descriptor.mjs';
import { runGh } from './gh.mjs';
import { collectBundleCandidates } from './bundle-collect.mjs';
import { previewFiles } from './preview.mjs';
import { buildBundle } from './bundle-build.mjs';

export async function publishViaGh(opts) {
  const {
    claudeHome, author, slug, title, description, tags, specialties,
    registryRepo,
    withBundle = false,
    bundlePicker = previewFiles,
    overview = null,
    gh = runGh,
  } = opts;

  const collected = await collect(claudeHome);

  // Bundle assembly, if requested
  let bundleInfo = { present: false };
  let tempTarPath = null;
  if (withBundle) {
    const candidates = await collectBundleCandidates(claudeHome);
    console.error(`\n📦 Bundle: ${candidates.length} files included\n`);
    const approved = candidates;
    if (approved.length > 0) {
      const tempDir = await mkdtemp(join(tmpdir(), 'cs-pub-'));
      tempTarPath = join(tempDir, `${slug}.tar.gz`);
      const homeDir = dirname(claudeHome);
      const built = await buildBundle(approved, tempTarPath, { homeDir });
      bundleInfo = {
        present: true,
        sha256: built.sha256,
        files: built.files,
      };
    }
  }

  const descriptor = await buildDescriptor({
    author, slug, title, description, tags, specialties,
    plugins: collected.plugins,
    marketplaces: collected.marketplaces,
    mcpServers: collected.mcpServers,
  });
  descriptor.bundle = bundleInfo;
  if (overview) descriptor.overview = overview;
  if (bundleInfo.present) {
    descriptor.bundle.url =
      `https://${registryRepo.split('/')[0]}.github.io/${registryRepo.split('/')[1]}/bundles/${author}/${slug}.tar.gz`;
  }

  // Push bundle tarball to temp branch (if present)
  if (bundleInfo.present && tempTarPath) {
    async function ghApi(label, args, options = {}) {
      const res = await gh(args, options);
      if (res.code !== 0) {
        throw new Error(`${label} failed (exit ${res.code}): ${res.stderr || res.stdout}`);
      }
      const out = res.stdout.trim();
      if (!out) {
        throw new Error(`${label} returned empty response. stderr: ${res.stderr}`);
      }
      return out;
    }

    const tempBranch = `bundle/${author}-${slug}-${Date.now()}`;
    const tarBytes = await readFile(tempTarPath);
    const base64 = tarBytes.toString('base64');

    console.error(`\n📤 Pushing bundle to ${registryRepo}...`);

    // 1. Detect default branch
    const defaultBranch = await ghApi(
      'detect default branch',
      ['api', `repos/${registryRepo}`, '--jq', '.default_branch'],
    );
    console.error(`  default branch: ${defaultBranch}`);

    // 2. Get HEAD sha
    const parentSha = await ghApi(
      'get HEAD sha',
      ['api', `repos/${registryRepo}/git/refs/heads/${defaultBranch}`, '--jq', '.object.sha'],
    );
    console.error(`  parent sha: ${parentSha.slice(0, 12)}…`);

    // 3. Create blob (pass JSON via stdin to avoid command-line size limits)
    const blobBody = JSON.stringify({ content: base64, encoding: 'base64' });
    const blobSha = await ghApi(
      'create blob',
      ['api', `repos/${registryRepo}/git/blobs`, '-X', 'POST', '--input', '-', '--jq', '.sha'],
      { stdin: blobBody },
    );
    console.error(`  blob sha: ${blobSha.slice(0, 12)}… (${base64.length} chars base64)`);

    // 4. Create tree
    const treePath = `bundle-pending/${author}-${slug}.tar.gz`;
    const treeBody = JSON.stringify({
      base_tree: parentSha,
      tree: [{ path: treePath, mode: '100644', type: 'blob', sha: blobSha }],
    });
    const treeSha = await ghApi(
      'create tree',
      ['api', `repos/${registryRepo}/git/trees`, '-X', 'POST', '--input', '-', '--jq', '.sha'],
      { stdin: treeBody },
    );
    console.error(`  tree sha: ${treeSha.slice(0, 12)}…`);

    // 5. Create commit
    const commitBody = JSON.stringify({
      message: `bundle pending for ${author}/${slug}`,
      tree: treeSha,
      parents: [parentSha],
    });
    const commitSha = await ghApi(
      'create commit',
      ['api', `repos/${registryRepo}/git/commits`, '-X', 'POST', '--input', '-', '--jq', '.sha'],
      { stdin: commitBody },
    );
    console.error(`  commit sha: ${commitSha.slice(0, 12)}…`);

    // 6. Create ref (the temp branch)
    const refBody = JSON.stringify({ ref: `refs/heads/${tempBranch}`, sha: commitSha });
    await ghApi(
      'create ref',
      ['api', `repos/${registryRepo}/git/refs`, '-X', 'POST', '--input', '-'],
      { stdin: refBody },
    );
    console.error(`  branch created: ${tempBranch}\n`);

    descriptor.bundle.pendingBranch = tempBranch;

    // Clean up local staging
    await rm(dirname(tempTarPath), { recursive: true, force: true });
  }

  // Create the issue with the descriptor body
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

export function buildBrowserFallbackUrl(registryRepo, descriptor) {
  const base = `https://github.com/${registryRepo}/issues/new`;
  const params = new URLSearchParams({
    template: 'setup-submission.yml',
    descriptor: JSON.stringify(descriptor),
  });
  return `${base}?${params.toString()}`;
}
