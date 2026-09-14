#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const factoryStates = new Set([
  'factory:proposed',
  'factory:needs-clarification',
  'factory:planned',
  'factory:ready',
  'factory:running',
  'factory:review',
  'factory:blocked',
  'factory:done',
  'factory:cancelled',
]);
const activeStates = new Set(['factory:ready', 'factory:running', 'factory:review']);
const allowedMaintainerPermissions = new Set(['admin', 'maintain', 'write']);

export function parseTaskGraph(text) {
  const tasks = [];
  let current;

  for (const line of text.split(/\r?\n/)) {
    const idMatch = line.match(/^  - id: (F\d+)$/);
    if (idMatch) {
      current = { id: idMatch[1], dependsOn: [], automaticDispatch: false, gatedWorkItem: false, requiresControlApproval: false };
      tasks.push(current);
      continue;
    }
    if (!current) continue;

    const stackMatch = line.match(/^    stack: (.+)$/);
    if (stackMatch) current.stack = stackMatch[1];

    const dependenciesMatch = line.match(/^    dependsOn: \[(.*)]$/);
    if (dependenciesMatch) {
      current.dependsOn = dependenciesMatch[1]
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
    }

    const automaticMatch = line.match(/^    automaticDispatch: (true|false)$/);
    if (automaticMatch) current.automaticDispatch = automaticMatch[1] === 'true';

    const gatedMatch = line.match(/^    gatedWorkItem: (true|false)$/);
    if (gatedMatch) current.gatedWorkItem = gatedMatch[1] === 'true';

    const controlApprovalMatch = line.match(/^    requiresControlApproval: (true|false)$/);
    if (controlApprovalMatch) current.requiresControlApproval = controlApprovalMatch[1] === 'true';
  }

  return tasks;
}

export function parseRequiredChecks(text, taskId) {
  const checks = [];
  let current;

  for (const line of text.split(/\r?\n/)) {
    const idMatch = line.match(/^  - id: (.+)$/);
    if (idMatch) {
      current = { id: idMatch[1], required: false, appliesTo: [], mergeGate: true };
      checks.push(current);
      continue;
    }
    if (!current) continue;

    const requiredMatch = line.match(/^    required: (true|false)$/);
    if (requiredMatch) current.required = requiredMatch[1] === 'true';

    const appliesMatch = line.match(/^    appliesTo: \[(.*)]$/);
    if (appliesMatch) {
      current.appliesTo = appliesMatch[1].split(',').map((value) => value.trim());
    }

    const mergeGateMatch = line.match(/^    mergeGate: (true|false)$/);
    if (mergeGateMatch) current.mergeGate = mergeGateMatch[1] === 'true';
  }

  return checks
    .filter((check) => check.required && check.mergeGate && check.appliesTo.includes(taskId))
    .map((check) => check.id);
}

