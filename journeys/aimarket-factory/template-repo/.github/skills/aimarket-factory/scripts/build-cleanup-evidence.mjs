#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { prepareLifecycleExceptions } from './lifecycle-exceptions.mjs';

const REQUIRED_TAGS = ['factory-run-id', 'factory-owner', 'factory-repository', 'factory-expires-at'];

const [beforeOwnedFile, afterOwnedFile, beforeUnrelatedFile, afterUnrelatedFile, groupExistsFile, lifecycleDeclaredFile, lifecycleRemainingFile, resourceGroup, runId, repository, commitSha, producerRunId, policyVersion] = process.argv.slice(2);
if (!policyVersion) {
  console.error('usage: build-cleanup-evidence.mjs <before-owned> <after-owned> <before-unrelated> <after-unrelated> <group-exists> <lifecycle-declared> <lifecycle-remaining> <resource-group> <run-id> <repository> <commit-sha> <producer-run-id> <policy-version>');
  process.exit(2);
}

const readArray = (file) => {
  const value = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(value)) throw new Error(`${file} must contain a JSON array`);
  return value;
};
const hash = (values) => createHash('sha256').update(JSON.stringify([...values].sort())).digest('hex');
const ownedInventoryHash = (resources) => hash(resources.map((resource) => JSON.stringify({
  id: resource.id,
  type: resource.type,
  tags: Object.fromEntries(REQUIRED_TAGS.map((tag) => [tag, resource.tags?.[tag] ?? null])),
})));
const beforeOwned = readArray(beforeOwnedFile);
const afterOwned = readArray(afterOwnedFile);
const beforeUnrelated = readArray(beforeUnrelatedFile);
const afterUnrelated = readArray(afterUnrelatedFile);
const lifecycleDeclared = readArray(lifecycleDeclaredFile);
const lifecycleRemaining = readArray(lifecycleRemainingFile);
const resourceGroupExists = JSON.parse(readFileSync(groupExistsFile, 'utf8'));
const expectedLifecycle = prepareLifecycleExceptions(beforeOwned);
const lifecycleKey = (item) => `${item.type}/${item.resourceGroup}/${item.location}/${item.name}`;
const declaredKeys = new Set(lifecycleDeclared.map(lifecycleKey));
if (expectedLifecycle.some((item) => !declaredKeys.has(lifecycleKey(item)))) throw new Error('declared lifecycle exceptions omit an account from the owned inventory');
if (lifecycleDeclared.some((item) => item.type !== 'microsoft.cognitiveservices/accounts' || item.resourceGroup !== resourceGroup || !item.name || !item.location)) {
  throw new Error('declared lifecycle exceptions contain an invalid or out-of-scope target');
}
const tagErrors = beforeOwned.flatMap((resource) => {
  const tags = resource.tags ?? {};
  const errors = REQUIRED_TAGS.filter((tag) => !tags[tag]).map((tag) => `${resource.type ?? 'resource'} missing ${tag}`);
  if (tags['factory-run-id'] && tags['factory-run-id'] !== runId) errors.push(`${resource.type ?? 'resource'} has the wrong factory-run-id`);
  if (tags['factory-owner'] && tags['factory-owner'] !== 'aimarket-factory') errors.push(`${resource.type ?? 'resource'} has the wrong factory-owner`);
  if (tags['factory-repository'] && tags['factory-repository'] !== repository) errors.push(`${resource.type ?? 'resource'} has the wrong factory-repository`);
  if (tags['factory-expires-at'] && !Number.isFinite(Date.parse(tags['factory-expires-at']))) errors.push(`${resource.type ?? 'resource'} has an invalid factory-expires-at`);

  return errors;
});
if (tagErrors.length) throw new Error(tagErrors.join('\n'));
const beforeUnrelatedIds = beforeUnrelated.map((resource) => resource.id);
const afterUnrelatedIds = afterUnrelated.map((resource) => resource.id);
const ownedBeforeHash = ownedInventoryHash(beforeOwned);
const ownedAfterHash = ownedInventoryHash(afterOwned);
const unrelatedBeforeHash = hash(beforeUnrelatedIds);
const unrelatedAfterHash = hash(afterUnrelatedIds);
const lifecycleDeclaredHash = hash(lifecycleDeclared.map(lifecycleKey));
const lifecycleRemainingHash = hash(lifecycleRemaining.map(lifecycleKey));
const evidence = {
  schema: 'factory-cleanup-evidence-v1',
  repository,
  runId,
  commitSha,
  producerRunId,
  policyVersion,
  resourceGroup,
  exactDeletionTarget: resourceGroup,
  requiredTags: REQUIRED_TAGS,
  preDeleteOwnedCount: beforeOwned.length,
  preDeleteInventoryHash: ownedBeforeHash,
  resourceGroupExists,
  postDeleteOwnedCount: afterOwned.length,
  postDeleteInventoryHash: ownedAfterHash,
  remainingOwnedResources: afterOwned.map((resource) => createHash('sha256').update(resource.id).digest('hex')),
  lifecycleExceptionPolicy: 'exact-cognitive-services-purge',
  declaredLifecycleExceptionCount: lifecycleDeclared.length,
  declaredLifecycleExceptionHash: lifecycleDeclaredHash,
  remainingLifecycleExceptions: lifecycleRemaining.map((item) => createHash('sha256').update(lifecycleKey(item)).digest('hex')),
  remainingLifecycleExceptionHash: lifecycleRemainingHash,
  enumeratedDeletion: false,
  beforeUnrelatedCount: beforeUnrelatedIds.length,
  afterUnrelatedCount: afterUnrelatedIds.length,
  unrelatedInventoryScope: 'subscription-read-oidc',
  beforeUnrelatedHash: unrelatedBeforeHash,
  afterUnrelatedHash: unrelatedAfterHash,
  artifactHashes: {
    ownedBeforeSha256: ownedBeforeHash,
    ownedAfterSha256: ownedAfterHash,
    unrelatedBeforeSha256: unrelatedBeforeHash,
    unrelatedAfterSha256: unrelatedAfterHash,
    lifecycleDeclaredSha256: lifecycleDeclaredHash,
    lifecycleRemainingSha256: lifecycleRemainingHash,
  },
  unrelatedResourcesPreserved: beforeUnrelatedIds.length === afterUnrelatedIds.length && unrelatedBeforeHash === unrelatedAfterHash,
  completedAt: new Date().toISOString(),
};
console.log(JSON.stringify(evidence, null, 2));
