# AIMarket Factory Operating Contract

This document defines the human-governed control plane that delivers the product in [`PRODUCT.md`](./PRODUCT.md). GitHub Issues are authoritative work orders. Project views summarize live state but do not replace Issues, checks, or approvals.

## Repository artifact mapping

| Artifact | Responsibility |
|---|---|
| Discussion | Approved RFC and unresolved product/architecture decisions |
| Parent issue | One factory run: scope, budget, TTL, children, and evidence index |
| Child issue | One bounded F0–F15 work order with dependencies, owned paths, acceptance commands, risk, rollback, and prohibited actions |
| Labels | Exactly one state plus area, risk, and ownership classification |
| Project v2 | Dependency, specialist, state, risk, PR, checks, deployment, and evidence projection |
| Agent/skill files | Versioned role and repository knowledge |
| Branch/worktree | Isolation for exactly one child issue |
| Stack | A linear sequence of dependent PRs in one workstream |
| Draft PR | Proposed output linked to exactly one factory issue |
| Required check | Deterministic fact about a versioned contract |
| Protected environment | Human approval and credential boundary for staging/cleanup/release |
| Deployment | Temporary artifact for one approved SHA |
| Prerelease | Evidence bundle produced only after cleanup proof |
| Retrospective Discussion | Metrics, failed assumptions, incidents, and reusable improvements |

## Roles and authority

| Role | May | Must not |
|---|---|---|
| Maintainer | Approve the parent plan and bounded work orders, authorize gated work, mark PR ready, approve workflows/environments, merge, approve cleanup and prerelease | Bypass required checks or accept unverifiable evidence |
| Coordinator | Validate issues/DAG/WIP, enter Issue-scoped workflow concurrency, recheck duplicate state, route one ready issue, report state, and inspect sequences | Edit product code, merge, deploy, approve, rewrite worker branches, or access credentials |
| Specialist worker | Implement one issue on one branch within declared owned paths and open one draft PR | Change reserved factory paths unless its approved control issue owns them; merge, deploy, release, administer the repository, or read credentials |
| Independent reviewer | Review the linked issue, frozen plan, final-head diff, checks, security, cost, and scope | Approve its own implementation or rely on implementer reasoning |
| Deterministic workflow | Build/test/validate, enforce path and contract policy, emit versioned evidence | Treat an LLM opinion as PASS or execute untrusted PR code with privileged credentials |
| Staging/cleanup/release job | Operate only on an approved default-branch SHA through its protected environment | Run from PR/agent branches, broaden scope after failure, or target production |

Specialist and path instructions are advisory unless a platform capability proves enforcement. Reserved-path checks, branch protection, required checks, independent review, and human approval are hard boundaries.

## State labels and invariants

Allowed states are `factory:proposed`, `factory:needs-clarification`, `factory:planned`, `factory:ready`, `factory:running`, `factory:review`, `factory:blocked`, `factory:done`, and `factory:cancelled`.

Every factory child issue has **exactly one** allowed factory state label. Every mutating workflow re-reads repository identity, issue state, actor authority, dependency conclusions, expected base/head, WIP, and duplicate assignment/session/branch/PR state immediately before requesting a guarded safe output. If state changed, it performs no mutation and records a stale/duplicate result.

### Transition table

This table is machine-testable. `* active` means proposed, needs-clarification, planned, ready, running, review, or blocked.