export function stableIdForIssue(issue) {
  const titleMatch = issue.title?.match(/^\[(F\d+)]\s/);
  const bodyMatch = issue.body?.match(/^# Stable ID\s*\r?\n(F\d+)\s*$/m);
  if (!titleMatch || !bodyMatch || titleMatch[1] !== bodyMatch[1]) return undefined;
  return titleMatch[1];
}

export function parentIssueNumber(issue) {
  const match = issue.body?.match(/^# Parent issue\s*\r?\n#?(\d+)\s*$/m);
  return match ? Number(match[1]) : undefined;
}

export function sha256(value) {
  return createHash('sha256').update(value ?? '', 'utf8').digest('hex');
}

export function issueMatchesApproval(issue, approval) {
  return Boolean(
    approval &&
      issue?.number === approval.issue &&
      issue?.title === approval.title &&
      sha256(issue?.body) === approval.bodySha256,
  );
}

export function stateLabel(issue) {
  const states = (issue.labels ?? [])
    .map((label) => (typeof label === 'string' ? label : label.name))
    .filter((name) => factoryStates.has(name));
  return states.length === 1 ? states[0] : undefined;
}

export function replaceStateLabel(issue, nextState) {
  const labels = (issue.labels ?? []).map((label) => (typeof label === 'string' ? label : label.name));
  return [...labels.filter((label) => !factoryStates.has(label)), nextState];
}

export function planReadyTransitions(
  tasks,
  issues,
  approval,
  verifiedDoneTasks = new Set(),
  { maxActiveStacks = 2, maxReviewPullRequests = 4 } = {},
) {
  const issuesByTask = new Map();
  for (const issue of issues) {
    const stableId = stableIdForIssue(issue);
    if (!stableId) continue;
    const matches = issuesByTask.get(stableId) ?? [];
    matches.push(issue);
    issuesByTask.set(stableId, matches);
  }
  const duplicateTask = [...issuesByTask].find(([, matches]) => matches.length !== 1);
  if (duplicateTask) {
    throw new Error(`Stable ID ${duplicateTask[0]} appears on ${duplicateTask[1].length} issues; refusing incomplete WIP accounting.`);
  }
  const issueByTask = new Map(
    [...issuesByTask]
      .filter(([, matches]) => matches.length === 1)
      .map(([taskId, matches]) => [taskId, matches[0]]),
  );
  const approvedTaskById = new Map((approval?.approvedTasks ?? []).map((task) => [task.id, task]));
  const parentIssue = issues.find((issue) => issue.number === approval?.parent?.issue);
  const parentApproved =
    parentIssue?.state === 'open' &&
    stateLabel(parentIssue) === 'factory:planned' &&
    issueMatchesApproval(parentIssue, approval?.parent);

  const activeStacks = new Set();
  for (const task of tasks) {
    const issue = issueByTask.get(task.id);
    if (issue?.state === 'open' && activeStates.has(stateLabel(issue)) && task.stack !== 'Preflight') activeStacks.add(task.stack);
  }
  const reviewCount = issues.filter((issue) => issue.state === 'open' && stateLabel(issue) === 'factory:review').length;
  if (!parentApproved || reviewCount >= maxReviewPullRequests) return [];

  const selected = [];
  const candidates = tasks
    .filter((task) => task.automaticDispatch && !task.gatedWorkItem)
    .filter((task) => {
      const issue = issueByTask.get(task.id);
      return (
        issue?.state === 'open' &&
        stateLabel(issue) === 'factory:planned' &&
        issueMatchesApproval(issue, approvedTaskById.get(task.id)) &&
        issue.labels.some((label) => (typeof label === 'string' ? label : label.name) === 'factory:owned') &&
        (!task.requiresControlApproval ||
          issue.labels.some((label) => (typeof label === 'string' ? label : label.name) === 'factory-control:approved')) &&
        parentIssueNumber(issue) === approval.parent.issue &&
        task.dependsOn.every((dependency) => verifiedDoneTasks.has(dependency))
      );
    })
    .sort((left, right) => Number(left.id.slice(1)) - Number(right.id.slice(1)));

  for (const task of candidates) {
    if (task.stack !== 'Preflight' && !activeStacks.has(task.stack) && activeStacks.size >= maxActiveStacks) continue;
    selected.push({ task, issue: issueByTask.get(task.id) });
    if (task.stack !== 'Preflight') activeStacks.add(task.stack);
  }

  return selected;
}

export function hasIndependentFinalHeadReview(comments, headSha, pullRequestNumber, repository) {
  return comments.some((comment) => {
    const login = comment.user?.login ?? '';
    const body = comment.body ?? '';
    return (
      login === 'github-actions[bot]' &&
      body.includes('Independent review evidence') &&
      body.includes(`Head verified:** \`${headSha}\``) &&
      body.includes('no blocking findings identified') &&
      body.includes('workflow_id: aimarket-factory-review') &&
      body.includes(` for #${pullRequestNumber}`) &&
      body.includes(`https://github.com/${repository}/actions/runs/`)
    );
  });
}

export function reviewRunIdFromComment(comment, headSha, pullRequestNumber, repository) {
  if (!hasIndependentFinalHeadReview([comment], headSha, pullRequestNumber, repository)) return undefined;
  const escapedRepository = repository.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = comment.body?.match(new RegExp(`github\\.com/${escapedRepository}/actions/runs/(\\d+)`));
  return match?.[1];
}

export function hasExactClosingIssue(closingIssues, issueNumber) {
  return closingIssues.length === 1 && closingIssues[0].number === issueNumber;
}

export function historicalReviewRunIdFor(approval, repository, pullRequestNumber, headSha) {
  return approval?.reviewRepository === repository &&
    approval?.reviewPullRequest === pullRequestNumber &&
    approval?.reviewHeadSha === headSha
    ? approval.reviewRunId
    : undefined;
}

export function hasExactRunPullRequestAssociation(pullRequests, pullRequestNumber, allowEmpty = false) {
  if (!Array.isArray(pullRequests)) return false;
  if (pullRequests.length === 0) return allowEmpty;
  return pullRequests.length === 1 && pullRequests[0].number === pullRequestNumber;
}

export function isCopilotActor(login) {
  return login === 'Copilot' || login === 'copilot-swe-agent';
}

function createGitHubClient(token, repository) {
  const [owner, name] = repository.split('/');
  const baseUrl = process.env.GITHUB_API_URL ?? 'https://api.github.com';
  const graphqlUrl = process.env.GITHUB_GRAPHQL_URL ?? 'https://api.github.com/graphql';
  const headers = {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    'x-github-api-version': '2022-11-28',
  };

  async function request(path, options = {}) {
    const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { ...headers, ...options.headers } });
    if (!response.ok) throw new Error(`${options.method ?? 'GET'} ${path} failed: ${response.status} ${await response.text()}`);
    if (response.status === 204) return undefined;
    return response.json();
  }

  async function graphql(query, variables) {
    const response = await fetch(graphqlUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) throw new Error(`GraphQL request failed: ${response.status} ${await response.text()}`);
    const payload = await response.json();
    if (payload.errors?.length) throw new Error(`GraphQL request failed: ${JSON.stringify(payload.errors)}`);
    return payload.data;
  }

  async function requestAll(path, key) {
    const separator = path.includes('?') ? '&' : '?';
    const collected = [];
    for (let page = 1; page <= 10; page += 1) {
      const payload = await request(`${path}${separator}per_page=100&page=${page}`);
      const items = key ? payload[key] : payload;
      if (!Array.isArray(items)) throw new Error(`Paginated response ${path} did not contain ${key ?? 'an array'}.`);
      collected.push(...items);
      if (items.length < 100) return collected;
    }
    throw new Error(`Pagination cap exceeded for ${path}; refusing incomplete factory evidence.`);
  }

  return { owner, name, request, requestAll, graphql };
}

