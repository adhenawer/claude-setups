import { mkdir, writeFile, rm, readFile, chmod } from 'node:fs/promises';
import { dirname, join, isAbsolute, relative } from 'node:path';
import * as tar from 'tar';
import { fileExists } from './fs-helpers.mjs';
import { resolveString } from './paths.mjs';

export async function extractBundle(tarPath, claudeHome, options = {}) {
  const { homeDir } = options;
  const stagingDir = tarPath + '.extract-staging';
  await mkdir(stagingDir, { recursive: true });
  const backups = [];

  try {
    // Pre-scan: reject tarballs with absolute or traversal paths
    await validateTarEntries(tarPath);

    await tar.extract({ file: tarPath, cwd: stagingDir });

    // Walk the staged tree and write to claudeHome with .bak on conflict
    await walkAndApply(stagingDir, stagingDir, claudeHome, homeDir, backups);
  } finally {
    await rm(stagingDir, { recursive: true, force: true });
  }

  return { backups };
}

async function validateTarEntries(tarPath) {
  const entries = [];
  await tar.list({
    file: tarPath,
    onReadEntry(entry) { entries.push(entry.path); },
  });
  for (const p of entries) {
    if (isAbsolute(p) || p.includes('..')) {
      throw new Error(`Disallowed path in bundle: ${p}`);
    }
  }
}

async function walkAndApply(root, current, claudeHome, homeDir, backups) {
  const { readdir, stat } = await import('node:fs/promises');
  const entries = await readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(current, entry.name);
    if (entry.isDirectory()) {
      await walkAndApply(root, fullPath, claudeHome, homeDir, backups);
      continue;
    }
    const rel = relative(root, fullPath);

    // Security: reject absolute paths or traversals
    if (isAbsolute(rel) || rel.includes('..') || rel.startsWith('/')) {
      throw new Error(`disallowed path in bundle: ${rel}`);
    }

    const content = await readFile(fullPath, 'utf-8');
    const resolved = homeDir ? resolveString(content, homeDir) : content;
    const targetPath = join(claudeHome, rel);
    await mkdir(dirname(targetPath), { recursive: true });

    if (await fileExists(targetPath)) {
      const existing = await readFile(targetPath, 'utf-8');
      if (existing === resolved) continue;  // idempotent: unchanged
      await writeFile(targetPath + '.bak', existing);
      backups.push(rel);
    }
    await writeFile(targetPath, resolved);

    // chmod +x for hooks
    if (rel.startsWith('hooks/')) {
      await chmod(targetPath, 0o755);
    }
  }
}
