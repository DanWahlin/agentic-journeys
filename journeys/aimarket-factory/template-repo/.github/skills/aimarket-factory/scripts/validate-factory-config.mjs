#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(process.argv[2] ?? process.cwd());
const errors = [];
const required = [
  'PRODUCT.md',
  'FACTORY.md',
  'PLAN.md',
  'factory/task-graph.yml',
  'factory/required-checks.yml',
  'factory/policy.yml',
];

for (const file of required) {
  if (!existsSync(join(root, file))) errors.push(`missing ${file}`);
}

const policyPath = join(root, 'factory/policy.yml');
const policy = existsSync(policyPath) ? readFileSync(policyPath, 'utf8') : '';
const requiredPolicyValues = [
  [/maximumLiveTtlHours:\s*4\b/, 'maximumLiveTtlHours: 4'],
  [/maximumEstimatedAzureUsdPerRun:\s*20\b/, 'maximumEstimatedAzureUsdPerRun: 20'],
  [/maximumActionsMinutesPerRun:\s*240\b/, 'maximumActionsMinutesPerRun: 240'],
  [/maximumCopilotPremiumRequestsPerRun:\s*40\b/, 'maximumCopilotPremiumRequestsPerRun: 40'],
];
for (const [pattern, label] of requiredPolicyValues) {
  if (!pattern.test(policy)) errors.push(`policy missing ${label}`);
}
if (/productionDeploymentAllowed:\s*true|productionScopeAllowed:\s*true/i.test(policy)) {
  errors.push('production must be forbidden');
}

const requiredChecksPath = join(root, 'factory/required-checks.yml');
const ciPath = join(root, '.github/workflows/aimarket-factory-ci.yml');
if (existsSync(requiredChecksPath) && existsSync(ciPath)) {
  const requiredChecks = readFileSync(requiredChecksPath, 'utf8');
  const ci = readFileSync(ciPath, 'utf8');
  for (const block of requiredChecks.split(/\n(?=\s*- id:)/)) {
    const id = block.match(/^\s*- id:\s*(\S+)/m)?.[1];
    if (id && !/mergeGate:\s*false/.test(block) && !ci.includes(`name: ${id}`)) {
      errors.push(`required check ${id} has no exact CI job name`);
    }
  }
}

const agentsPath = join(root, '.github/agents');
const agents = existsSync(agentsPath)
  ? readdirSync(agentsPath).filter((name) => name.endsWith('.agent.md'))
  : [];
if (agents.length !== 9) errors.push(`exactly nine specialist agents required; found ${agents.length}`);

const workflowsPath = join(root, '.github/workflows');
if (existsSync(workflowsPath)) {
  for (const file of readdirSync(workflowsPath)) {
    const text = readFileSync(join(workflowsPath, file), 'utf8');
    if (/pull_request_target/.test(text)) errors.push(`${file} uses pull_request_target`);
    if (/^\s*(?:run:\s*)?gh\s+stack\s+merge\b/m.test(text)) errors.push(`${file} invokes stack merge`);
  }
}

const graphPath = join(root, 'factory/task-graph.yml');
if (existsSync(graphPath)) {
  const script = new URL('./validate-task-graph.mjs', import.meta.url).pathname;
  const result = spawnSync(process.execPath, [script, graphPath], { encoding: 'utf8' });
  if (result.status !== 0) errors.push(result.stderr.trim() || 'task graph invalid');
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('PASS factory config, policy, agents, workflows, and F0-F15 graph');
