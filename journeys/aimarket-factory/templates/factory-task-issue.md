# <F0–F15>: <bounded outcome>

> Apply exactly one `factory:*` state label. After the parent plan is approved, the state controller may apply `factory:ready` to automatic work when dependencies and WIP allow; a maintainer applies it to gated work. This issue authorizes one branch, one worker session, and one draft PR only after readiness.

## Work-order metadata

- **Stable ID:** `<F0–F15>`
- **Parent issue:** `#<number>`
- **Approved RFC/decision:** `<URL or exact parent section>`
- **Dependencies:** `<F# issue links, or none>`
- **Stack:** `Contract | API | Web | Search | Chat | Preflight | Infra | Integration | Release`
- **Area label:** `area:<value>`
- **Risk label:** `risk:<low|medium|high|azure|security>`
- **Assigned specialist:** `<versioned agent name>`
- **Expected base branch/PR:** `<branch or preceding stack PR>`
- **Expected work branch:** `factory/<stable-id>-<slug>`

## Contract references

- **Product headings:** `<exact PRODUCT.md headings>`
- **Factory headings:** `<exact FACTORY.md headings>`
- **Plan headings:** `<exact PLAN.md headings>`
- **Machine contracts:** `<factory/*.yml or .json references>`

## Outcome and non-goals

### Required outcome

<One independently reviewable result.>

### Non-goals

- <Explicitly excluded adjacent work>

## Dependencies and readiness proof

| Dependency | Required conclusion/SHA | Live proof |
|---|---|---|
| `<F#>` | `factory:done` | `<link>` |

- [ ] Issue contract is complete.
- [ ] Dependencies are done.
- [ ] Applicable stack/review WIP is available.
- [ ] Budget and TTL remain within policy.
- [ ] Expected base/head is clear and no assignment, session, branch, or PR already exists for this Issue.
- [ ] The approved parent plan authorizes automatic readiness after dependencies, WIP, budget, and duplicate-state checks, or a maintainer explicitly authorized this gated work item.

## Owned paths

Only these narrow paths may change:

- `<exact/file-or/narrow-directory/**>`

Reserved paths (`.github/workflows/**`, `.github/agents/**`, `.github/skills/**`, `factory/**`, setup, staging, cleanup, and release code) require an explicitly approved factory-control issue. Repository-root or unrestricted `**` ownership is invalid.

## Acceptance commands

Run from the repository root in a secretless environment:

```text
<exact deterministic command>
```

| Required check ID | Expected result/artifact |
|---|---|
| `factory/<canonical-id>` | <PASS evidence tied to head SHA> |

LLM review cannot replace these commands.

## Expected artifacts

- <file, test, schema, report, or sanitized evidence>

## Security and untrusted input

<Identify issue/PR/diff/web input, prompt-injection handling, path enforcement, and secret boundaries.>

## Budget and TTL impact

- **Azure estimate delta:** `<USD or none>`
- **Actions estimate:** `<minutes>`
- **Copilot request estimate:** `<count>`
- **Live TTL impact:** `<duration or none>`
- **If ceiling is reached:** stop work; do not provision; trigger scoped cleanup if owned resources exist.

## Rollback and cleanup

<Describe artifact rollback. For Azure work, identify exact owned RG/lifecycle exceptions and absence checks. Never broaden deletion scope after failure.>

## Prohibited actions

- Do not merge, self-approve, mark the PR ready, bypass rules, deploy production, change visibility/settings, or access credentials.
- Do not modify paths outside Owned paths.
- Do not use `gh stack merge` or automatically rewrite worker branches.
- <work-specific prohibition>

## Worker handoff

- Open one draft PR linked only to this issue.
- Report changed paths, commands and real results, assumptions, blockers, and artifacts.
- Stop for ambiguity, stale state, dependency/WIP change, path conflict, missing capability, failed required check, or budget/TTL risk.
