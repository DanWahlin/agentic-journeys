#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scripts = path.join(root, '.github/skills/aimarket-factory/scripts');
const fixtures = path.join(root, 'tests/fixtures');
const expectedRepository = 'DanWahlin/aimarket-factory-journey-lab';
const expectedSha = '1111111111111111111111111111111111111111';
const cases = [
  ['validate-issue-contract.mjs', ['--file', path.join(fixtures, 'issue-valid.md'), '--labels', 'factory:ready,risk:low'], 0],
  ['validate-issue-contract.mjs', ['--file', path.join(fixtures, 'issue-broad-path.md'), '--labels', 'factory:ready'], 1],
  ['validate-issue-contract.mjs', ['--file', path.join(fixtures, 'issue-valid.md'), '--labels', 'factory:planned'], 1],
  ['validate-pr-contract.mjs', ['--file', path.join(fixtures, 'pr-valid.md')], 0],
  ['validate-pr-contract.mjs', ['--file', path.join(fixtures, 'pr-two-issues.md')], 1],
  ['verify-stack-state.mjs', [path.join(fixtures, 'stack-valid.json'), path.join(fixtures, 'task-graph-valid.json')], 0],
  ['verify-stack-state.mjs', [path.join(fixtures, 'stack-wrong-base.json'), path.join(fixtures, 'task-graph-valid.json')], 1],
  ['verify-cleanup.mjs', [path.join(fixtures, 'cleanup-valid.json'), expectedRepository, 'run-123', expectedSha, '123456', 'v1'], 0],
  ['verify-cleanup.mjs', [path.join(fixtures, 'cleanup-broad.json'), expectedRepository, 'run-123', expectedSha, '123456', 'v1'], 1],
  ['validate-task-graph.mjs', [path.join(fixtures, 'task-graph-valid.json')], 0],
  ['validate-task-graph.mjs', [path.join(fixtures, 'task-graph-missing-dependency.json')], 1],
  ['validate-run-context.mjs', ['--run-id', 'run-123', '--resource-group', 'aimarket-factory-run-123', '--repository', expectedRepository, '--commit-sha', expectedSha, '--task-id', 'F15'], 0],
  ['validate-run-context.mjs', ['--run-id', 'run: 123', '--resource-group', 'aimarket-factory-run: 123', '--repository', expectedRepository, '--commit-sha', expectedSha, '--task-id', 'F15'], 1],
  ['validate-owned-inventory.mjs', [path.join(fixtures, 'inventory-valid.json'), 'run-123', expectedRepository], 0],
  ['validate-owned-inventory.mjs', [path.join(fixtures, 'inventory-cognitive-lifecycle.json'), 'run-123', expectedRepository], 0],
  ['validate-owned-inventory.mjs', [path.join(fixtures, 'inventory-unsupported-lifecycle.json'), 'run-123', expectedRepository], 1],
  ['verify-factory-evidence.mjs', [path.join(fixtures, 'evidence-valid.json'), expectedRepository, 'run-123', expectedSha, 'F15', '123456', '', 'v1'], 0],
  ['verify-factory-evidence.mjs', [path.join(fixtures, 'evidence-wrong-sha.json'), expectedRepository, 'run-123', expectedSha, 'F15', '123456', '', 'v1'], 1],
];

let failures = 0;
for (const [script, args, expectedExit] of cases) {
  const result = spawnSync(process.execPath, [path.join(scripts, script), ...args], { encoding: 'utf8' });
  const actualExit = result.status ?? 1;
  if (actualExit !== expectedExit) {
    failures += 1;
    console.error(`FAIL ${script}: expected ${expectedExit}, got ${actualExit}\n${result.stdout}${result.stderr}`);
  } else {
    console.log(`PASS ${script} expected-exit=${expectedExit}`);
  }
}
if (failures) process.exit(1);
console.log(`PASS ${cases.length} deterministic policy fixtures`);
