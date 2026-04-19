import { validateDescriptor } from './descriptor.mjs';

const DEFAULT_REGISTRY = 'https://adhenawer.github.io/claude-setups-registry';

export function resolveUrl(urlOrId, registryBase = DEFAULT_REGISTRY) {
  if (urlOrId.startsWith('http://') || urlOrId.startsWith('https://')) {
    return urlOrId;
  }
  if (/^[a-z0-9-]+\/[a-z0-9][a-z0-9-]{1,49}$/i.test(urlOrId)) {
    return `${registryBase}/s/${urlOrId}.json`;
  }
  throw new Error(`Cannot resolve "${urlOrId}" to a descriptor URL`);
}

export async function fetchDescriptor(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  const text = await res.text();
  let descriptor;
  try {
    descriptor = JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON from ${url}: ${e.message}`);
  }
  validateDescriptor(descriptor);
  return descriptor;
}
