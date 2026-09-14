#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const COGNITIVE_TYPE = 'microsoft.cognitiveservices/accounts';
const UNSUPPORTED_SOFT_DELETE_TYPES = new Set([
  'microsoft.keyvault/vaults',
  'microsoft.apimanagement/service',
  'microsoft.recoveryservices/vaults',
  'microsoft.appconfiguration/configurationstores',
]);

export function prepareLifecycleExceptions(resources) {
  const unsupported = resources.filter((resource) => UNSUPPORTED_SOFT_DELETE_TYPES.has(String(resource.type).toLowerCase()));
  if (unsupported.length) throw new Error(`unsupported soft-delete resource types: ${[...new Set(unsupported.map((resource) => resource.type))].join(', ')}`);
  return resources
    .filter((resource) => String(resource.type).toLowerCase() === COGNITIVE_TYPE)
    .map((resource) => ({
      type: COGNITIVE_TYPE,
      name: resource.name,
      location: resource.location,
      resourceGroup: resource.resourceGroup,
    }))
    .sort((left, right) => `${left.resourceGroup}/${left.name}`.localeCompare(`${right.resourceGroup}/${right.name}`));
}

export function findRemainingLifecycleExceptions(declared, deletedAccounts) {
  return declared.filter((item) => deletedAccounts.some((deleted) => {
    const deletedGroup = deletedAccountResourceGroup(deleted);
    return String(deleted.name).toLowerCase() === String(item.name).toLowerCase()
      && String(deleted.location).toLowerCase() === String(item.location).toLowerCase()
      && (!deletedGroup || String(deletedGroup).toLowerCase() === String(item.resourceGroup).toLowerCase());
  }));
}

export function deletedAccountResourceGroup(deleted) {
  const explicit = deleted.resourceGroup ?? deleted.properties?.resourceGroup ?? deleted.properties?.resourceGroupName;
  if (explicit) return explicit;
  return String(deleted.id ?? '').match(/\/resourceGroups\/([^/]+)/i)?.[1];
}

export function recoverLifecycleExceptions(deletedAccounts, resourceGroup) {
  return deletedAccounts
    .filter((deleted) => String(deletedAccountResourceGroup(deleted)).toLowerCase() === resourceGroup.toLowerCase())
    .map((deleted) => ({
      type: COGNITIVE_TYPE,
      name: deleted.name,
      location: deleted.location,
      resourceGroup,
    }))
    .sort((left, right) => `${left.resourceGroup}/${left.name}`.localeCompare(`${right.resourceGroup}/${right.name}`));
}

export function mergeLifecycleExceptions(...sets) {
  const unique = new Map();
  for (const item of sets.flat()) unique.set(`${item.type}/${item.resourceGroup}/${item.location}/${item.name}`.toLowerCase(), item);
  return [...unique.values()].sort((left, right) => `${left.resourceGroup}/${left.name}`.localeCompare(`${right.resourceGroup}/${right.name}`));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [mode, firstFile, secondFile] = process.argv.slice(2);
  if (mode === 'prepare' && firstFile) {
    console.log(JSON.stringify(prepareLifecycleExceptions(JSON.parse(readFileSync(firstFile, 'utf8')))));
  } else if (mode === 'remaining' && firstFile && secondFile) {
    console.log(JSON.stringify(findRemainingLifecycleExceptions(
      JSON.parse(readFileSync(firstFile, 'utf8')),
      JSON.parse(readFileSync(secondFile, 'utf8')),
    )));
  } else if (mode === 'recover' && firstFile && secondFile) {
    console.log(JSON.stringify(recoverLifecycleExceptions(JSON.parse(readFileSync(firstFile, 'utf8')), secondFile)));
  } else if (mode === 'merge' && firstFile && secondFile) {
    console.log(JSON.stringify(mergeLifecycleExceptions(
      JSON.parse(readFileSync(firstFile, 'utf8')),
      JSON.parse(readFileSync(secondFile, 'utf8')),
    )));
  } else {
    console.error('usage: lifecycle-exceptions.mjs prepare <owned.json> | remaining <declared.json> <deleted.json> | recover <deleted.json> <resource-group> | merge <first.json> <second.json>');
    process.exit(2);
  }
}
