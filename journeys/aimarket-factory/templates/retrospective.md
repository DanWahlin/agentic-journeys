# AIMarket Factory retrospective: <run ID>

> Record observed evidence only. Do not invent missing metrics or include credentials, private endpoint/resource identifiers, or unsanitized responses.

## Run summary

- **Parent issue:** `#<number>`
- **Prerelease:** `<reference>`
- **Tested commit SHA:** `<SHA>`
- **Policy version:** `<version>`
- **Started/completed:** `<timestamps>`
- **Outcome:** `PASS | BLOCKED | CANCELLED`
- **Cleanup proof:** `<sanitized evidence hash/reference>`

## Goals and outcomes

| Goal | Expected | Observed evidence | Result |
|---|---|---|---|
| | | | |

## Flow and budget metrics

| Metric | Observed value | Evidence source |
|---|---:|---|
| Issue-to-draft-PR lead time | | |
| First-pass CI rate | | |
| Accepted PRs / attempted PRs | | |
| Human corrections per accepted PR | | |
| Review queue age / WIP violations | | |
| Actions minutes | | |
| Copilot premium requests | | |
| Azure cost estimate | | |
| Unauthorized/prohibited actions attempted / succeeded | | |
| Cleanup incidents / remaining resources | | |
| Reopened issues / post-merge regressions | | |

First-pass CI and human corrections are baseline observations, not invented pass thresholds.

## DAG and stack review

- Did every PR link exactly one approved issue?
- Did every sequence wait for declared dependencies and target the current default branch?
- Were the limits of two active implementation stacks, one open PR layer per stack, and four PRs in review respected?
- Did any stale head or duplicate dispatch occur, and did Issue-scoped concurrency plus live duplicate checks handle it safely?

## Product and live conformance

<Separate deterministic merge evidence from bounded live Search/Foundry conformance. Classify provider/quota/transient failures as BLOCKED rather than code PASS/FAIL.>

## Human judgment points

| Gate | Decision maker | Evidence considered | Correction or wait time |
|---|---|---|---|
| RFC/readiness | | | |
| PR workflows/merge | | | |
| Staging | | | |
| Cleanup/release | | | |

## Security, privacy, and cost findings

<Report permission boundaries, injection attempts, endpoint exposure, budgets, credential isolation, and any prohibited attempt.>

## Cleanup read-back

- [ ] Exact owned resource group absent.
- [ ] Mandatory ownership tags absent.
- [ ] Owned soft-deleted resources absent.
- [ ] Unrelated resources preserved.
- [ ] Read-only orphan detector could not delete.
- [ ] Scheduled orphan/status workflows disabled after completion when required.
- [ ] Sanitization preceded hashing and prerelease.

## Failed assumptions and incidents

| Assumption/incident | Detection evidence | Impact | Resolution | Reusable learning |
|---|---|---|---|---|
| | | | | |

## Keep, change, stop

### Keep

- <practice supported by evidence>

### Change

- <bounded contract/tooling improvement and owner>

### Stop

- <unsafe or ineffective practice>

## Follow-up decisions

Every implementation follow-up requires a new RFC/Issue and human readiness; this retrospective does not authorize code.

| Follow-up | Owner | Artifact | Priority |
|---|---|---|---|
| | | | |
