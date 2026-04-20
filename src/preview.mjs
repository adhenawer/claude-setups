import { createInterface } from 'node:readline/promises';
import { scanContent } from './gitleaks.mjs';

export async function previewFiles(files, options = {}) {
  const { ask = defaultAsk } = options;
  const included = [];
  for (const file of files) {
    const matches = await scanContent(file.content, file.relativePath);
    const answer = (await ask(file, matches)).trim().toLowerCase();
    if (answer === '' || answer === 'y' || answer === 'yes') {
      included.push(file);
    }
  }
  return included;
}

async function defaultAsk(file, matches) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const matchInfo = matches.length > 0
      ? ` ⚠️  ${matches.length} secret-pattern match(es): ${matches.map(m => `${m.ruleId} @line ${m.line}`).join(', ')}`
      : '';
    console.error(`\n${'─'.repeat(50)}`);
    console.error(`📄 ${file.relativePath}  (${file.size} bytes)${matchInfo}`);
    console.error('─'.repeat(50));
    console.error(file.content.split('\n').slice(0, 20).join('\n'));
    console.error('─'.repeat(50));
    return await rl.question('Include this file? (Y/n): ');
  } finally {
    rl.close();
  }
}
