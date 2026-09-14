#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ALLOWED_OWNER = 'DanWahlin';
export const REQUIRED_CONTRACTS = [
  'PRODUCT.md',
  'FACTORY.md',
  'PLAN.md',
  'factory/task-graph.yml',
  'factory/required-checks.yml',
  'factory/policy.yml',
  'factory/labels.json',
  'factory/project-fields.json',
  'factory/repository-settings.json',
  'factory/credential-matrix.md',
];

function usage() {
  return [
    'Usage: node .github/scripts/setup-aimarket-factory.mjs --repo DanWahlin/<name> [--apply] [--apply-azure-identity]',
    '',
    'Default: dry-run. No GitHub or Azure command is executed.',
    '--apply is blocked because collision-safe installation and remote provisioning are not implemented.',
    '--apply-azure-identity always stops before mutation because identity provisioning is not implemented.',
  ].join('\n');
}

export function parseArgs(argv) {
  const result = { apply: false, applyAzureIdentity: false, dryRun: true, repo: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--repo') {
      result.repo = argv[index + 1] ?? '';
      index += 1;
    } else if (arg === '--apply') {
      result.apply = true;
      result.dryRun = false;
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (arg === '--apply-azure-identity') {
      result.applyAzureIdentity = true;
    } else if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (result.help) return result;
  if (!result.repo) throw new Error('--repo DanWahlin/<name> is required, including for dry-run');
  if (!new RegExp(`^${ALLOWED_OWNER}/[A-Za-z0-9._-]+$`, 'i').test(result.repo)) {
    throw new Error(`--repo must match ${ALLOWED_OWNER}/<name>`);
  }
  const [owner, name] = result.repo.split('/');
  if (owner.toLowerCase() !== ALLOWED_OWNER.toLowerCase() || !name || name === '.' || name === '..') {
    throw new Error(`--repo must target ${ALLOWED_OWNER}/<name>`);
  }
  result.repo = `${ALLOWED_OWNER}/${name}`;
  if (result.apply && result.dryRun) throw new Error('--apply and --dry-run cannot be used together');
  if (result.applyAzureIdentity && !result.apply) {
    throw new Error('--apply-azure-identity requires --apply');
  }
  return result;
}

function walkFiles(root, current = root) {
  if (!existsSync(current)) return [];
  const files = [];
  for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(current, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Managed source may not contain a symbolic link: ${path}`);
    if (entry.isDirectory()) files.push(...walkFiles(root, path));
    else if (entry.isFile()) files.push(relative(root, path).split(sep).join('/'));
  }
  return files;
}

export function buildPlan(sourceRoot, repo) {
  const missing = REQUIRED_CONTRACTS.filter((path) => !existsSync(join(sourceRoot, path)));
  const managed = [];

  for (const path of REQUIRED_CONTRACTS) {
    if (existsSync(join(sourceRoot, path)) && statSync(join(sourceRoot, path)).isFile()) {
      managed.push({ source: path, target: path });
    }
  }

  const templateRoot = join(sourceRoot, 'template-repo');
  for (const path of walkFiles(templateRoot)) {
    managed.push({ source: `template-repo/${path}`, target: path });
  }

  const labelsPath = join(sourceRoot, 'factory/labels.json');
  let labels = [];
  if (existsSync(labelsPath)) {
    const parsed = JSON.parse(readFileSync(labelsPath, 'utf8'));
    labels = Array.isArray(parsed) ? parsed : parsed.labels ?? [];
  }

  return {
    repo,
    mode: 'dry-run',
    managedFiles: managed.sort((a, b) => a.target.localeCompare(b.target)),
    labels,
    missing,
    applyOperations: [
      'stop before mutation because collision-safe installation and remote provisioning are not implemented',
    ],
    unimplementedOperations: [
      'capability read-back for Discussions, Copilot, Projects, dependent PRs, environments, and OIDC',
      'labels, Project fields, branch rules, required checks, environments, variables, and identity provisioning',
      'target-repository source/lock compilation and provisioning-manifest read-back',
      'remote installation and read-back of issue-scoped dispatch concurrency, specialist binding, and default-branch dependency validation',
    ],
  };
}

export function formatPlan(plan) {
  const lines = [
    '=== AIMarket Factory setup ===',
    `MODE: ${plan.mode.toUpperCase()}`,
    `TARGET: ${plan.repo}`,
    'No GitHub or Azure mutation has been performed.',
    '',
    'Apply scope:',
    ...plan.applyOperations.map((operation, index) => `${index + 1}. ${operation}`),
    '',
    'Not implemented by this installer:',
    ...plan.unimplementedOperations.map((operation) => `- ${operation}`),
    '',
    `Managed files (${plan.managedFiles.length}):`,
    ...plan.managedFiles.map(({ target }) => `- ${target}`),
    '',
    `Declared labels (${plan.labels.length}):`,
    ...plan.labels.map((label) => `- ${label.name ?? label}`),
  ];
  if (plan.missing.length > 0) {
    lines.push('', 'BLOCKED: required source contracts are missing:', ...plan.missing.map((path) => `- ${path}`));
  }
  return lines.join('\n');
}

export function validateLiveTarget(target, requestedRepo) {
  if (target.nameWithOwner?.toLowerCase() !== requestedRepo.toLowerCase()) {
    throw new Error(`Repository identity mismatch: expected ${requestedRepo}, received ${target.nameWithOwner ?? 'unknown'}`);
  }
  if (target.isPrivate !== true) throw new Error('Target repository must be private');
  if (target.ownerType !== 'User') throw new Error('Target owner must be proven to be the approved personal account');
  if (!target.defaultBranch) throw new Error('Target repository must have a readable default branch');
}

export function applyManagedFiles() {
  throw new Error('Live apply is BLOCKED: collision-safe installation, capability read-back, and remote provisioning are not implemented. No mutation was attempted.');
}

export async function main(argv = process.argv.slice(2), dependencies = {}) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(usage());
    return { help: true };
  }

  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const sourceRoot = dependencies.sourceRoot ?? resolve(scriptDir, '../../journeys/aimarket-factory');
  const plan = buildPlan(sourceRoot, args.repo);
  console.log(formatPlan(plan));

  if (!args.apply) return { applied: false, plan };
  if (args.applyAzureIdentity) {
    throw new Error('Azure identity mutation is not implemented by this installer. Perform it as a separately reviewed operation; no mutation was attempted.');
  }
  throw new Error('Live apply is BLOCKED: collision-safe installation, capability read-back, and remote provisioning are not implemented. No mutation was attempted.');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  });
}
