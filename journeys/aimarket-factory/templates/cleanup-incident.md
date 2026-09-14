# Cleanup incident: <run ID>: <symptom>

> This issue authorizes investigation only. Deletion requires the protected cleanup workflow and human approval. Never broaden scope after a failed deletion.

## Incident metadata

- **Run ID:** `<factory run ID>`
- **Parent issue:** `#<number>`
- **Detected by:** `finalizer | verifier | read-only orphan detector | human`
- **Detected at:** `<ISO timestamp>`
- **Owner:** `<maintainer>`
- **Factory policy version:** `<version>`
- **Approved commit SHA:** `<SHA>`
- **Current state:** `factory:blocked`
- **Risk:** `risk:azure` and/or `risk:security`

## Sanitized symptom

<Describe the failed absence check without credentials or public/private identifiers. Exact private resource IDs remain only in protected ownership evidence.>

## Declared ownership boundary

- **Expected resource-group naming pattern:** `<validated pattern>`
- **Mandatory ownership keys:** `factory-run-id`, `factory-owner`, `factory-repository`, `factory-expires-at`
- **Private ownership manifest:** `<protected evidence reference and hash>`
- **Predeclared lifecycle exceptions:** `<none or exact private evidence references>`

## Failed verification

| Check | Expected | Actual sanitized result | Producer run/evidence hash |
|---|---|---|---|
| Resource group absent | true | | |
| Owned tags absent | true | | |
| Owned soft-delete absent | true | | |
| Unrelated resources preserved | true | | |

## Impact

- **Prerelease:** BLOCKED
- **New dispatch/provisioning:** STOPPED if a budget/TTL ceiling is crossed
- **Public exposure:** `<closed, bounded, or unknown>`
- **Cost/TTL estimate:** `<actual/remaining>`

## Investigation commands

Read-only first, with placeholders only:

```text
<exact read-only command>
```

## Proposed protected cleanup

- **Exact owned targets:** `<references to protected manifest; no broad query>`
- **Credential context:** `aimarket-factory-cleanup`
- **Human reviewer:** `<required role>`
- **Deletion command/workflow input:** `<exact scoped action using placeholders>`
- **Unrelated-resource preservation check:** `<command>`
- **Soft-delete check/purge:** `<only predeclared owned exception>`

## Prohibited actions

- No tag-only broad deletion, subscription-wide cleanup, `azd env list` deletion loop, production target, or unreviewed manual mutation.
- No adoption/deletion of unknown resources.
- No credential or private identifier in this issue or public evidence.
- The read-only orphan detector must not delete.

## Resolution evidence

- [ ] Human approved protected cleanup.
- [ ] Exact target read back before mutation.
- [ ] Cleanup workflow completed.
- [ ] Resource group, tags, and owned soft-delete are absent.
- [ ] Unrelated resources are preserved.
- [ ] Sanitized evidence was hashed and read back.
- [ ] Parent/release gate was updated; no prerelease preceded this proof.
