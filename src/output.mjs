import { homedir } from 'node:os';

export function tildeHome(path) {
  const home = homedir();
  return path.startsWith(home) ? '~' + path.slice(home.length) : path;
}

export function shouldOutputJson(args) {
  return args.includes('--json') || !process.stdout.isTTY;
}

export function writeOutput(args, jsonData, prettyFn) {
  if (shouldOutputJson(args)) {
    console.log(JSON.stringify(jsonData));
  } else {
    console.log(prettyFn());
  }
}
