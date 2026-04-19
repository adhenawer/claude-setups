import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = join(__dirname, 'gitleaks-rules.toml');

let cachedRules = null;

function parseToml(text) {
  const rules = [];
  const blocks = text.split(/\n\[\[rules\]\]\s*\n/);
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const lines = block.split('\n');
    const rule = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      if (trimmed.startsWith('[[')) break;
      const m = trimmed.match(/^(\w+)\s*=\s*(?:'''(.*)'''|"(.*)")$/s);
      if (m) {
        const key = m[1];
        const value = m[2] !== undefined ? m[2] : m[3];
        rule[key] = value;
      }
    }
    if (rule.id && rule.regex) {
      // Translate Go regex inline flags to JS: leading (?i) becomes the 'i' flag.
      // Any remaining inline-flag groups like (?-i) are unsupported in JS and
      // will cause the rule to be dropped silently.
      let flags = 'g';
      let pattern = rule.regex;
      if (pattern.startsWith('(?i)')) {
        flags += 'i';
        pattern = pattern.slice(4);
      }
      try {
        rule.regex = new RegExp(pattern, flags);
        rules.push(rule);
      } catch {
        // Skip rules that don't parse as JS regex
      }
    }
  }
  return rules;
}

export async function loadGitleaksRules() {
  if (cachedRules) return cachedRules;
  const text = await readFile(RULES_PATH, 'utf-8');
  cachedRules = parseToml(text);
  return cachedRules;
}

export async function scanContent(content, filePath) {
  const rules = await loadGitleaksRules();
  const matches = [];
  for (const rule of rules) {
    rule.regex.lastIndex = 0;
    let m;
    while ((m = rule.regex.exec(content)) !== null) {
      const before = content.slice(0, m.index);
      const lineNumber = before.split('\n').length;
      matches.push({
        ruleId: rule.id,
        description: rule.description,
        line: lineNumber,
        match: m[0].slice(0, 80),
        file: filePath,
      });
      if (m.index === rule.regex.lastIndex) rule.regex.lastIndex++;
    }
  }
  return matches;
}

export async function scanFiles(files) {
  const all = [];
  for (const f of files) {
    const matches = await scanContent(f.content, f.relativePath);
    for (const m of matches) all.push(m);
  }
  return all;
}
