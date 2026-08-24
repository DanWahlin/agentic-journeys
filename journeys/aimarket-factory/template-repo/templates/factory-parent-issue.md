# Factory run: <goal>

> This parent issue indexes one approved AIMarket Factory run. Child Issues are the authoritative work orders. Creating this issue does not make any child `factory:ready`.

## Run contract

- **Run ID:** `AF-<YYYYMMDD>-<short-id>`
- **Approved RFC Discussion:** `<URL>`
- **Product contract version/SHA:** `<SHA>`
- **Factory policy version:** `<version>`
- **Target private repository:** `<owner/repository>`
- **Owner:** `<maintainer>`
- **Repository visibility verified private:** `YES | NO`
- **Start/expiry:** `<ISO timestamp>` / `<ISO timestamp, <= 4h live TTL>`

## Goals and non-goals

### Goals

- <measurable run outcome>

### Non-goals

- Production deployment.
- Automatic merge, approval, or branch-rule bypass.
- <additional exclusion>

## Capability decision

| Capability | Proof | Decision (`Proceed`, `Simulate`, `Blocked`) | Fallback/stop condition |
|---|---|---|---|
| Private Discussions | | | |
| Copilot cloud agent | | | |
| Sequential dependency completion + current-default-branch PRs | | | |
| Projects v2 credential isolation | | | |
| Mandatory staging reviewer | | | |
| Azure OIDC and RG-scoped identity | | | |

Native stacked-PR visualization isn't required. Dependency completion and current-default-branch targeting are required and are verified from repository evidence.

## Budget and TTL

| Budget | Requested | Policy ceiling | Preflight evidence |
|---|---:|---:|---|
| Azure estimate (USD) | | 20 | |
| Actions minutes | | 240 | |
| Copilot premium requests | | 40 | |
| Live TTL | | 4h | |

Crossing a ceiling stops new dispatch/provisioning and triggers cleanup if resources exist.

## Child work orders

| ID | Issue | Dependencies | Stack | State | PR | Checks/evidence |
|---|---|---|---|---|---|---|
| F0 | | Approved RFC | Contract | proposed | | |
| F1 | | F0 | Contract | proposed | | |
| F2 | | F1 | API | proposed | | |
| F3 | | F2 | API | proposed | | |
| F4 | | F3 | API | proposed | | |
| F5 | | F1 | Web | proposed | | |
| F6 | | F4, F5 | Web | proposed | | |
| F7 | | F4 | Search | proposed | | |
| F8 | | F6, F7 | Search | proposed | | |
| F9 | | F4 | Chat | proposed | | |
| F10 | | F6, F9 | Chat | proposed | | |
| F11 | | F8, F10 | Preflight | proposed | | |
| F12 | | F4, F6, F8, F10 | Infra | proposed | | |
| F13 | | F11, F12 | Infra | proposed | | |
| F14 | | F8, F10, F13 | Integration | proposed | | |
| F15 | | F14 + human approval | Release | proposed | | |

## Human approvals

- [ ] RFC approved.
- [ ] A maintainer approved the immutable plan and explicit gates; automatic F2-F13 readiness came only from the state controller after dependency and WIP proof.
- [ ] Copilot-authored PR workflows were explicitly approved when required.
- [ ] Every merge received final-head independent review and human approval.
- [ ] Protected staging was approved for the exact SHA.
- [ ] Cleanup/release approvals were recorded where required.

## Prohibited actions

- No production scope, automatic merge, self-approval, rules bypass, visibility change, broad cleanup, or agent credential access.
- No secrets/private identifiers in Issues, PRs, logs, screenshots, or public evidence.
- No mutation of unrelated repository or Azure artifacts.

## Evidence index

| Evidence | Producer run | Commit SHA | Sanitized hash | Read-back result |
|---|---|---|---|---|
| Deterministic suite | | | | |
| Staging conformance | | | | |
| Ownership inventories | | | | |
| Cleanup proof | | | | |
| Prerelease | | | | |
| Retrospective | | | | |

## Completion checklist

- [ ] All accepted child issues are terminal with exactly one state label.
- [ ] Required deterministic checks passed on each merged final SHA.
- [ ] Zero prohibited actions succeeded.
- [ ] Exact owned resource group/tags/soft-delete are absent and unrelated resources are preserved.
- [ ] Actual time, Actions, Copilot, Azure estimate, corrections, review wait, and incidents are recorded.
- [ ] Evidence read-back passed before prerelease.
