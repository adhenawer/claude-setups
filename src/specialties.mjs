import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const YAML_PATH = join(__dirname, 'specialties.yml');

function parseSimpleYamlMap(text) {
  const map = {};
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([a-z0-9][a-z0-9-]*)\s*:\s*(?:"(.*)"|'(.*)'|(.+))\s*$/i);
    if (m) {
      const key = m[1];
      const value = m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : m[4]);
      map[key] = value;
    }
  }
  return map;
}

const _cached = parseSimpleYamlMap(readFileSync(YAML_PATH, 'utf-8'));

export async function loadSpecialties() {
  return _cached;
}

export function validateSpecialties(arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error('specialties: at least one value required');
  }
  if (arr.length > 3) {
    throw new Error('specialties: at most 3 values allowed');
  }
  const seen = new Set();
  for (const key of arr) {
    if (seen.has(key)) throw new Error(`specialties: duplicate "${key}"`);
    seen.add(key);
  }
  for (const key of arr) {
    if (!(key in _cached)) {
      throw new Error(`specialties: unknown specialty "${key}". Valid keys: ${Object.keys(_cached).join(', ')}`);
    }
  }
  return true;
}
