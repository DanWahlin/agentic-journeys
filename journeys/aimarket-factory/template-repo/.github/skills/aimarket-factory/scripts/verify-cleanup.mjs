#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findRemainingLifecycleExceptions, prepareLifecycleExceptions, recoverLifecycleExceptions } from './lifecycle-exceptions.mjs';

const [file, expectedRepository, expectedRunId, expectedCommitSha, expectedProducerRunId, expectedPolicyVersion, rawDirectory] = process.argv.slice(2);
if (!file) {
  console.error('usage: verify-cleanup.mjs <cleanup-evidence.json> [repository runId commitSha producerRunId]');
  process.exit(2);
}
const evidence = JSON.parse(readFileSync(file, 'utf8'));
const errors = [];
const sha256 = /^[0-9a-f]{64}$/;
const ownedInventoryHash = (resources) => stableHash(resources.map((resource) => JSON.stringify({
  id: resource.id,
  type: resource.type,
  tags: Object.fromEntries(requiredTags.map((tag) => [tag, resource.tags?.[tag] ?? null])),
})));
const unrelatedInventoryHash = (resources) => stableHash(resources.map((resource) => resource.id));
const stableHash = (values) => createHash('sha256').update(JSON.stringify([...values].sort())).digest('hex');
const lifecycleKey = (item) => `${item.type}/${item.resourceGroup}/${item.location}/${item.name}`;
const requiredTags = ['factory-run-id', 'factory-owner', 'factory-repository', 'factory-expires-at'];
if (evidence.schema !== 'factory-cleanup-evidence-v1') errors.push('invalid cleanup evidence schema');
if (!/^aimarket-factory-[a-z0-9-]+$/.test(evidence.resourceGroup ?? '')) errors.push('invalid owned RG name');
if (evidence.exactDeletionTarget !== evidence.resourceGroup) errors.push('deletion target does not match the owned RG');
if (evidence.resourceGroup !== `aimarket-factory-${evidence.runId}`) errors.push('resourceGroup does not bind to runId');
if (expectedRepository && evidence.repository !== expectedRepository) errors.push('repository binding mismatch');
if (expectedRunId && evidence.runId !== expectedRunId) errors.push('runId binding mismatch');
if (expectedCommitSha && evidence.commitSha !== expectedCommitSha) errors.push('commitSha binding mismatch');
if (expectedProducerRunId && String(evidence.producerRunId) !== String(expectedProducerRunId)) errors.push('producerRunId binding mismatch');
if (!/^[A-Za-z0-9._-]+$/.test(evidence.policyVersion ?? '')) errors.push('policyVersion is invalid');
if (expectedPolicyVersion && evidence.policyVersion !== expectedPolicyVersion) errors.push('policyVersion binding mismatch');
if (!Array.isArray(evidence.requiredTags) || !requiredTags.every((tag) => evidence.requiredTags.includes(tag))) errors.push('ownership tags not proven');
if (!Number.isInteger(evidence.preDeleteOwnedCount) || evidence.preDeleteOwnedCount < 0) errors.push('pre-delete owned inventory was not measured');
if (!sha256.test(evidence.preDeleteInventoryHash ?? '')) errors.push('pre-delete inventory hash is invalid');
if (evidence.resourceGroupExists !== false) errors.push('owned RG still exists');
if (evidence.postDeleteOwnedCount !== 0) errors.push('post-delete owned inventory is not empty');
if (!sha256.test(evidence.postDeleteInventoryHash ?? '')) errors.push('post-delete inventory hash is invalid');
if ((evidence.remainingOwnedResources ?? []).length) errors.push('owned resources remain');
if (evidence.lifecycleExceptionPolicy !== 'exact-cognitive-services-purge') errors.push('lifecycle-exception policy is not exact Cognitive Services purge');
if (!Number.isInteger(evidence.declaredLifecycleExceptionCount) || evidence.declaredLifecycleExceptionCount < 0) errors.push('declared lifecycle-exception count is invalid');
if (!sha256.test(evidence.declaredLifecycleExceptionHash ?? '') || !sha256.test(evidence.remainingLifecycleExceptionHash ?? '')) errors.push('lifecycle-exception hashes are invalid');
if ((evidence.remainingLifecycleExceptions ?? []).length) errors.push('owned lifecycle exceptions remain');
if (evidence.enumeratedDeletion === true) errors.push('broad enumerate-and-delete is prohibited');
if (!Number.isInteger(evidence.beforeUnrelatedCount) || evidence.beforeUnrelatedCount < 0) errors.push('unrelated pre-delete inventory was not measured');
if (evidence.unrelatedInventoryScope !== 'subscription-read-oidc') errors.push('unrelated inventory was not measured with the subscription-read identity');
if (evidence.beforeUnrelatedCount !== evidence.afterUnrelatedCount) errors.push('unrelated resource count changed');
if (!sha256.test(evidence.beforeUnrelatedHash ?? '') || evidence.beforeUnrelatedHash !== evidence.afterUnrelatedHash) errors.push('unrelated resource inventory changed');
if (evidence.artifactHashes?.ownedBeforeSha256 !== evidence.preDeleteInventoryHash) errors.push('owned-before artifact hash mismatch');
if (evidence.artifactHashes?.ownedAfterSha256 !== evidence.postDeleteInventoryHash) errors.push('owned-after artifact hash mismatch');
if (evidence.artifactHashes?.unrelatedBeforeSha256 !== evidence.beforeUnrelatedHash) errors.push('unrelated-before artifact hash mismatch');
if (evidence.artifactHashes?.unrelatedAfterSha256 !== evidence.afterUnrelatedHash) errors.push('unrelated-after artifact hash mismatch');
if (evidence.artifactHashes?.lifecycleDeclaredSha256 !== evidence.declaredLifecycleExceptionHash) errors.push('declared lifecycle artifact hash mismatch');
if (evidence.artifactHashes?.lifecycleRemainingSha256 !== evidence.remainingLifecycleExceptionHash) errors.push('remaining lifecycle artifact hash mismatch');
if (rawDirectory) {
  const rawFiles = [
    ['before-owned.json', 'preDeleteInventoryHash', ownedInventoryHash],
    ['after-owned.json', 'postDeleteInventoryHash', ownedInventoryHash],
    ['before-unrelated.json', 'beforeUnrelatedHash', unrelatedInventoryHash],
    ['after-unrelated.json', 'afterUnrelatedHash', unrelatedInventoryHash],
  ];
  for (const [name, field, calculateHash] of rawFiles) {
    const resources = JSON.parse(readFileSync(join(rawDirectory, name), 'utf8'));
    if (calculateHash(resources) !== evidence[field]) errors.push(`${name} does not match ${field}`);
  }
  const beforeOwned = JSON.parse(readFileSync(join(rawDirectory, 'before-owned.json'), 'utf8'));
  const observedGroupExists = JSON.parse(readFileSync(join(rawDirectory, 'group-exists.json'), 'utf8'));
  if (observedGroupExists !== false || observedGroupExists !== evidence.resourceGroupExists) errors.push('group-exists.json does not prove resource-group absence');
  for (const resource of beforeOwned) {
    const tags = resource.tags ?? {};
    for (const tag of requiredTags) if (!tags[tag]) errors.push(`raw owned resource missing ${tag}`);
    if (tags['factory-run-id'] !== expectedRunId) errors.push('raw owned resource has wrong factory-run-id');
    if (tags['factory-owner'] !== 'aimarket-factory') errors.push('raw owned resource has wrong factory-owner');
    if (tags['factory-repository'] !== expectedRepository) errors.push('raw owned resource has wrong factory-repository');
    if (!Number.isFinite(Date.parse(tags['factory-expires-at']))) errors.push('raw owned resource has invalid factory-expires-at');
  }
  const declared = JSON.parse(readFileSync(join(rawDirectory, 'lifecycle-declared.json'), 'utf8'));
  const deleted = JSON.parse(readFileSync(join(rawDirectory, 'lifecycle-deleted.json'), 'utf8'));
  const expectedDeclared = prepareLifecycleExceptions(beforeOwned);
  const expectedRemaining = findRemainingLifecycleExceptions(declared, deleted);
  const declaredKeys = new Set(declared.map(lifecycleKey));
  if (expectedDeclared.some((item) => !declaredKeys.has(lifecycleKey(item)))) errors.push('lifecycle declarations omit an account from raw owned inventory');
  if (declared.some((item) => item.type !== 'microsoft.cognitiveservices/accounts' || item.resourceGroup !== evidence.resourceGroup || !item.name || !item.location)) errors.push('lifecycle declarations contain an invalid or out-of-scope target');
  if (recoverLifecycleExceptions(deleted, evidence.resourceGroup).length) errors.push('soft-deleted Cognitive Services accounts remain for the owned resource group');
  if (evidence.declaredLifecycleExceptionCount !== declared.length) errors.push('declared lifecycle count does not match raw artifact');
  if (stableHash(declared.map(lifecycleKey)) !== evidence.declaredLifecycleExceptionHash) errors.push('declared lifecycle hash does not match raw artifact');
  if (expectedRemaining.length) errors.push('soft-deleted Cognitive Services accounts remain');
  if (stableHash(expectedRemaining.map(lifecycleKey)) !== evidence.remainingLifecycleExceptionHash) errors.push('remaining lifecycle hash does not match Azure read-back');
}
if (evidence.unrelatedResourcesPreserved !== true) errors.push('unrelated-resource preservation not proven');
if (!Number.isFinite(Date.parse(evidence.completedAt))) errors.push('completedAt is invalid');
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('PASS observed exact cleanup and unrelated-resource preservation');
