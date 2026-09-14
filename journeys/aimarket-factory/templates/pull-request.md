# <F0–F15>: <outcome>

## Factory traceability

- **Closes exactly one factory issue:** `Closes #<number>`
- **Stable ID:** `<F0–F15>`
- **Parent issue:** `#<number>`
- **Stack / layer:** `<Stack>` / `<bottom-to-top position>`
- **Expected base:** `<branch or PR>`
- **Head SHA reviewed:** `<SHA>`
- **Specialist:** `<agent name>`
- **State:** draft; only a maintainer may mark ready or merge

## Contract references

- **Product headings:** <exact headings>
- **Factory headings:** <exact headings>
- **Plan headings:** <exact headings>

## Outcome

<What changed and how it satisfies only the linked issue.>

## Changed-path contract

**Issue-owned paths:**

- `<path>`

**Actual changed paths:**

- `<path>`

- [ ] No unapproved reserved or out-of-scope path changed.
- [ ] This branch belongs to no other issue or stack.

## Stack proof

- [ ] Every declared dependency is merged as `factory:done`.
- [ ] Base matches the current default branch.
- [ ] Independent Issues are not combined into this work sequence.
- [ ] No automated sync/rebase or `gh stack merge` was used.

## Deterministic evidence

| Canonical required check ID | Command/workflow | Result | Artifact/producer run |
|---|---|---|---|
| `factory/<id>` | `<command>` | `PASS | FAIL | BLOCKED` | `<reference>` |

Paste no secret values or fabricated output. A head change invalidates these results and independent review.

## Security, cost, and policy

- **Untrusted input handled:** <issue/PR/diff/web inputs>
- **Credential access:** `none` for agent/PR code
- **Azure cost/TTL delta:** <actual estimate or none>
- **Actions/Copilot usage:** <actual or current estimate>
- **Public endpoint impact:** <none or bounded staging only>
- [ ] No production scope, visibility/settings change, rule bypass, self-approval, merge, release, or credential exposure.
- [ ] Agent/workflow instructions and diffs were treated as untrusted.

## Product verification

<Identify inherited behavior retained and factory-only controls added. Include exact commands and real results.>

## Rollback and cleanup

<How to revert this PR. For resource-related changes, identify exact ownership/absence proof without private identifiers.>

## Reviewer handoff

Review the linked issue, frozen contracts, this final-head diff, required checks, correctness, security, reliability, cost, and prohibited actions. Do not rely on implementer reasoning.

- [ ] Independent reviewer is not the implementer.
- [ ] Review and required checks bind to the final head SHA.
- [ ] Conversations are resolved.
- [ ] Maintainer performed the merge decision.
