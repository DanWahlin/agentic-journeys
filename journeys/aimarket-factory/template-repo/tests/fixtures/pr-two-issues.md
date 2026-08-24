Closes #12
Fixes #13
- Stable ID: F2
## Approved scope
- Owned paths: `src/api/models/**`
- Changed paths: `src/api/models/product.ts`
## Deterministic evidence
`node --test` PASS run 123
- Rollback: revert
- Budget / TTL impact: None
## Prohibited actions attestation
- [x] Draft and human-only merge/deploy.
