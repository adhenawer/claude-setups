import { createInterface } from 'node:readline/promises';

export async function typedConfirm(expected, options = {}) {
  const read = options.readline || (async () => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      return await rl.question(`Type \`${expected}\` to confirm: `);
    } finally { rl.close(); }
  });
  const input = (await read()).trim();
  return input === expected;
}
