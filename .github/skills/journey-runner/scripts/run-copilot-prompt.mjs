#!/usr/bin/env node
// Runs one journey prompt through Copilot CLI (copilot -p) with shell: false, so it
// works the same from PowerShell, Command Prompt, bash, and zsh.
//
// Copilot CLI has no --prompt-file option, so this helper reads the file and passes
// the text as one argument. Prompt mode can't ask for approval, so permissions are
// explicit opt-ins.

import { appendFileSync, createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

const USAGE = `Usage: node run-copilot-prompt.mjs --prompt-file <path> [options]

  --cwd <path>                 Working directory for Copilot (default: current)
  --allow-dir <path>           Add a directory Copilot may read (repeatable)
  --allow-all-tools            Allow every tool without approval
  --allow-all-urls             Allow every URL without approval
  --allow-all-paths            Allow every path without approval
  --allow-skill-dirs           Add the user skill and plugin directories that exist
                               (~/.copilot/skills, ~/.agents/skills, ~/.copilot/installed-plugins)
  --disable-mcp-server <name>  Turn off another MCP server (repeatable)
  --allow-mcp-server <name>    Keep a default-off server on and enable it (repeatable).
                               computer-use and azure are off by default under -p
  --timeout-minutes <n>        Stop Copilot after n minutes and exit 124 (default: no limit)
  --secret-env-vars <names>    Comma-separated variables to strip from tools and redact
  --max-ai-credits <n>         Stop the session at this credit total
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
// Plugin skills run scripts from these directories; prompt mode can't ask to open them.
if (args.includes('--allow-skill-dirs')) {
  for (const dir of [['.copilot', 'skills'], ['.agents', 'skills'], ['.copilot', 'installed-plugins']]) {
    const path = join(homedir(), ...dir);
    if (existsSync(path)) copilotArgs.push('--add-dir', path);
  }
}
// Off by default in prompt mode: computer-use drives the host's real apps, and the
// Azure MCP server's intent routing waits for an approval that -p can't give, so its
// tools hang (interactive sessions return normally). Azure skills still work through az and azd.
const allowed = values('--allow-mcp-server');
for (const name of ['computer-use', 'azure', ...values('--disable-mcp-server')]) {
  if (!allowed.includes(name)) copilotArgs.push('--disable-mcp-server', name);
}
for (const name of allowed) copilotArgs.push('--enable-mcp-server', name);
for (const flag of ['--agent', '--mode', '--model', '--max-autopilot-continues', '--max-ai-credits']) {
  const v = value(flag);
  if (v) copilotArgs.push(flag, v);
}
let resumeId = value('--resume');
const resumeFrom = value('--resume-from');
if (!resumeId && resumeFrom) {
  if (!existsSync(resumeFrom)) fail(`--resume-from file doesn't exist: ${resumeFrom}`);
  resumeId = readFileSync(resumeFrom, 'utf8').trim();
}
if (value('--secret-env-vars')) copilotArgs.push(`--secret-env-vars=${value('--secret-env-vars')}`);
if (resumeId) copilotArgs.push(`--resume=${resumeId}`);
const usageFile = join(tmpdir(), `copilot-usage-${process.pid}-${Date.now()}.json`);
copilotArgs.push('--usage-output-file', usageFile);
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
// Prompt mode stops waiting for background shell tasks after 600 s by default, which
// abandons an agent-run azd up halfway. Wait up to an hour unless the caller set it.
const env = { COPILOT_TASK_WAIT_TIMEOUT_SECONDS: '3600', ...process.env };
const child = spawn('copilot', copilotArgs, { cwd, env, shell: false });
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
let timedOut = false;
const timeoutMinutes = Number(value('--timeout-minutes') ?? 0);
const timer = timeoutMinutes > 0 ? setTimeout(() => {
  timedOut = true;
  console.error(`\nERROR: Copilot ran longer than ${timeoutMinutes} minutes; stopping it.`);
  child.kill('SIGTERM');
}, timeoutMinutes * 60000) : undefined;
child.on('close', (exitCode) => {
  clearTimeout(timer);
  const code = timedOut ? 124 : exitCode;
  const ended = new Date();
  const sessionId = (output.match(/--resume=([0-9a-f-]{36})/g) ?? []).at(-1)?.split('=')[1];
  // --usage-output-file reports the session's running total; fall back to the printed summary.
  let credits = (output.match(/AI Credits\s+([\d.]+)/g) ?? []).at(-1)?.split(/\s+/).at(-1);
  if (existsSync(usageFile)) {
    try { credits = (JSON.parse(readFileSync(usageFile, 'utf8')).totalNanoAiu / 1e9).toFixed(2); } catch {}
    rmSync(usageFile, { force: true });
  }
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