async function listFactoryIssues(client) {
  const issues = await client.requestAll(`/repos/${client.owner}/${client.name}/issues?state=all`);
  return issues.filter((issue) => !issue.pull_request);
}

async function closingIssuesForPullRequest(client, pullRequestNumber) {
  const data = await client.graphql(
    `query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){closingIssuesReferences(first:100){totalCount nodes{number title body state updatedAt labels(first:30){nodes{name}}}}}}}`,
    { owner: client.owner, name: client.name, number: pullRequestNumber },
  );
  const references = data.repository.pullRequest.closingIssuesReferences;
  if (references.totalCount !== references.nodes.length) throw new Error('Pull request closes more than 100 issues; refusing incomplete evidence.');
  return references.nodes.map((issue) => ({
    ...issue,
    state: issue.state.toLowerCase(),
    updated_at: issue.updatedAt,
    labels: issue.labels.nodes,
  }));
}

async function pullRequestsClosingIssue(client, issueNumber) {
  const data = await client.graphql(
    `query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){issue(number:$number){closedByPullRequestsReferences(first:100){totalCount nodes{number merged mergedBy{login} headRefOid baseRefName headRepository{nameWithOwner}}}}}}`,
    { owner: client.owner, name: client.name, number: issueNumber },
  );
  const references = data.repository.issue.closedByPullRequestsReferences;
  if (references.totalCount !== references.nodes.length) throw new Error(`Issue #${issueNumber} has more than 100 closing pull requests.`);
  return references.nodes;
}

async function requireMaintainerMerge(client, login) {
  if (!login || /copilot|\[bot]$/i.test(login)) throw new Error(`Merge actor ${login || '<missing>'} is not an authorized maintainer.`);
  const permission = await client.request(`/repos/${client.owner}/${client.name}/collaborators/${encodeURIComponent(login)}/permission`);
  if (!allowedMaintainerPermissions.has(permission.permission)) {
    throw new Error(`Merge actor ${login} has insufficient repository permission: ${permission.permission}.`);
  }
}

