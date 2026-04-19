export function normalizePaths(obj, homeDir) {
  const json = JSON.stringify(obj);
  const escaped = homeDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return JSON.parse(json.replace(new RegExp(escaped, 'g'), '$HOME'));
}

export function resolvePaths(obj, homeDir) {
  const json = JSON.stringify(obj);
  return JSON.parse(json.replace(/\$HOME/g, homeDir));
}

export function normalizeString(str, homeDir) {
  const escaped = homeDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return str.replace(new RegExp(escaped, 'g'), '$HOME');
}

export function resolveString(str, homeDir) {
  return str.replace(/\$HOME/g, homeDir);
}
