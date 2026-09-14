#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

const RUN_ID = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;
const SHA = /^[0-9a-f]{40}$/;
const TASK_ID = /^F(?:1[0-5]|[0-9])$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function validateRunContext({ runId, resourceGroup, repository, commitSha, taskId }) {
  const errors = [];
  if (!RUN_ID.test(runId ?? '')) errors.push('runId must be 1-32 lowercase letters, digits, or interior hyphens');
  if (resourceGroup !== `aimarket-factory-${runId}`) errors.push('resourceGroup must exactly match aimarket-factory-<runId>');
  if (!REPOSITORY.test(repository ?? '')) errors.push('repository must be owner/name');
  if (!SHA.test(commitSha ?? '')) errors.push('commitSha must be a 40-character lowercase SHA');
  if (!TASK_ID.test(taskId ?? '')) errors.push('taskId must be F0-F15');
  return errors;
}

function parse(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith('--') || value === undefined) throw new Error('arguments must be --name value pairs');
    values[flag.slice(2)] = value;
  }
  return {
    runId: values['run-id'],
    resourceGroup: values['resource-group'],
    repository: values.repository,
    commitSha: values['commit-sha'],
    taskId: values['task-id'],
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const errors = validateRunContext(parse(process.argv.slice(2)));
    if (errors.length) {
      console.error(errors.join('\n'));
      process.exitCode = 1;
    } else {
      console.log('PASS immutable factory run context');
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
