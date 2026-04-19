import { spawn } from 'node:child_process';

export async function isGhAvailable(ghBin = 'gh') {
  try {
    const result = await runGh(['--version'], { ghBin });
    return result.code === 0;
  } catch {
    return false;
  }
}

export function runGh(args, options = {}) {
  const { ghBin = 'gh', stdin } = options;
  return new Promise((resolve, reject) => {
    const child = spawn(ghBin, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', err => {
      if (err.code === 'ENOENT') {
        reject(new Error(`gh binary not found at ${ghBin}`));
      } else {
        reject(err);
      }
    });
    child.on('close', code => { resolve({ stdout, stderr, code }); });
    if (stdin !== undefined) {
      child.stdin.write(stdin);
      child.stdin.end();
    }
  });
}
