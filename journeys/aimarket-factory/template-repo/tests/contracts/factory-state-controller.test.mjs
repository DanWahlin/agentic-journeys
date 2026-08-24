import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  hasIndependentFinalHeadReview,
  hasExactClosingIssue,
  hasExactRunPullRequestAssociation,
  historicalReviewRunIdFor,
  isCopilotActor,
  issueMatchesApproval,
  parseRequiredChecks,
  parseTaskGraph,
  parentIssueNumber,
  planReadyTransitions,
  replaceStateLabel,
  reviewRunIdFromComment,
  sha256,
  stableIdForIssue,
  stateLabel,
} from '../../scripts/factory-state-controller.mjs';

const graph = `tasks:
  - id: F1
    dependsOn: [F0]
    stack: Contract
    automaticDispatch: false
  - id: F2
    dependsOn: [F1]
    stack: API
    automaticDispatch: true
  - id: F3
    dependsOn: [F2]
    stack: API
    automaticDispatch: true
  - id: F5
    dependsOn: [F1]
    stack: Web
    automaticDispatch: true
  - id: F7
    dependsOn: [F1]
    stack: Search
    automaticDispatch: true
  - id: F14
    dependsOn: [F7]
    stack: Integration
    automaticDispatch: false
    gatedWorkItem: true
`;

function issue(taskId, state, options = {}) {
  return {
    number: Number(taskId.slice(1)) + 100,
    title: `[${taskId}] Test work order`,
    body: `# Stable ID\n${taskId}\n# Parent issue\n#4\n`,
    state: options.open === false ? 'closed' : 'open',
    labels: [{ name: state }, { name: 'factory:owned' }],
  };
}

function parentIssue() {
  return {
    number: 4,
    title: '[AF-test] Approved test plan',
    body: '# Approved test plan\n',
    state: 'open',
    labels: [{ name: 'factory:planned' }, { name: 'factory:owned' }],
  };
}

function approvalFor(issues) {
  const parent = issues.find((candidate) => candidate.number === 4);
  return {
    version: 1,
    repository: 'owner/repo',
    parent: { issue: parent.number, title: parent.title, bodySha256: sha256(parent.body) },
    approvedTasks: issues
      .filter((candidate) => stableIdForIssue(candidate))
      .map((candidate) => ({
        id: stableIdForIssue(candidate),
        issue: candidate.number,
        title: candidate.title,
        bodySha256: sha256(candidate.body),
      })),
  };
}

function plan(tasks, taskIssues, verifiedDoneTasks = new Set(), limits) {
  const issues = [parentIssue(), ...taskIssues];
  return planReadyTransitions(tasks, issues, approvalFor(issues), verifiedDoneTasks, limits);
}

