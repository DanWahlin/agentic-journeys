#!/usr/bin/env node
// Runs one journey prompt through Copilot CLI (copilot -p) with shell: false, so it
// works the same from PowerShell, Command Prompt, bash, and zsh.
//
// Copilot CLI has no --prompt-file option, so this helper reads the file and passes
// the text as one argument. Prompt mode can't ask for approval, so permissions are
// explicit opt-ins.

import { appendFileSync, createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const USAGE = `Usage: node run-copilot-prompt.mjs --prompt-file <path> [options]

  --cwd <path>                 Working directory for Copilot (default: current)
  --allow-dir <path>           Add a directory Copilot may read (repeatable)
  --allow-all-tools            Allow every tool without approval
  --allow-all-urls             Allow every URL without approval
  --allow-all-paths            Allow every path without approval
  --agent <name>               Use a custom agent (for example, oss-to-azure-deployer)
  --mode <mode>                Start in interactive, plan, or autopilot mode
  --model <model>              Use a specific model
  --max-autopilot-continues <n>  Cap autopilot continuations
  --resume <session-id>        Continue an earlier session
  --resume-from <file>         Continue the session whose ID is stored in <file>
  --session-out <file>         Write this run's session ID to <file>
  --log <file>                 Also write the output to <file>
  --record <file>              Append a JSON line with label, timing, exit code, session, and credits
  --label <name>               Step name for --record (default: prompt file name)
`;

function fail(message) {
  console.error(`ERROR: ${message}\n\n${USAGE}`);
  process.exit(2);
}

const args = process.argv.slice(2);
const value = (flag) => {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  if (!args[index + 1] || args[index + 1].startsWith('--')) fail(`${flag} needs a value.`);
  return args[index + 1];
};
const values = (flag) => args.flatMap((arg, index) => (arg === flag && args[index + 1] ? [args[index + 1]] : []));
if (args.includes('--help')) { console.log(USAGE); process.exit(0); }

const promptFile = value('--prompt-file');
if (!promptFile) fail('--prompt-file is required.');
const promptPath = resolve(promptFile);
const cwd = resolve(value('--cwd') ?? process.cwd());
const prompt = readFileSync(promptPath, 'utf8').trim();
if (!prompt) fail(`Prompt file is empty: ${promptPath}`);

const copilotArgs = [];
for (const flag of ['--allow-all-tools', '--allow-all-urls', '--allow-all-paths']) {
  if (args.includes(flag)) copilotArgs.push(flag);
}
for (const dir of values('--allow-dir')) copilotArgs.push('--add-dir', resolve(cwd, dir));
for (const flag of ['--agent', '--mode', '--model', '--max-autopilot-continues']) {
  const v = value(flag);
  if (v) copilotArgs.push(flag, v);
}
let resumeId = value('--resume');
const resumeFrom = value('--resume-from');
if (!resumeId && resumeFrom) {
  if (!existsSync(resumeFrom)) fail(`--resume-from file doesn't exist: ${resumeFrom}`);
  resumeId = readFileSync(resumeFrom, 'utf8').trim();
}
if (resumeId) copilotArgs.push(`--resume=${resumeId}`);
copilotArgs.push('-p', prompt);

const logPath = value('--log');
let log;
if (logPath) {
  mkdirSync(dirname(resolve(logPath)), { recursive: true });
  log = createWriteStream(logPath);
  log.write(`$ copilot ${copilotArgs.slice(0, -2).join(' ')} (cwd ${cwd})\n--- prompt ---\n${prompt}\n--- output ---\n`);
}

let output = '';
const started = new Date();
const child = spawn('copilot', copilotArgs, { cwd, env: process.env, shell: false });
const forward = (stream) => (chunk) => {
  const text = chunk.toString();
  output += text.length > 200000 ? '' : text;
  if (output.length > 400000) output = output.slice(-200000);
  stream.write(chunk);
  log?.write(chunk);
};
child.stdout.on('data', forward(process.stdout));
child.stderr.on('data', forward(process.stderr));
child.on('error', (error) => fail(`Could not start Copilot CLI: ${error.message}`));
child.on('close', (code) => {
  const ended = new Date();
  const sessionId = (output.match(/--resume=([0-9a-f-]{36})/g) ?? []).at(-1)?.split('=')[1];
  const credits = (output.match(/AI Credits\s+([\d.]+)/g) ?? []).at(-1)?.split(/\s+/).at(-1);
  if (sessionId && value('--session-out')) writeFileSync(value('--session-out'), `${sessionId}\n`);
  if (value('--record')) {
    appendFileSync(value('--record'), `${JSON.stringify({
      label: value('--label') ?? promptFile,
      kind: 'copilot',
      started: started.toISOString(),
      seconds: Math.round((ended - started) / 1000),
      exit: code,
      sessionId,
      sessionCredits: credits ? Number(credits) : undefined,
    })}\n`);
  }
  log?.end(`\n--- exit ${code} ---\n`);
  process.exitCode = code ?? 1;
});
