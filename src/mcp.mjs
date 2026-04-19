export function classifyMcpMethod(server) {
  const command = server?.command;
  if (!command) return 'manual';
  if (command === 'npx' || command === 'npm') return 'npm';
  if (command === 'uvx' || command === 'uv' || command === 'pipx') return 'pip';
  if (command === 'node' || command === 'python' || command === 'python3') return 'binary';
  if (command.startsWith('/') || command.startsWith('./') || command.startsWith('../')) return 'binary';
  return 'manual';
}
