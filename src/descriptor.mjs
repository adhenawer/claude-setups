import { validateSpecialties } from './specialties.mjs';

const SCHEMA_VERSION = '1.0.0';
const SUPPORTED_MAJOR = 1;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,49}$/;
const MAX_TITLE = 80;
const MAX_DESCRIPTION = 500;
const MAX_TAGS = 10;

export async function buildDescriptor(input) {
  const {
    author, slug, title, description, tags,
    plugins, marketplaces, mcpServers, specialties, version = 1,
  } = input;

  if (!author) throw new Error('author is required');
  if (!SLUG_RE.test(slug)) {
    throw new Error(`invalid slug: must match ${SLUG_RE} (got "${slug}")`);
  }
  if (!title || title.length === 0 || title.length > MAX_TITLE) {
    throw new Error(`invalid title: must be 1-${MAX_TITLE} chars`);
  }
  if (!description || description.length === 0 || description.length > MAX_DESCRIPTION) {
    throw new Error(`invalid description: must be 1-${MAX_DESCRIPTION} chars`);
  }
  if (!Array.isArray(tags) || tags.length === 0 || tags.length > MAX_TAGS) {
    throw new Error(`invalid tags: must be 1-${MAX_TAGS} entries`);
  }
  if (!specialties) throw new Error('specialties is required');
  validateSpecialties(specialties);

  return {
    schemaVersion: SCHEMA_VERSION,
    id: { author, slug },
    version,
    title,
    description,
    tags,
    author: {
      handle: author,
      url: `https://github.com/${author}`,
    },
    createdAt: new Date().toISOString(),
    license: 'MIT',
    plugins,
    marketplaces,
    mcpServers,
    specialties,
    bundle: { present: false },
  };
}

export function validateDescriptor(d) {
  if (!d || !d.schemaVersion) {
    throw new Error('Invalid descriptor: missing schemaVersion');
  }
  const major = parseInt(d.schemaVersion.split('.')[0], 10);
  if (major !== SUPPORTED_MAJOR) {
    throw new Error(
      `Unsupported schemaVersion ${d.schemaVersion}: this claude-setups supports major ${SUPPORTED_MAJOR}`
    );
  }
  if (!d.id?.author || !d.id?.slug) throw new Error('missing id.author or id.slug');
  if (!d.title || !d.description || !Array.isArray(d.tags)) {
    throw new Error('missing metadata');
  }
  if (!Array.isArray(d.specialties) || d.specialties.length === 0 || d.specialties.length > 3) {
    throw new Error('specialties must be an array of 1-3 entries');
  }
  return true;
}