| from | to | authorized actor | trigger | required evidence | failure result |
|---|---|---|---|---|---|
| none | factory:proposed | intake workflow or maintainer | valid issue created | issue contract and parent reference | no state mutation; request correction |
| factory:proposed | factory:needs-clarification | intake workflow or maintainer | ambiguity found | comment naming missing fields/questions | remain proposed on unsafe/stale output |
| factory:needs-clarification | factory:planned | maintainer | clarification accepted | complete issue contract and approved RFC/parent | remain needs-clarification |
| factory:proposed | factory:planned | maintainer | plan accepted without clarification | complete issue contract and approved RFC/parent | remain proposed |
| factory:planned | factory:ready | state controller, or maintainer for gated work | approved plan plus dependency/WIP reconciliation, or explicit gate | dependencies done; issue contract valid; budget/TTL fit; WIP available | remain planned |
| factory:blocked | factory:ready | maintainer only | blocker corrected before dispatch | blocker resolution plus fresh dependency/budget proof | remain blocked |
| factory:ready | factory:running | dispatcher via guarded output | entered Issue-scoped workflow concurrency and one session created | approved-plan or explicit gated readiness; dependencies done; WIP available; expected base/head; no existing assignment/session/branch/PR | remain ready with no assignment |
| factory:blocked | factory:running | dispatcher via guarded output | retry of previously started work | maintainer reauthorization; blocker resolved; dependencies/WIP fresh; no existing assignment/session/branch/PR | remain blocked |
| factory:running | factory:review | deterministic state controller | same-repository Copilot draft PR opened | exactly one linked issue; approved Copilot worker identity; draft status; current running state | remain running and report the mismatch |
| factory:review | factory:blocked | status workflow or maintainer | failed check, stale head/base, scope breach, or requested changes | failing check/review evidence tied to head SHA | remain review if evidence is stale |
| factory:review | factory:done | state controller projecting a maintainer action | verified human merge after final review | exactly one linked issue; required checks pass; independent no-blocker review matches final head SHA; merger has write permission | remain review |
| factory:running | factory:blocked | status workflow or maintainer | worker/session failure or factual external blocker | sanitized failure evidence and recovery owner | remain running if event is stale |
| factory:ready | factory:blocked | status workflow or maintainer | dependency, budget, capability, or WIP becomes unavailable | fresh live-state proof | remain ready if proof is stale |
| factory:proposed | factory:cancelled | maintainer only | cancellation | reason and affected artifacts | remain proposed |
| factory:needs-clarification | factory:cancelled | maintainer only | cancellation | reason and affected artifacts | remain needs-clarification |
| factory:planned | factory:cancelled | maintainer only | cancellation | reason and affected artifacts | remain planned |
| factory:ready | factory:cancelled | maintainer only | cancellation | reason; no assignment/session/branch/PR exists | remain ready |
| factory:running | factory:cancelled | maintainer only | cancellation | reason; session stopped; branch/PR disposition | remain running and escalate if stop unverified |
| factory:review | factory:cancelled | maintainer only | cancellation | reason; PR closed/not merged | remain review |
| factory:blocked | factory:cancelled | maintainer only | cancellation | reason; incident/cleanup disposition | remain blocked |
| any current state | same current state | workflow | duplicate or stale event | idempotency key and unchanged live state | successful no-op with audit record |

`factory:done` and `factory:cancelled` are terminal. Reopening work requires a new issue; labels are not rolled back from terminal state.

## Dependency DAG and stack policy

[`factory/task-graph.yml`](./factory/task-graph.yml) is canonical for F0-F15. A child may run only after every dependency is `factory:done`. F11 may end `BLOCKED` without provisioning; F13 cannot start until F11 succeeds.

The maintainer approves the parent plan and bounded F0–F15 work orders once by merging the control change that contains [`factory/approved-work-orders.json`](./factory/approved-work-orders.json). That record binds the repository, parent Issue, child Issue numbers, titles, and body hashes. An edited work order stops automatic advancement until another reviewed control change updates the record. After approval, the deterministic state controller may promote `automaticDispatch: true` work from `factory:planned` to `factory:ready` only when the immutable binding, verified merged dependencies, issue ownership, state labels, and current review/stack capacity pass. Automatic reserved-path work such as F12 and F13 must also retain `factory-control:approved`. F14 and F15 have `automaticDispatch: false` and remain explicit human gates. The controller never approves or merges a pull request.

Logical work sequences are Contract (`F0 -> F1`), API (`F2 -> F3 -> F4`), Web (`F5 -> F6`), Search (`F7 -> F8`), Chat (`F9 -> F10`), and Infra (`F12 -> F13`). This validated lab uses sequential pull requests inside each sequence: a dependency merges to `main` before its child dispatches, so worker pull requests target `main` rather than an open predecessor branch. F11 is a read-only preflight gate, not an implementation stack. F11 and F12 may proceed independently after their prerequisites pass, but F13 waits for both. F14 and F15 are gated work items.

- One branch and draft PR belong to one issue and one stack only.
- A logical sequence contains only direct dependencies in order. Independent work uses separate sequences after shared prerequisites merge.
- Every worker pull request targets the current default branch. This lab doesn't claim an open stacked-PR chain.
- Only a human may invoke stack sync/rebase diagnostics. Automation may report stale topology but must not rewrite worker branches.
- `gh stack merge`, automatic merge, self-approval, and branch-rule bypass are prohibited.
- A changed head SHA invalidates prior checks and review.

### WIP and dispatch serialization

At most two implementation stacks are active, one pull request layer is open per stack, and four PRs carry `factory:review` repository-wide. The state controller checks stack and review-buffer capacity before proposing readiness. The dispatcher remains responsible for fresh budget, duplicate assignment/session/branch/PR, and final dispatch checks.

F2 owns the API package manifest, lock file, and TypeScript configuration and establishes the complete approved API dependency baseline through F10. F5 does the same for the Web package and bounded Vite/Tailwind configuration. Later parallel work cannot edit those shared manifests. A missing dependency is a contract amendment, not permission for a worker to broaden its paths.

