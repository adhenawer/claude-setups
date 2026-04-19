import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ALLOWED_DIRS = ['hooks', 'skills', 'commands', 'agents'];

export async function collectBundleCandidates(claudeHome) {
  const results = [];

  const rootEntries = await readdir(claudeHome, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      await addFile(results, claudeHome, entry.name);
    }
  }

  for (const dirName of ALLOWED_DIRS) {
    const dirPath = join(claudeHome, dirName);
    try {
      await walk(results, claudeHome, dirPath);
    } catch {
      // Directory doesn't exist — ignore
    }
  }

  return results;
}

async function walk(results, root, currentDir) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      await walk(results, root, fullPath);
    } else if (entry.isFile()) {
      const rel = relative(root, fullPath);
      await addFile(results, root, rel);
    }
  }
}

async function addFile(results, root, rel) {
  const fullPath = join(root, rel);
  const s = await stat(fullPath);
  const content = await readFile(fullPath, 'utf-8');
  results.push({
    relativePath: rel,
    size: s.size,
    content,
  });
}
