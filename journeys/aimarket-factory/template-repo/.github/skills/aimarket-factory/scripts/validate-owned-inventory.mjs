#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { prepareLifecycleExceptions } from './lifecycle-exceptions.mjs';

const [file, runId, repository] = process.argv.slice(2);
if (!file || !runId || !repository) {
  console.error('usage: validate-owned-inventory.mjs <owned-resources.json> <run-id> <repository>');
  process.exit(2);
}
const resources = JSON.parse(readFileSync(file, 'utf8'));
if (!Array.isArray(resources)) throw new Error('owned inventory must be an array');
const requiredTags = ['factory-run-id', 'factory-owner', 'factory-repository', 'factory-expires-at'];
const errors = [];
let lifecycleCount = 0;
try {
  lifecycleCount = prepareLifecycleExceptions(resources).length;
} catch (error) {
  errors.push(error.message);
}
for (const resource of resources) {
  const tags = resource.tags ?? {};
  for (const tag of requiredTags) if (!tags[tag]) errors.push(`${resource.type ?? 'resource'} missing ${tag}`);
  if (tags['factory-run-id'] && tags['factory-run-id'] !== runId) errors.push(`${resource.type ?? 'resource'} has the wrong factory-run-id`);
  if (tags['factory-owner'] && tags['factory-owner'] !== 'aimarket-factory') errors.push(`${resource.type ?? 'resource'} has the wrong factory-owner`);
  if (tags['factory-repository'] && tags['factory-repository'] !== repository) errors.push(`${resource.type ?? 'resource'} has the wrong factory-repository`);
  if (tags['factory-expires-at'] && !Number.isFinite(Date.parse(tags['factory-expires-at']))) errors.push(`${resource.type ?? 'resource'} has an invalid factory-expires-at`);

}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`PASS ${resources.length} owned resources match exact tags; ${lifecycleCount} exact Cognitive Services purge exception(s) declared`);
