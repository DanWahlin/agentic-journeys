#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const journeyRoot = join(repoRoot, 'journeys/aimarket-factory');
const failures = [];

function fail(message) {
  failures.push(message);
}

function read(relativePath) {
  const path = join(repoRoot, relativePath);
  if (!existsSync(path)) {
    fail(`${relativePath}: required file is missing`);
    return '';
  }
  return readFileSync(path, 'utf8');
}

function requireText(text, expected, file, reason = '') {
  if (!text.includes(expected)) fail(`${file}: missing ${JSON.stringify(expected)}${reason ? ` (${reason})` : ''}`);
}

function forbid(text, pattern, file, reason) {
  const match = text.match(pattern);
  if (match) fail(`${file}: ${reason}; found ${JSON.stringify(match[0])}`);
}

function requireHeadingOrder(markdown, headings, file) {
  let previous = -1;
  for (const heading of headings) {
    const match = new RegExp(`^## ${heading.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}$`, 'm').exec(markdown);
    const index = match?.index ?? -1;
    if (index < 0) {
      fail(`${file}: missing required section "## ${heading}"`);
      continue;
    }
    if (index <= previous) fail(`${file}: section "## ${heading}" is out of required order`);
    previous = index;
  }
}

const readmePath = 'journeys/aimarket-factory/README.md';
const readme = read(readmePath);
const rootReadme = read('README.md');
const agents = read('AGENTS.md');
const setupPath = '.github/scripts/setup-aimarket-factory.mjs';
const setup = read(setupPath);
const setupTest = read('.github/scripts/setup-aimarket-factory.test.mjs');
const requiredChecks = read('journeys/aimarket-factory/factory/required-checks.yml');
const factoryCi = read('journeys/aimarket-factory/template-repo/.github/workflows/aimarket-factory-ci.yml');

requireHeadingOrder(readme, [
  'Learning Objectives',
  'Prerequisites',
  'Architecture',
  'The Spec',
  'The Journey',
  'Cost Breakdown',
  'Troubleshooting',
  'Verification Checklist',
  'Cleanup',
  'How Agentic AI is Used',
  'Assignment',
  "What's Next",
  'Resources',
], readmePath);

requireText(readme, 'Cost if Left Running', readmePath, 'cost must be described as ongoing cost');
requireText(readme.toLowerCase(), 'same day', readmePath, 'live resources need same-day teardown guidance');
requireText(readme, '### Acceptance criteria', readmePath);
requireText(readme, 'Capability decision table', readmePath);
requireText(readme, 'Proceed', readmePath);
requireText(readme, 'Simulate', readmePath);
requireText(readme, 'Blocked', readmePath);
requireText(readme, 'PRE-DEPLOYMENT STATUS: READY or NOT READY', readmePath);
requireText(readme, 'PASS or FAIL', readmePath);
requireText(readme, "Don't report READY while", readmePath);
requireText(readme, '/plugin marketplace add microsoft/azure-skills', readmePath);
requireText(readme, '/plugin install azure@azure-skills', readmePath);
requireText(readme, 'Approve and run workflows', readmePath);
requireText(readme, 'az group exists --name <resource-group-name>', readmePath);
requireText(readme, 'PASS: AIMarket Factory journey structure and safety contract', readmePath);
requireText(readme, 'verify-aimarket-factory-local.mjs', readmePath, 'the local simulation must run deterministic policy fixtures');
requireText(readme, 'gh aw validate', readmePath, 'the local simulation must validate agentic workflow sources');
requireText(readme, "live path as `BLOCKED`", readmePath, 'the current installer does not provision a live factory');
requireText(readme, 'aimarket-factory-workspace', readmePath, 'isolated workspace setup is required');
for (const copiedPath of ['journeys/aimarket-factory', '.github/agents', '.github/skills', '.github/scripts', 'docs']) {
  requireText(readme, copiedPath, readmePath, 'isolated workspace must retain repository context');
}

forbid(readme, /Journey\s+\d+\s+of\s+\d+/i, readmePath, 'journey sequence numbering is forbidden');
forbid(readme, /Journey\s+7\b/i, readmePath, 'the factory must not be called Journey 7');
forbid(readme, /\b\d+(?:\.\d+)?\s*(?:hours?|hrs?|minutes?|mins?)\b/i, readmePath, 'learner duration estimates are forbidden');
forbid(readme, /—/u, readmePath, 'em dashes are forbidden in learner prose');
forbid(readme, /\/plugin marketplace add (?!microsoft\/azure-skills)[^\n]+/i, readmePath, 'only the canonical Azure Skills marketplace is allowed');
forbid(readme, /\/plugin install (?!azure@azure-skills)[^\n]+/i, readmePath, 'only the canonical Azure Skills plugin is allowed');

