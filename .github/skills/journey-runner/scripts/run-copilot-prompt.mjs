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
  --allow-mcp-server <name>    Keep computer-use on (it's off by default because it drives the host's apps)
  --azure-mcp <all|plugin|off> How Azure MCP runs (default: all). See the comment below.
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
// computer-use is off by default: in an unattended run it drives the host's real apps.
const allowed = values('--allow-mcp-server');
for (const name of ['computer-use', ...values('--disable-mcp-server')]) {
  if (!allowed.includes(name)) copilotArgs.push('--disable-mcp-server', name);
}
for (const name of allowed) copilotArgs.push('--enable-mcp-server', name);

// Azure MCP stays on, because the journeys depend on it. The Azure Skills plugin starts it
// in namespace mode, where a call with only an intent asks the client's model to pick the
// command (MCP sampling). Copilot CLI doesn't answer sampling requests under -p
// (github/copilot-cli#2882), so those calls wait forever. "all" replaces the plugin server
// with the same package in --mode all, which exposes every tool directly and never samples.
// Use "plugin" once the CLI answers sampling in prompt mode.
const azureMcp = value('--azure-mcp') ?? 'all';
if (!['all', 'plugin', 'off'].includes(azureMcp)) fail('--azure-mcp must be all, plugin, or off.');
let mcpConfigFile;
if (azureMcp !== 'plugin') copilotArgs.push('--disable-mcp-server', 'azure');
if (azureMcp === 'plugin') copilotArgs.push('--enable-mcp-server', 'azure');
if (azureMcp === 'all') {
  mcpConfigFile = join(tmpdir(), `copilot-azmcp-${process.pid}-${Date.now()}.json`);
  writeFileSync(mcpConfigFile, JSON.stringify({ mcpServers: { azmcp: {
    type: 'local', command: 'npx', args: ['-y', '@azure/mcp@latest', 'server', 'start', '--mode', 'all'], tools: ['*'],
  } } }));
  copilotArgs.push('--additional-mcp-config', `@${mcpConfigFile}`);
}
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
  if (mcpConfigFile) rmSync(mcpConfigFile, { force: true });
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