async function requireFinalHeadEvidence(client, issue, taskId, taskApproval, pullRequestNumber, headSha, requiredChecksText) {
  const checkRuns = await client.requestAll(`/repos/${client.owner}/${client.name}/commits/${headSha}/check-runs`, 'check_runs');
  const successfulChecks = new Set(
    checkRuns
      .filter((check) => check.status === 'completed' && check.conclusion === 'success' && check.app?.slug === 'github-actions')
      .map((check) => check.name),
  );
  const requiredChecks = parseRequiredChecks(requiredChecksText, taskId);
  const missingChecks = requiredChecks.filter((check) => !successfulChecks.has(check));
  if (missingChecks.length) throw new Error(`Final head ${headSha} is missing trusted successful checks: ${missingChecks.join(', ')}.`);

  const comments = [
    ...(await client.requestAll(`/repos/${client.owner}/${client.name}/issues/${issue.number}/comments`)),
    ...(await client.requestAll(`/repos/${client.owner}/${client.name}/issues/${pullRequestNumber}/comments`)),
  ];
  const repository = `${client.owner}/${client.name}`;
  const reviewComment = comments.find((comment) => reviewRunIdFromComment(comment, headSha, pullRequestNumber, repository));
  const historicalReviewRunId = historicalReviewRunIdFor(taskApproval, repository, pullRequestNumber, headSha);
  const reviewRunId =
    (reviewComment && reviewRunIdFromComment(reviewComment, headSha, pullRequestNumber, repository)) ??
    historicalReviewRunId;
  if (!reviewRunId) throw new Error(`Issue #${issue.number} has no independent no-blocker review bound to ${headSha}.`);

  const run = await client.request(`/repos/${client.owner}/${client.name}/actions/runs/${reviewRunId}`);
  const reviewedPullRequest = await client.request(`/repos/${client.owner}/${client.name}/pulls/${pullRequestNumber}`);
  const allowEmptyAssociation = Boolean(historicalReviewRunId && reviewRunId === historicalReviewRunId);
  if (!hasExactRunPullRequestAssociation(run.pull_requests, pullRequestNumber, allowEmptyAssociation)) {
    throw new Error(`Independent review run ${reviewRunId} has an ambiguous or different pull-request association.`);
  }
  if (
    run.path !== '.github/workflows/aimarket-factory-review.lock.yml' ||
    run.event !== 'pull_request' ||
    run.status !== 'completed' ||
    run.conclusion !== 'success' ||
    run.head_sha !== headSha ||
    run.head_branch !== reviewedPullRequest.head.ref ||
    reviewedPullRequest.head.sha !== headSha
  ) {
    throw new Error(`Independent review run ${reviewRunId} is not trusted final-head evidence for PR #${pullRequestNumber}.`);
  }
}

