import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import * as tar from 'tar';
import { normalizeString } from './paths.mjs';

export async function buildBundle(files, outputPath, options = {}) {
  const { homeDir } = options;
  const stagingDir = outputPath + '.staging';
  await mkdir(stagingDir, { recursive: true });

  const fileMetadata = [];
  try {
    for (const f of files) {
      const content = homeDir ? normalizeString(f.content, homeDir) : f.content;
      const filePath = join(stagingDir, f.relativePath);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, content);
      const sha = createHash('sha256').update(content).digest('hex');
      fileMetadata.push({
        path: f.relativePath,
        size: Buffer.byteLength(content, 'utf-8'),
        sha256: sha,
      });
    }

    await tar.create(
      { gzip: true, file: outputPath, cwd: stagingDir },
      fileMetadata.map(f => f.path),
    );
  } finally {
    await rm(stagingDir, { recursive: true, force: true });
  }

  const tarBuffer = await readFile(outputPath);
  const tarSha = createHash('sha256').update(tarBuffer).digest('hex');

  return {
    path: outputPath,
    sha256: tarSha,
    size: tarBuffer.length,
    files: fileMetadata,
  };
}
