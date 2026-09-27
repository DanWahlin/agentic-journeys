#!/usr/bin/env node
// Runs one command with shell: false, streams its output, and optionally tees it to a
// log and appends a timing record. Use it for azd up, verifiers, and cleanup.
// Usage: node run-command.mjs [--label <name>] [--log <file>] [--record <file>] [--cwd <dir>] -- <command> [args...]

import { appendFileSync, createWriteStream, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const split = args.indexOf('--');
if (split === -1 || !args[split + 1]) {
  console.error('Usage: node run-command.mjs [--label <name>] [--log <file>] [--record <file>] [--cwd <dir>] -- <command> [args...]');
  process.exit(2);
}
const options = args.slice(0, split);
const value = (flag) => { const i = options.indexOf(flag); return i === -1 ? undefined : options[i + 1]; };
const [command, ...commandArgs] = args.slice(split + 1);
const cwd = resolve(value('--cwd') ?? process.cwd());
let log;
if (value('--log')) {
  mkdirSync(dirname(resolve(value('--log'))), { recursive: true });
  log = createWriteStream(value('--log'));
  log.write(`$ ${command} ${commandArgs.join(' ')} (cwd ${cwd})\n`);
}
const started = new Date();
// On Windows, .cmd shims such as azd.cmd need the shell; argument arrays stay unquoted.
const child = spawn(command, commandArgs, { cwd, env: process.env, shell: process.platform === 'win32' && !command.endsWith('.exe') });
child.stdout.on('data', (d) => { process.stdout.write(d); log?.write(d); });
child.stderr.on('data', (d) => { process.stderr.write(d); log?.write(d); });
child.on('error', (error) => { console.error(`ERROR: ${error.message}`); process.exit(2); });
child.on('close', (code) => {
  if (value('--record')) {
    appendFileSync(value('--record'), `${JSON.stringify({
      label: value('--label') ?? command,
      kind: 'command',
      started: started.toISOString(),
      seconds: Math.round((Date.now() - started) / 1000),
      exit: code,
    })}\n`);
  }
  log?.end(`\n--- exit ${code} ---\n`);
  process.exitCode = code ?? 1;
});
