#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { validateRunContext } from './validate-run-context.mjs';

const SHA256 = /^[0-9a-f]{64}$/;
const STATUSES = new Set(['PASS', 'FAIL', 'BLOCKED']);
const SECRET_PATTERN = /(authorization|bearer\s|api[_-]?key|connection[_-]?string|client[_-]?secret|github_pat_|ghp_|https?:\/\/[^\s/]+\.[^\s/]+)/i;

export function validateFactoryEvidence(evidence, expected = {}) {
  const errors = [];
  if (evidence?.schema !== 'factory-evidence-v1') errors.push('schema must be factory-evidence-v1');
  errors.push(...validateRunContext({
    runId: evidence?.runId,
    resourceGroup: evidence?.ownership?.resourceGroup,
    repository: evidence?.repository,
    commitSha: evidence?.commitSha,
    taskId: evidence?.taskId,
  }));
  if (!STATUSES.has(evidence?.status)) errors.push('status must be PASS, FAIL, or BLOCKED');
  if (!Array.isArray(evidence?.checks) || evidence.checks.length === 0) errors.push('checks must be a non-empty array');
  if (!/^\d+$/.test(String(evidence?.producerRunId ?? ''))) errors.push('producerRunId must be a GitHub Actions run ID');
  if (!/^[A-Za-z0-9._-]+$/.test(evidence?.policyVersion ?? '')) errors.push('policyVersion is invalid');
  if (!Number.isFinite(Date.parse(evidence?.startedAt)) || !Number.isFinite(Date.parse(evidence?.completedAt))) errors.push('startedAt and completedAt must be ISO timestamps');
  if (!SHA256.test(evidence?.ownership?.resourceGroupHash ?? '')) errors.push('ownership.resourceGroupHash must be SHA-256');
  const checksHash = createHash('sha256').update(JSON.stringify(evidence?.checks ?? [])).digest('hex');
  const metricsHash = createHash('sha256').update(JSON.stringify(evidence?.metrics ?? {})).digest('hex');
  if (evidence?.artifactHashes?.checksSha256 !== checksHash) errors.push('checks artifact hash mismatch');
  if (evidence?.artifactHashes?.metricsSha256 !== metricsHash) errors.push('metrics artifact hash mismatch');
  if (evidence?.cleanup?.status !== 'PENDING') errors.push('staging evidence cleanup status must be PENDING');
  if (expected.repository && evidence.repository !== expected.repository) errors.push('repository binding mismatch');
  if (expected.runId && evidence.runId !== expected.runId) errors.push('runId binding mismatch');
  if (expected.commitSha && evidence.commitSha !== expected.commitSha) errors.push('commitSha binding mismatch');
  if (expected.taskId && evidence.taskId !== expected.taskId) errors.push('taskId binding mismatch');
  if (expected.producerRunId && String(evidence.producerRunId) !== String(expected.producerRunId)) errors.push('producerRunId binding mismatch');
  if (expected.status && evidence.status !== expected.status) errors.push(`status must be ${expected.status}`);
  if (expected.policyVersion && evidence.policyVersion !== expected.policyVersion) errors.push('policyVersion binding mismatch');
  const serialized = JSON.stringify(evidence);
  if (SECRET_PATTERN.test(serialized)) errors.push('evidence contains a secret-like value or endpoint');
  return errors;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [file, repository, runId, commitSha, taskId = 'F15', producerRunId, status, policyVersion] = process.argv.slice(2);
  if (!file) {
    console.error('usage: verify-factory-evidence.mjs <file> [repository runId commitSha taskId producerRunId]');
    process.exit(2);
  }
  const evidence = JSON.parse(readFileSync(file, 'utf8'));
  const errors = validateFactoryEvidence(evidence, { repository, runId, commitSha, taskId, producerRunId, status, policyVersion });
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log('PASS bound factory staging evidence');
}
