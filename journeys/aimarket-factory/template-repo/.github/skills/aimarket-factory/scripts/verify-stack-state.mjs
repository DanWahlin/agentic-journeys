#!/usr/bin/env node
import fs from 'node:fs';

const [stackFile, graphFile] = process.argv.slice(2);
if (!stackFile) {
  console.error('usage: verify-stack-state.mjs <stack-state.json> [task-graph.json]');
  process.exit(2);
}

const state = JSON.parse(fs.readFileSync(stackFile, 'utf8'));
const pullRequests = state.pullRequests ?? state.prs ?? [];
const errors = [];
const branches = new Map();
const pullRequestsById = new Map(pullRequests.map((pullRequest) => [pullRequest.id, pullRequest]));
let tasksById;

if (graphFile) {
  const graph = JSON.parse(fs.readFileSync(graphFile, 'utf8'));
  tasksById = new Map((graph.tasks ?? graph).map((task) => [task.id, task]));
}

for (const pullRequest of pullRequests) {
  if (branches.has(pullRequest.head)) errors.push(`branch ${pullRequest.head} reused by ${branches.get(pullRequest.head)} and ${pullRequest.id}`);
  branches.set(pullRequest.head, pullRequest.id);

  if (pullRequest.merged === false && pullRequest.expectedBase && pullRequest.base !== pullRequest.expectedBase) {
    errors.push(`${pullRequest.id} base ${pullRequest.base} expected ${pullRequest.expectedBase}`);
  }
  if (pullRequest.expectedHeadSha && pullRequest.headSha !== pullRequest.expectedHeadSha) errors.push(`${pullRequest.id} stale head`);
  if (pullRequest.independent && pullRequest.parent) errors.push(`${pullRequest.id} independent issue cannot have stack parent`);
  if (pullRequest.parent && !pullRequestsById.has(pullRequest.parent)) errors.push(`${pullRequest.id} unknown parent ${pullRequest.parent}`);

  if (tasksById && pullRequest.parent) {
    const parent = pullRequestsById.get(pullRequest.parent);
    const task = tasksById.get(pullRequest.taskId);
    const parentTask = tasksById.get(parent?.taskId);
    if (!task) errors.push(`${pullRequest.id} unknown task ${pullRequest.taskId ?? 'missing'}`);
    if (!parentTask) errors.push(`${pullRequest.parent} unknown task ${parent?.taskId ?? 'missing'}`);
    if (task && parentTask) {
      if (task.stack !== parentTask.stack) errors.push(`${pullRequest.id} and ${pullRequest.parent} cross stack boundaries`);
      if (!(task.dependsOn ?? []).includes(parentTask.id)) errors.push(`${pullRequest.id} task ${task.id} does not directly depend on ${parentTask.id}`);
    }
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`PASS stack state ${pullRequests.length} PRs${tasksById ? ' against canonical graph' : ''}`);