async function verifyMergedCompletion(client, issue, taskId, taskApproval, pullRequest, repository, defaultBranch, requiredChecksText) {
  const normalized = {
    number: pullRequest.number,
    merged: pullRequest.merged,
    mergedBy: pullRequest.merged_by?.login ?? pullRequest.mergedBy?.login,
    headSha: pullRequest.head?.sha ?? pullRequest.headRefOid,
    baseBranch: pullRequest.base?.ref ?? pullRequest.baseRefName,
    headRepository: pullRequest.head?.repo?.full_name ?? pullRequest.headRepository?.nameWithOwner,
  };
  if (!normalized.merged) throw new Error(`PR #${normalized.number} is not merged.`);
  if (normalized.baseBranch !== defaultBranch) throw new Error(`PR #${normalized.number} did not merge into ${defaultBranch}.`);
  if (normalized.headRepository !== repository) throw new Error(`PR #${normalized.number} did not originate in ${repository}.`);
  const closingIssues = await closingIssuesForPullRequest(client, normalized.number);
  if (!hasExactClosingIssue(closingIssues, issue.number)) {
    throw new Error(`PR #${normalized.number} must close only approved issue #${issue.number}; found ${closingIssues.map((candidate) => `#${candidate.number}`).join(', ') || 'none'}.`);
  }
  await requireMaintainerMerge(client, normalized.mergedBy);
  await requireFinalHeadEvidence(client, issue, taskId, taskApproval, normalized.number, normalized.headSha, requiredChecksText);
  return normalized;
}

async function setIssueState(client, issue, nextState, approval) {
  const latest = await client.request(`/repos/${client.owner}/${client.name}/issues/${issue.number}`);
  if (stateLabel(latest) !== stateLabel(issue) || !issueMatchesApproval(latest, approval)) {
    throw new Error(`Issue #${issue.number} changed state or contract while reconciling; refusing a stale update.`);
  }
  await client.request(`/repos/${client.owner}/${client.name}/issues/${issue.number}`, {
    method: 'PATCH',
    body: JSON.stringify({ labels: replaceStateLabel(latest, nextState) }),
  });
  const verified = await client.request(`/repos/${client.owner}/${client.name}/issues/${issue.number}`);
  if (stateLabel(verified) !== nextState || !issueMatchesApproval(verified, approval)) {
    throw new Error(`Issue #${issue.number} did not preserve its approved contract and ${nextState} state.`);
  }
  console.log(`Issue #${issue.number}: ${stateLabel(issue)} -> ${nextState}`);
}

export async function runController({ event, eventName, repository, token, taskGraphText, requiredChecksText, approval }) {
  const client = createGitHubClient(token, repository);
  const validateOnly = process.env.AIMARKET_FACTORY_VALIDATE_ONLY === 'true';
  if (approval?.repository !== repository) throw new Error(`Approval record is for ${approval?.repository ?? '<missing>'}, not ${repository}.`);
  const approvedTaskById = new Map((approval.approvedTasks ?? []).map((task) => [task.id, task]));
  const repositoryMetadata = await client.request(`/repos/${client.owner}/${client.name}`);
  const defaultBranch = repositoryMetadata.default_branch;
  const transition = async (issue, nextState, taskApproval) => {
    if (!validateOnly) return setIssueState(client, issue, nextState, taskApproval);
    if (!issueMatchesApproval(issue, taskApproval)) throw new Error(`Issue #${issue.number} failed approval validation.`);
    console.log(`[validate-only] Issue #${issue.number}: ${stateLabel(issue)} -> ${nextState}`);
    issue.labels = replaceStateLabel(issue, nextState).map((name) => ({ name }));
  };

  if (eventName === 'pull_request' && event.action === 'opened') {
    const pullRequest = event.pull_request;
    if (!isCopilotActor(pullRequest?.user?.login)) {
      console.log('Non-Copilot pull request; no factory worker transition required.');
      return;
    }
    if (!pullRequest?.draft) throw new Error('Factory worker pull requests must open as drafts.');
    if (pullRequest.head?.repo?.full_name !== repository) throw new Error('Factory worker pull requests must come from the same repository.');
    if (pullRequest.base?.ref !== defaultBranch) throw new Error(`Factory worker pull requests must target ${defaultBranch}.`);
    const allLinkedIssues = await closingIssuesForPullRequest(client, pullRequest.number);
    const linkedIssues = allLinkedIssues.filter((issue) => stableIdForIssue(issue));
    if (linkedIssues.length !== 1 || allLinkedIssues.length !== 1) {
      throw new Error(`Factory worker PR must close exactly one F0-F15 issue; found ${allLinkedIssues.length}.`);
    }
    const issue = linkedIssues[0];
    const taskId = stableIdForIssue(issue);
    if (!issueMatchesApproval(issue, approvedTaskById.get(taskId))) throw new Error(`Issue #${issue.number} no longer matches its approved work-order contract.`);
    if (stateLabel(issue) !== 'factory:running') {
      throw new Error(`Factory worker issue #${issue.number} must be factory:running; found ${stateLabel(issue) ?? 'invalid state labels'}.`);
    }
    await transition(issue, 'factory:review', approvedTaskById.get(taskId));
    return;
  }

  if (eventName === 'pull_request') {
    if (event.action !== 'closed' || !event.pull_request?.merged) {
      console.log('No factory pull-request transition to reconcile.');
      return;
    }
    const allLinkedIssues = await closingIssuesForPullRequest(client, event.pull_request.number);
    const linkedIssues = allLinkedIssues.filter((issue) => stableIdForIssue(issue));
    if (linkedIssues.length === 0) {
      console.log('Merged PR is not an F0-F15 worker PR; no factory state transition required.');
      return;
    }
    if (linkedIssues.length !== 1 || allLinkedIssues.length !== 1) {
      throw new Error(`Merged factory PR must close exactly one F0-F15 issue; found ${allLinkedIssues.length}.`);
    }
    const issue = linkedIssues[0];
    const taskId = stableIdForIssue(issue);
    const taskApproval = approvedTaskById.get(taskId);
    if (!issueMatchesApproval(issue, taskApproval)) throw new Error(`Issue #${issue.number} no longer matches its approved work-order contract.`);
    if (stateLabel(issue) === 'factory:done') return;
    if (stateLabel(issue) !== 'factory:review') {
      throw new Error(`Merged issue #${issue.number} must be factory:review; found ${stateLabel(issue) ?? 'invalid state labels'}.`);
    }
    await verifyMergedCompletion(client, issue, taskId, taskApproval, event.pull_request, repository, defaultBranch, requiredChecksText);
    await transition(issue, 'factory:done', taskApproval);
  } else if (eventName !== 'workflow_dispatch') {
    console.log(`Unsupported event ${eventName}; no mutation performed.`);
    return;
  }

  let issues = await listFactoryIssues(client);

  // Repair a missed merge event only after reconstructing the same immutable proof.
  for (const taskApproval of approval.approvedTasks) {
    const issue = issues.find((candidate) => candidate.number === taskApproval.issue);
    if (issue?.state !== 'closed' || stateLabel(issue) !== 'factory:review' || !issueMatchesApproval(issue, taskApproval)) continue;
    const pullRequests = await pullRequestsClosingIssue(client, issue.number);
    if (pullRequests.length !== 1) throw new Error(`Issue #${issue.number} must have exactly one closing pull request; found ${pullRequests.length}.`);
    await verifyMergedCompletion(client, issue, taskApproval.id, taskApproval, pullRequests[0], repository, defaultBranch, requiredChecksText);
    await transition(issue, 'factory:done', taskApproval);
    if (!validateOnly) issues = await listFactoryIssues(client);
  }

  const verifiedDoneTasks = new Set();
  for (const taskApproval of approval.approvedTasks) {
    const issue = issues.find((candidate) => candidate.number === taskApproval.issue);
    if (issue?.state !== 'closed' || stateLabel(issue) !== 'factory:done' || !issueMatchesApproval(issue, taskApproval)) continue;
    const pullRequests = await pullRequestsClosingIssue(client, issue.number);
    if (pullRequests.length !== 1) throw new Error(`Completed issue #${issue.number} must have exactly one closing pull request; found ${pullRequests.length}.`);
    await verifyMergedCompletion(client, issue, taskApproval.id, taskApproval, pullRequests[0], repository, defaultBranch, requiredChecksText);
    verifiedDoneTasks.add(taskApproval.id);
  }

  const tasks = parseTaskGraph(taskGraphText);
  while (true) {
    issues = await listFactoryIssues(client);
    const selected = planReadyTransitions(tasks, issues, approval, verifiedDoneTasks);
    if (!selected.length) break;
    if (validateOnly) {
      for (const { task, issue } of selected) console.log(`[validate-only] Ready candidate ${task.id}: issue #${issue.number}`);
      break;
    }
    const { task, issue } = selected[0];
    await transition(issue, 'factory:ready', approvedTaskById.get(task.id));
  }
}

async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const eventName = process.env.GITHUB_EVENT_NAME;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!repository || !token || !eventName || !eventPath) throw new Error('GITHUB_REPOSITORY, GITHUB_TOKEN, GITHUB_EVENT_NAME, and GITHUB_EVENT_PATH are required.');

  await runController({
    event: JSON.parse(readFileSync(eventPath, 'utf8')),
    eventName,
    repository,
    token,
    taskGraphText: readFileSync('factory/task-graph.yml', 'utf8'),
    requiredChecksText: readFileSync('factory/required-checks.yml', 'utf8'),
    approval: JSON.parse(readFileSync('factory/approved-work-orders.json', 'utf8')),
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
