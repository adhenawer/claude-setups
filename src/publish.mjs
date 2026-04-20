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
    console.error(`\n📦 Bundle: ${candidates.length} files found. Review each one:\n`);
    const approved = await bundlePicker(candidates);
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
    const tempBranch = `bundle/${author}-${slug}-${Date.now()}`;
    const tarBytes = await readFile(tempTarPath);
    const base64 = tarBytes.toString('base64');

    // 1. Get default branch HEAD sha
    const headRes = await gh(
      ['api', `repos/${registryRepo}/git/refs/heads/main`, '--jq', '.object.sha'],
      {}
    );
    const parentSha = headRes.stdout.trim();

    // 2. Create blob
    const blobRes = await gh(
      [
        'api', `repos/${registryRepo}/git/blobs`,
        '-X', 'POST',
        '-f', `content=${base64}`,
        '-f', 'encoding=base64',
        '--jq', '.sha',
      ],
      {}
    );
    const blobSha = blobRes.stdout.trim();

    // 3. Create tree
    const treePath = `bundle-pending/${author}-${slug}.tar.gz`;
    const treeRes = await gh(
      [
        'api', `repos/${registryRepo}/git/trees`,
        '-X', 'POST',
        '-f', `base_tree=${parentSha}`,
        '-f', `tree[0][path]=${treePath}`,
        '-f', 'tree[0][mode]=100644',
        '-f', 'tree[0][type]=blob',
        '-f', `tree[0][sha]=${blobSha}`,
        '--jq', '.sha',
      ],
      {}
    );
    const treeSha = treeRes.stdout.trim();

    // 4. Create commit
    const commitRes = await gh(
      [
        'api', `repos/${registryRepo}/git/commits`,
        '-X', 'POST',
        '-f', `message=bundle pending for ${author}/${slug}`,
        '-f', `tree=${treeSha}`,
        '-f', `parents[]=${parentSha}`,
        '--jq', '.sha',
      ],
      {}
    );
    const commitSha = commitRes.stdout.trim();

    // 5. Create ref (the temp branch)
    await gh(
      [
        'api', `repos/${registryRepo}/git/refs`,
        '-X', 'POST',
        '-f', `ref=refs/heads/${tempBranch}`,
        '-f', `sha=${commitSha}`,
      ],
      {}
    );

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