const phaseHeadings = [...readme.matchAll(/^### Phase \d+:/gm)].length;
if (phaseHeadings < 3) fail(`${readmePath}: expected at least three bounded phases, found ${phaseHeadings}`);
for (const [marker, label] of [
  [/\*\*🔍 Inspect/g, 'Inspect'],
  [/\*\*💡 What you're learning:/g, "What you're learning"],
  [/\*\*🧪 Try it yourself:/g, 'Try it yourself'],
]) {
  const count = [...readme.matchAll(marker)].length;
  if (count < phaseHeadings) fail(`${readmePath}: every phase needs a ${label} marker; found ${count} for ${phaseHeadings} phases`);
}

if (!/^\| Tool or capability \| Requirement \| Used for \| Validation \|$/m.test(readme)) {
  fail(`${readmePath}: prerequisite table must include requirement, purpose, and validation columns`);
}
if (!/## What's Next[\s\S]*\[[^\]]+\]\([^\)]+\)/.test(readme)) {
  fail(`${readmePath}: What's Next must contain plain links`);
}

const requiredJourneyFiles = [
  'PLAN.md',
  'PRODUCT.md',
  'FACTORY.md',
  'factory/task-graph.yml',
  'factory/required-checks.yml',
  'factory/policy.yml',
  'factory/labels.json',
  'factory/project-fields.json',
  'factory/repository-settings.json',
  'factory/credential-matrix.md',
  'template-repo',
  'templates',
  'evals',
];
for (const path of requiredJourneyFiles) {
  if (!existsSync(join(journeyRoot, path))) fail(`journeys/aimarket-factory/${path}: required factory artifact is missing`);
}

const recoveryWorkflowPath = 'journeys/aimarket-factory/template-repo/.github/workflows/aimarket-factory-cancellation-recovery.yml';
const recoveryWorkflow = read(recoveryWorkflowPath);
requireText(recoveryWorkflow, 'workflow_run:', recoveryWorkflowPath, 'cancellation recovery must run from the default-branch workflow');
requireText(recoveryWorkflow, 'factory-cleanup-context', recoveryWorkflowPath, 'cancellation recovery must use the pre-deployment checkpoint');
requireText(recoveryWorkflow, 'issues: write', recoveryWorkflowPath, 'cancellation recovery must be able to open a blocked incident');

const imagePath = join(journeyRoot, 'images/aimarket-marketplace.webp');
if (!existsSync(imagePath)) {
  fail('journeys/aimarket-factory/images/aimarket-marketplace.webp: required hero image is missing');
} else {
  const bytes = readFileSync(imagePath);
  if (bytes.length < 12 || bytes.subarray(0, 4).toString('ascii') !== 'RIFF' || bytes.subarray(8, 12).toString('ascii') !== 'WEBP') {
    fail('journeys/aimarket-factory/images/aimarket-marketplace.webp: file is not a valid WebP container');
  }
}

const imagesRoot = join(journeyRoot, 'images');
const journeyImages = existsSync(imagesRoot)
  ? readdirSync(imagesRoot).filter((name) => name.endsWith('.webp'))
  : [];
if (journeyImages.length < 4 || journeyImages.length > 6) {
  fail(`journeys/aimarket-factory/images: expected 4-6 WebP images, found ${journeyImages.length}`);
}
for (const name of journeyImages) {
  const bytes = readFileSync(join(imagesRoot, name));
  if (bytes.length >= 100_000) fail(`journeys/aimarket-factory/images/${name}: image must stay below 100KB`);
  if (!readme.includes(`./images/${name}`)) fail(`journeys/aimarket-factory/README.md: image ${name} is not referenced`);
}

requireText(rootReadme, '[AIMarket Factory](./journeys/aimarket-factory/README.md)', 'README.md');
forbid(rootReadme, /Journey\s+7\b/i, 'README.md', 'root integration must not prescribe a sequence number');
requireText(agents, 'verify-aimarket-factory-journey.mjs', 'AGENTS.md');
requireText(agents, 'aimarket-factory/', 'AGENTS.md');

requireText(setup, "apply: false", setupPath, 'default must be dry-run');
requireText(setup, "dryRun: true", setupPath, 'default must be dry-run');
requireText(setup, "--repo DanWahlin/<name> is required", setupPath);
requireText(setup, "--apply-azure-identity requires --apply", setupPath);
requireText(setup, "Live apply is BLOCKED", setupPath, 'unsafe partial installation must fail closed');
requireText(setup, "Target repository must be private", setupPath);
forbid(setup, /execSync\s*\(/, setupPath, 'shell-string execution is forbidden');
forbid(setup, /\b(?:rm|delete)\b[^\n]*(?:repository|project|label|environment)/i, setupPath, 'setup must not delete unknown remote state');

requireText(setupTest, "dry-run never calls a mutation runner", '.github/scripts/setup-aimarket-factory.test.mjs');
requireText(setupTest, "rejects another owner", '.github/scripts/setup-aimarket-factory.test.mjs');
requireText(setupTest, "live target validation fails closed", '.github/scripts/setup-aimarket-factory.test.mjs');

for (const block of requiredChecks.split(/\n(?=\s*- id:)/)) {
  const id = block.match(/^\s*- id:\s*(\S+)/m)?.[1];
  if (id && !/mergeGate:\s*false/.test(block) && !factoryCi.includes(`name: ${id}`)) {
    fail(`journeys/aimarket-factory/factory/required-checks.yml: ${id} has no exact CI job name`);
  }
}

if (failures.length > 0) {
  console.error(`FAIL: AIMarket Factory journey has ${failures.length} structural or safety error(s):`);
  failures.forEach((message, index) => console.error(`${index + 1}. ${message}`));
  process.exitCode = 1;
} else {
  console.log('PASS: AIMarket Factory journey structure and safety contract');
}
