import { runGh } from './gh.mjs';

export async function revokeViaGh(opts) {
  const { author, slug, registryRepo, gh = runGh } = opts;
  const body = JSON.stringify({ author, slug }, null, 2);
  const result = await gh(
    [
      'issue', 'create',
      '--repo', registryRepo,
      '--title', `[revoke] ${author}/${slug}`,
      '--body', body,
      '--label', 'setup:revoke',
    ],
    {}
  );
  if (result.code !== 0) {
    throw new Error(`revoke failed (${result.code}): ${result.stderr}`);
  }
  return { status: 'requested', issueUrl: result.stdout.trim() };
}
