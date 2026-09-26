#!/usr/bin/env node
// Creates an isolated workspace for a journey that builds an application.
// Usage: node .github/scripts/create-workspace.mjs <journey> [--workspace <path>]

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const JOURNEYS = ['weather-view', 'aimarket'];

const USAGE = `Usage: node .github/scripts/create-workspace.mjs <journey> [--workspace <path>]

Copies journeys/<journey>, .github/agents, .github/skills, .github/scripts, and docs
into a new Git repository next to this one (default: ../<journey>-workspace), so the
application you build becomes its own repository and this one stays untouched.

Journeys: ${JOURNEYS.join(', ')}
`;

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

function git(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', shell: false });
  if (result.error) fail(`git could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`git ${args.join(' ')} failed:\n${(result.stderr || result.stdout).trim()}`);
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h') || args.length === 0) {
  console.log(USAGE);
  process.exit(args.length === 0 ? 1 : 0);
}
const journey = args[0];
if (!JOURNEYS.includes(journey)) fail(`Unknown journey "${journey}".\n\n${USAGE}`);
let workspace = path.resolve(repoRoot, '..', `${journey}-workspace`);
const flag = args.indexOf('--workspace');
if (flag !== -1) {
  if (!args[flag + 1]) fail('--workspace needs a path.');
  workspace = path.resolve(args[flag + 1]);
}

if (existsSync(workspace) && readdirSync(workspace).length > 0) {
  fail(`${workspace} already exists and isn't empty. Remove it, or choose another path with --workspace.`);
}

const EXCLUDED = new Set(['node_modules', '.azure', 'dist', 'build', 'coverage', 'test-results', 'playwright-report', '.DS_Store']);
mkdirSync(workspace, { recursive: true });
for (const relative of [`journeys/${journey}`, '.github/agents', '.github/skills', '.github/scripts', 'docs']) {
  cpSync(path.join(repoRoot, relative), path.join(workspace, relative), {
    recursive: true,
    filter: (item) => !EXCLUDED.has(path.basename(item)),
  });
}

writeFileSync(path.join(workspace, '.gitignore'), `# Secrets
.env
.env.*
!.env.example
.azure/

# Generated files
node_modules/
dist/
build/
coverage/
test-results/
playwright-report/
artifacts/
*.db
`);

git(['init', '--quiet'], workspace);
git(['symbolic-ref', 'HEAD', 'refs/heads/main'], workspace);
git(['add', '--all'], workspace);
const commit = spawnSync('git', ['commit', '--quiet', '--message', `Initial ${journey} workspace`], { cwd: workspace, encoding: 'utf8', shell: false });
if (commit.status !== 0) {
  fail(`git commit failed. If Git asks who you are, set user.name and user.email with git config, then rerun.\n${(commit.stderr || '').trim()}`);
}

const journeyDir = path.join(workspace, 'journeys', journey);
console.log(`PASS: created ${workspace}`);
console.log(`Next: cd ${journeyDir}`);
