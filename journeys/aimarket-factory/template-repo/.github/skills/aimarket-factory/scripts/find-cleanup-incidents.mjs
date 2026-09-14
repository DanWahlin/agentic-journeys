#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { deletedAccountResourceGroup } from './lifecycle-exceptions.mjs';

const [groupsFile, resourcesFile, deletedAccountsFile] = process.argv.slice(2);
if (!groupsFile || !resourcesFile) {
  console.error('usage: find-cleanup-incidents.mjs <groups.json> <resources.json> [deleted-accounts.json]');
  process.exit(2);
}
const groups = JSON.parse(readFileSync(groupsFile, 'utf8'));
const resources = JSON.parse(readFileSync(resourcesFile, 'utf8'));
const deletedAccounts = deletedAccountsFile ? JSON.parse(readFileSync(deletedAccountsFile, 'utf8')) : [];
const requiredTags = ['factory-run-id', 'factory-owner', 'factory-repository', 'factory-expires-at'];
const now = Date.now();
const incidents = [];
for (const group of groups.filter((item) => String(item.name).startsWith('aimarket-factory-'))) {
  const tags = group.tags ?? {};
  const reasons = [];
  const expiresAt = Date.parse(tags['factory-expires-at']);
  if (!Number.isFinite(expiresAt)) reasons.push('resource group has no valid expiry tag');
  else if (expiresAt < now) reasons.push('resource group TTL expired');
  if (tags['factory-owner'] !== 'aimarket-factory') reasons.push('resource group owner tag is missing or invalid');
  if (!/^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(tags['factory-run-id'] ?? '')) reasons.push('resource group run ID tag is missing or invalid');
  else if (group.name !== `aimarket-factory-${tags['factory-run-id']}`) reasons.push('resource group name does not match its run ID tag');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(tags['factory-repository'] ?? '')) reasons.push('resource group repository tag is missing or invalid');
  const owned = resources.filter((resource) => resource.resourceGroup === group.name);
  const untaggedCount = owned.filter((resource) => requiredTags.some((tag) => !(resource.tags ?? {})[tag])).length;
  if (untaggedCount) reasons.push(`${untaggedCount} resource(s) are missing mandatory ownership tags`);
  const mismatchedCount = owned.filter((resource) => {
    const resourceTags = resource.tags ?? {};
    return resourceTags['factory-run-id'] !== tags['factory-run-id']
      || resourceTags['factory-owner'] !== 'aimarket-factory'
      || resourceTags['factory-repository'] !== tags['factory-repository']
      || resourceTags['factory-expires-at'] !== tags['factory-expires-at'];
  }).length;
  if (mismatchedCount) reasons.push(`${mismatchedCount} resource(s) have ownership tags that do not match the resource group`);
  if (reasons.length) {
    incidents.push({
      resourceGroup: group.name,
      runId: tags['factory-run-id'] ?? group.name.slice('aimarket-factory-'.length),
      reasons,
    });
  }
}
for (const account of deletedAccounts) {
  const resourceGroup = deletedAccountResourceGroup(account);
  if (!String(resourceGroup).startsWith('aimarket-factory-')) continue;
  const existing = incidents.find((incident) => incident.resourceGroup === resourceGroup);
  const reason = 'a declared soft-deleted Cognitive Services account remains';
  if (existing) existing.reasons.push(reason);
  else incidents.push({ resourceGroup, runId: resourceGroup.slice('aimarket-factory-'.length), reasons: [reason] });
}
incidents.sort((left, right) => left.resourceGroup.localeCompare(right.resourceGroup));
console.log(JSON.stringify(incidents));
