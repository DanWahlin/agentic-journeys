#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { applyManagedFiles, buildPlan, main, parseArgs, validateLiveTarget } from './setup-aimarket-factory.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'aimarket-factory-test-'));
  const required = [
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
  for (const path of required) {
    const full = join(root, path);
    mkdirSync(join(full, '..'), { recursive: true });
    const content = path.endsWith('labels.json') ? JSON.stringify({ labels: [{ name: 'factory:ready' }] }) : `${path}\n`;
    writeFileSync(full, content);
  }
  mkdirSync(join(root, 'template-repo/.github/workflows'), { recursive: true });
  writeFileSync(join(root, 'template-repo/.github/workflows/factory-ci.yml'), 'name: factory-ci\n');
  mkdirSync(join(root, 'template-repo/scripts'), { recursive: true });
  writeFileSync(join(root, 'template-repo/scripts/verify.mjs'), 'console.log("PASS")\n');
  return root;
}

test('defaults to dry-run for the exact approved owner', () => {
  assert.deepEqual(parseArgs(['--repo', 'DanWahlin/lab']), {
    apply: false,
    applyAzureIdentity: false,
    dryRun: true,
    repo: 'DanWahlin/lab',
  });
});

test('requires an explicit repository in dry-run and apply modes', () => {
  assert.throws(() => parseArgs([]), /--repo DanWahlin\/<name> is required/);
  assert.throws(() => parseArgs(['--apply']), /--repo DanWahlin\/<name> is required/);
});

test('rejects another owner and malformed repository names', () => {
  assert.throws(() => parseArgs(['--repo', 'microsoft/agentic-journeys']), /must match DanWahlin/);
  assert.throws(() => parseArgs(['--repo', 'DanWahlin']), /must match DanWahlin/);
  assert.throws(() => parseArgs(['--repo', 'DanWahlin/../other']), /must match DanWahlin/);
});

test('requires a separate apply approval for the Azure identity signal', () => {
  assert.throws(
    () => parseArgs(['--repo', 'DanWahlin/lab', '--apply-azure-identity']),
    /requires --apply/,
  );
  const args = parseArgs(['--repo', 'DanWahlin/lab', '--apply', '--apply-azure-identity']);
  assert.equal(args.apply, true);
  assert.equal(args.applyAzureIdentity, true);
});

test('rejects conflicting and unknown flags', () => {
  assert.throws(
    () => parseArgs(['--repo', 'DanWahlin/lab', '--apply', '--dry-run']),
    /cannot be used together/,
  );
  assert.throws(() => parseArgs(['--repo', 'DanWahlin/lab', '--force']), /Unknown argument/);
});

test('maps template repository files to the target root and reports labels', () => {
  const plan = buildPlan(fixture(), 'DanWahlin/lab');
  assert.deepEqual(plan.missing, []);
  assert(plan.managedFiles.some((file) => file.source === 'template-repo/.github/workflows/factory-ci.yml' && file.target === '.github/workflows/factory-ci.yml'));
  assert(plan.managedFiles.some((file) => file.source === 'PRODUCT.md' && file.target === 'PRODUCT.md'));
  assert.deepEqual(plan.labels.map((label) => label.name), ['factory:ready']);
});

test('reports every missing contract as a fail-closed blocker', () => {
  const empty = mkdtempSync(join(tmpdir(), 'aimarket-factory-empty-'));
  const plan = buildPlan(empty, 'DanWahlin/lab');
  assert(plan.missing.includes('PRODUCT.md'));
  assert(plan.missing.includes('factory/policy.yml'));
  assert.equal(plan.managedFiles.length, 0);
});

test('dry-run never calls a mutation runner', async () => {
  const calls = [];
  const result = await main(['--repo', 'DanWahlin/lab'], {
    sourceRoot: fixture(),
    runner: (...args) => {
      calls.push(args);
      throw new Error('runner must not be called in dry-run');
    },
  });
  assert.equal(result.applied, false);
  assert.deepEqual(calls, []);
});

test('CLI apply fails closed before any mutation runner is called', async () => {
  const calls = [];
  await assert.rejects(
    main(['--repo', 'DanWahlin/lab', '--apply'], {
      sourceRoot: fixture(),
      runner: (...args) => {
        calls.push(args);
        throw new Error('runner must not be called while apply is blocked');
      },
    }),
    /Live apply is BLOCKED.*No mutation was attempted/,
  );
  assert.deepEqual(calls, []);
});

test('live target validation fails closed on identity and visibility', () => {
  const valid = {
    nameWithOwner: 'DanWahlin/lab',
    isPrivate: true,
    ownerType: 'User',
    defaultBranch: 'main',
  };
  assert.doesNotThrow(() => validateLiveTarget(valid, 'DanWahlin/lab'));
  assert.throws(() => validateLiveTarget({ ...valid, nameWithOwner: 'DanWahlin/other' }, 'DanWahlin/lab'), /identity mismatch/);
  assert.throws(() => validateLiveTarget({ ...valid, isPrivate: false }, 'DanWahlin/lab'), /must be private/);
  assert.throws(() => validateLiveTarget({ ...valid, ownerType: 'Organization' }, 'DanWahlin/lab'), /personal account/);
  assert.throws(() => validateLiveTarget({ ...valid, ownerType: undefined }, 'DanWahlin/lab'), /proven to be the approved personal account/);
  assert.throws(() => validateLiveTarget({ ...valid, defaultBranch: '' }, 'DanWahlin/lab'), /default branch/);
});

test('direct apply helper is also blocked', () => {
  assert.throws(() => applyManagedFiles(), /Live apply is BLOCKED.*No mutation was attempted/);
});