describe('factory state controller contracts', () => {
  it('parses automatic, gated, and control-approval policy from the canonical graph', () => {
    const tasks = parseTaskGraph(graph);
    assert.deepEqual(tasks.find((task) => task.id === 'F2'), {
      id: 'F2',
      dependsOn: ['F1'],
      stack: 'API',
      automaticDispatch: true,
      gatedWorkItem: false,
      requiresControlApproval: false,
    });
    assert.equal(tasks.find((task) => task.id === 'F14').gatedWorkItem, true);
  });

  it('requires matching stable IDs and an explicit parent reference', () => {
    assert.equal(stableIdForIssue(issue('F2', 'factory:planned')), 'F2');
    assert.equal(stableIdForIssue({ ...issue('F2', 'factory:planned'), body: '# Stable ID\nF3\n' }), undefined);
    assert.equal(parentIssueNumber(issue('F2', 'factory:planned')), 4);
    assert.equal(parentIssueNumber({ ...issue('F2', 'factory:planned'), body: '# Stable ID\nF2\n' }), undefined);
  });

  it('uses an explicit state allowlist and preserves classification labels', () => {
    assert.equal(stateLabel({ labels: [{ name: 'factory:owned' }] }), undefined);
    assert.equal(stateLabel({ labels: [{ name: 'factory:planned' }, { name: 'factory:ready' }] }), undefined);
    assert.equal(stateLabel(issue('F2', 'factory:planned')), 'factory:planned');
    assert.deepEqual(replaceStateLabel(issue('F2', 'factory:planned'), 'factory:ready'), ['factory:owned', 'factory:ready']);
  });

  it('binds work orders to immutable title and body hashes', () => {
    const candidate = issue('F2', 'factory:planned');
    const record = { issue: candidate.number, title: candidate.title, bodySha256: sha256(candidate.body) };
    assert.equal(issueMatchesApproval(candidate, record), true);
    assert.equal(issueMatchesApproval({ ...candidate, body: `${candidate.body}\nchanged` }, record), false);
    assert.equal(issueMatchesApproval({ ...candidate, title: `${candidate.title} changed` }, record), false);
  });

  it('promotes dependency-ready approved work across at most two implementation stacks', () => {
    const tasks = parseTaskGraph(graph);
    const issues = [
      issue('F1', 'factory:done', { open: false }),
      issue('F2', 'factory:planned'),
      issue('F3', 'factory:planned'),
      issue('F5', 'factory:planned'),
      issue('F7', 'factory:planned'),
      issue('F14', 'factory:planned'),
    ];
    assert.deepEqual(plan(tasks, issues, new Set(['F1'])).map(({ task }) => task.id), ['F2', 'F5']);
  });

  it('does not infer completion from a done label without verified merge evidence', () => {
    const tasks = parseTaskGraph(graph);
    const issues = [issue('F1', 'factory:done', { open: false }), issue('F2', 'factory:planned')];
    assert.deepEqual(plan(tasks, issues, new Set()), []);
  });

  it('does not promote dependent, gated, unowned, or post-approval edited work', () => {
    const tasks = parseTaskGraph(graph);
    const f2 = issue('F2', 'factory:planned');
    const f3 = issue('F3', 'factory:planned');
    const f5 = issue('F5', 'factory:planned');
    f5.labels = [{ name: 'factory:planned' }];
    const f14 = issue('F14', 'factory:planned');
    const all = [parentIssue(), issue('F1', 'factory:done', { open: false }), f2, f3, f5, f14];
    const approval = approvalFor(all);
    f2.body += '\npost-approval edit';
    assert.deepEqual(planReadyTransitions(tasks, all, approval, new Set(['F1'])), []);
  });

  it('respects active-stack and review-buffer capacity', () => {
    const tasks = parseTaskGraph(graph);
    const issues = [
      issue('F1', 'factory:done', { open: false }),
      issue('F2', 'factory:review'),
      issue('F5', 'factory:running'),
      issue('F7', 'factory:planned'),
    ];
    assert.deepEqual(plan(tasks, issues, new Set(['F1'])), []);
    const reviewIssues = [issue('F1', 'factory:done', { open: false }), issue('F2', 'factory:planned')];
    for (let index = 0; index < 4; index += 1) {
      reviewIssues.push({
        number: 500 + index,
        title: `Review ${index}`,
        body: '',
        state: 'open',
        labels: [{ name: 'factory:review' }],
      });
    }
    assert.deepEqual(plan(tasks, reviewIssues, new Set(['F1'])), []);
  });

  it('rejects a missing approved parent and duplicate stable IDs', () => {
    const tasks = parseTaskGraph(graph);
    const f2 = issue('F2', 'factory:planned');
    const issues = [parentIssue(), issue('F1', 'factory:done', { open: false }), f2];
    const approval = approvalFor(issues);
    const withoutParent = issues.filter((candidate) => candidate.number !== 4);
    assert.deepEqual(planReadyTransitions(tasks, withoutParent, approval, new Set(['F1'])), []);
    assert.throws(
      () => planReadyTransitions(tasks, [...issues, { ...f2, number: 999 }], approval, new Set(['F1'])),
      /Stable ID F2 appears on 2 issues/,
    );
  });

  it('fails closed on duplicate stable IDs before WIP accounting', () => {
    const tasks = parseTaskGraph(graph);
    const activeF2 = issue('F2', 'factory:running');
    const duplicateF2 = { ...issue('F2', 'factory:planned'), number: 999, labels: [{ name: 'factory:planned' }] };
    const f5 = issue('F5', 'factory:planned');
    const f7 = issue('F7', 'factory:planned');
    const issues = [parentIssue(), issue('F1', 'factory:done', { open: false }), activeF2, duplicateF2, f5, f7];
    const approval = approvalFor(issues.filter((candidate) => candidate.number !== 999));
    assert.throws(() => planReadyTransitions(tasks, issues, approval, new Set(['F1'])), /refusing incomplete WIP accounting/);
  });

  it('requires the explicit control approval label for automatic reserved-path work', () => {
    const tasks = [
      {
        id: 'F12',
        dependsOn: ['F1'],
        stack: 'Infra',
        automaticDispatch: true,
        gatedWorkItem: false,
        requiresControlApproval: true,
      },
    ];
    const f12 = issue('F12', 'factory:planned');
    const issues = [issue('F1', 'factory:done', { open: false }), f12];
    assert.deepEqual(plan(tasks, issues, new Set(['F1'])), []);
    f12.labels.push({ name: 'factory-control:approved' });
    assert.deepEqual(plan(tasks, issues, new Set(['F1'])).map(({ task }) => task.id), ['F12']);
  });

  it('binds independent review comments to an exact final head and run ID', () => {
    const comment = {
      user: { login: 'github-actions[bot]' },
      body: '### Independent review evidence\n**Head verified:** `abc123`\nno blocking findings identified\n> Generated by review for #30 · https://github.com/owner/repo/actions/runs/32699727204\n<!-- workflow_id: aimarket-factory-review -->',
    };
    assert.equal(hasIndependentFinalHeadReview([comment], 'abc123', 30, 'owner/repo'), true);
    assert.equal(reviewRunIdFromComment(comment, 'abc123', 30, 'owner/repo'), '32699727204');
    assert.equal(reviewRunIdFromComment(comment, 'abc123', 31, 'owner/repo'), undefined);
    assert.equal(reviewRunIdFromComment(comment, 'abc123', 30, 'other/repo'), undefined);
    assert.equal(reviewRunIdFromComment(comment, 'def456', 30, 'owner/repo'), undefined);
  });

  it('requires the merged pull request to close only the expected work order', () => {
    assert.equal(hasExactClosingIssue([{ number: 7 }], 7), true);
    assert.equal(hasExactClosingIssue([{ number: 7 }], 8), false);
    assert.equal(hasExactClosingIssue([{ number: 7 }, { number: 8 }], 7), false);
    assert.equal(hasExactClosingIssue([], 7), false);
  });

  it('binds historical review exceptions to repository, pull request, head, and run', () => {
    const approval = {
      reviewRepository: 'owner/repo',
      reviewPullRequest: 30,
      reviewHeadSha: 'abc123',
      reviewRunId: '32699727204',
    };
    assert.equal(historicalReviewRunIdFor(approval, 'owner/repo', 30, 'abc123'), '32699727204');
    assert.equal(historicalReviewRunIdFor(approval, 'other/repo', 30, 'abc123'), undefined);
    assert.equal(historicalReviewRunIdFor(approval, 'owner/repo', 31, 'abc123'), undefined);
    assert.equal(historicalReviewRunIdFor(approval, 'owner/repo', 30, 'def456'), undefined);
    assert.equal(hasExactRunPullRequestAssociation(undefined, 30, true), false);
    assert.equal(hasExactRunPullRequestAssociation([], 30), false);
    assert.equal(hasExactRunPullRequestAssociation([], 30, true), true);
    assert.equal(hasExactRunPullRequestAssociation([{ number: 30 }], 30), true);
    assert.equal(hasExactRunPullRequestAssociation([{ number: 31 }], 30), false);
    assert.equal(hasExactRunPullRequestAssociation([{ number: 30 }, { number: 31 }], 30), false);
  });

  it('accepts only the GitHub Copilot cloud-agent identities as workers', () => {
    assert.equal(isCopilotActor('Copilot'), true);
    assert.equal(isCopilotActor('copilot-swe-agent'), true);
    assert.equal(isCopilotActor('github-actions[bot]'), false);
    assert.equal(isCopilotActor('maintainer'), false);
  });

  it('selects only merge-gating checks that apply to the task', () => {
    const checks = `checks:
  - id: factory/policy
    required: true
    appliesTo: [F1, F2]
  - id: infra/preview
    required: true
    appliesTo: [F13]
  - id: factory/live
    required: true
    appliesTo: [F2]
    mergeGate: false
`;
    assert.deepEqual(parseRequiredChecks(checks, 'F2'), ['factory/policy']);
  });

  it('keeps scheduled Azure cleanup inert until Azure automation and identities are configured', () => {
    const workflow = readFileSync(new URL('../../.github/workflows/aimarket-factory-cleanup.yml', import.meta.url), 'utf8');
    for (const guard of [
      "vars.AIMARKET_FACTORY_AZURE_ENABLED == 'true'",
      "vars.AZURE_READONLY_CLIENT_ID != ''",
      "vars.AZURE_TENANT_ID != ''",
      "vars.AZURE_SUBSCRIPTION_ID != ''",
    ]) {
      assert.match(workflow, new RegExp(guard.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  });
});