The compiled dispatcher uses issue-scoped GitHub Actions concurrency so duplicate events for the same Issue are serialized. Every queued run must re-read the live state and refuse dispatch when a session, assignment, branch, or PR already exists. The current artifacts don't create a separate application-level check-run or Project-field mutex, and documentation must not claim one. A duplicate event is a no-op after the live recheck. A partial dispatch becomes `factory:blocked` and records artifacts for manual reconciliation.

## Human gates

Only a maintainer can:

1. Approve an RFC or parent run.
2. Approve the bounded work-order plan and explicitly authorize F14, F15, blocked retries, and control-plane changes.
3. Approve and run Actions on a Copilot-authored PR when GitHub requires it.
4. Mark a draft PR ready and merge after final-head checks and independent review.
5. Approve the staging, bootstrap, cleanup, or release environment.
6. Approve creation of Azure federated credentials, exceptional cleanup, or prerelease publication.

Unsupported private Discussions, mandatory staging reviewers, or other mandatory-live capabilities make the live track `BLOCKED`; simulation must label the deviation and cannot claim a live pass.

## Credential and execution boundaries

[`factory/credential-matrix.md`](./factory/credential-matrix.md) is authoritative. Agent and PR jobs receive read-only GitHub access, no Azure credentials, no reusable GitHub write token, no Projects credential, and no environment secrets. Agentic writes use validated safe outputs or a separate job that revalidates immutable inputs.

PR code runs only in secretless, read-only `pull_request` jobs. Never use `pull_request_target` to check out or execute an agent-authored head. Privileged post-check jobs consume only `factory-post-check-result-v1` and revalidate repository, PR, base, head SHA, actor, producer run, policy version, and successful conclusions against live state.

Azure staging uses OIDC and managed identities. A read-only preflight identity cannot provision. A separately protected bootstrap identity can create/delete only the validated run resource group and conditionally delegate the approved RG-scoped deployment role. The deployment identity cannot operate outside that group. No client secret, subscription-wide Contributor/Owner fallback, Foundry key, or ACR admin credential is permitted.

## Budgets, Azure policy, and failure handling

Policy ceilings are maximum live TTL 4 hours, estimated Azure cost USD 20 per run, Actions 240 minutes per run, Copilot 40 premium requests per run, and staging concurrency one. Preflight may lower but not raise them without a reviewed policy change and explicit human approval. Crossing a ceiling stops dispatch/provisioning and starts cleanup when resources exist.

F11 checks allowed subscription, region, Basic Search availability, Foundry model/version/quota, identity conditions, staging-reviewer support, budget, and blocked outcome before F13. Production scopes are forbidden. Public endpoints are temporary and restricted where supported because the inherited app has no authentication or rate limiting.

External capability or provider failures are factual `BLOCKED` outcomes. Validation failure is not converted to PASS. Unsafe, unauthorized, malformed, stale, duplicate, or prompt-injected output causes no mutation and leaves an audit result. Cleanup failure remains a hard failure and opens a cleanup incident.

## Evidence and cleanup contract

Every result binds to repository, run ID, issue/PR where applicable, commit SHA, policy version, producer run ID, timestamps, check name/conclusion, and sanitized artifact hashes. Evidence distinguishes deterministic checks, human judgments, and live service conformance. Sanitization occurs before hashing; credentials are forbidden everywhere. Ephemeral FQDNs/resource IDs may exist only in private ownership proof and are removed from curriculum/public artifacts.

One dedicated, uniquely named resource group contains every mutable run resource unless a predeclared lifecycle exception has an ownership key and verifier. Required tags are run ID, owner, repository, and expiry/TTL. Capture ownership inventories before and after provision.

Cleanup is part of success:

1. An `always()` measured finalizer inventories the exact owned resource group, predeclares each Cognitive Services account by name/location/group, and rejects every other soft-delete resource type.
2. Cleanup deletes only that group, uses a dedicated narrow purge identity for those exact declared accounts, and verifies resource-group absence, soft-delete absence, required-tag bindings, and unrelated-resource preservation.
3. A scheduled read-only orphan detector may open an incident for expired mandatory tags but cannot delete.
4. Staging uploads an immutable cleanup checkpoint before deployment. If the run is cancelled or fails, a default-branch `workflow_run` recovery opens one blocked incident from that checkpoint; protected cleanup still requires human approval.
5. Protected cleanup never enumerates and deletes all azd environments or broadens scope after failure.
6. Prerelease creation requires sanitized evidence read-back, matching workflow-run branch/SHA, and successful cleanup proof. Cleanup failure blocks release.

The prerelease and retrospective report duration, first-pass CI, accepted/attempted PRs, human corrections, review wait, Actions minutes, Copilot requests, Azure estimate, prohibited attempts, and cleanup incidents. No metric may be invented.
