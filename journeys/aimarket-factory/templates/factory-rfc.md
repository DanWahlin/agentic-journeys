# RFC: <decision title>

> Status: Proposed. This RFC does not authorize implementation. Only a maintainer may approve it and create/approve the parent factory run.

## Metadata

- **RFC ID:** `RFC-<number>`
- **Author:** `<GitHub handle>`
- **Created:** `<YYYY-MM-DD>`
- **Decision owner:** `<maintainer role or handle>`
- **Target product:** AIMarket Factory
- **Related Discussion:** `<URL after creation>`
- **Decision deadline:** `<YYYY-MM-DD>`

## Problem and user outcome

<Describe the user problem, measurable outcome, and why the current contract is insufficient.>

## Proposed decision

<State one unambiguous decision. Name affected headings in `PRODUCT.md`, `FACTORY.md`, or `PLAN.md`.>

## Scope

### Included

- <bounded outcome>

### Not included

- Production deployment.
- Automatic merge or self-approval.
- <other exclusions>

## Contract diff

| Contract and heading | Current behavior | Proposed behavior | Classification (inherited/clarified/factory-only) | Test/evidence impact |
|---|---|---|---|---|
| `<file>#<heading>` | <current> | <proposed> | <classification> | <required proof> |

## Constraints and prohibited actions

- Preserve all inherited AIMarket behavior not listed in the diff.
- Do not expose credentials/private identifiers or target production.
- Do not create branches, PRs, deployments, releases, or repository mutations from this RFC.
- <additional prohibited action>

## Options considered

| Option | Benefits | Costs/risks | Why accepted or rejected |
|---|---|---|---|
| Proposed | | | |
| Alternative | | | |

## Security, privacy, and trust boundaries

<Identify untrusted input, credentials, permissions, public exposure, and human gates.>

## Budget, TTL, and cleanup impact

- **Estimated Azure ceiling:** `<USD; must not exceed policy>`
- **Actions minutes estimate:** `<minutes>`
- **Copilot premium-request estimate:** `<count>`
- **Maximum live TTL:** `<duration; must not exceed policy>`
- **Owned-resource boundary:** `<exact pattern, no real private identifier>`
- **Cleanup proof:** `<how exact absence and unrelated preservation are proven>`

## Proposed F0–F15 impact

| Work ID | Change needed | Dependency impact | Specialist/risk |
|---|---|---|---|
| `<F#>` | | | |

## Acceptance evidence

- [ ] Deterministic acceptance commands are identified.
- [ ] Live conformance, if any, is separated from merge gates.
- [ ] Rollback and cleanup evidence are defined.
- [ ] No unresolved contradiction remains.

## Rollback

<Explain how to revert the contract decision and artifacts without broad deletion.>

## Unresolved questions

- <Question, owner, and deadline>

## Maintainer decision

- **Decision:** `APPROVED | REJECTED | NEEDS CLARIFICATION`
- **Decision by:** `<maintainer>`
- **Date:** `<YYYY-MM-DD>`
- **Rationale:** <text>
- **Approved contract headings:** <exact list>
