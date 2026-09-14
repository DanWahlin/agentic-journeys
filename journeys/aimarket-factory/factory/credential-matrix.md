# AIMarket Factory Credential Matrix

Credentials are named capabilities, not values. Never put token values, client secrets, connection strings, cookies, authorization headers, private endpoint identifiers, or private resource identifiers in repository files, Issues, PRs, logs, screenshots, or public evidence.

| Context | GitHub capability | Projects v2 | Azure capability | Secrets/environment | Permitted writes | Explicitly forbidden |
|---|---|---|---|---|---|---|
| Intake agent reasoning | Read relevant issue/discussion and contracts | None | None | None | None directly; validated comment/label proposals through guarded safe outputs | Code/branch/session creation, `factory:ready`, admin, merge, deploy |
| Dispatcher agent reasoning | Read issue, labels, dependencies, WIP, stack, and lock | Read projection only when proven | None | None | None directly; one validated session/state proposal through guarded safe output | Reusable write token, Projects token, Azure, merge, environment/repository admin |
| Copilot coding session | Platform-enforced access to exact private target repository | None | None | No repository/environment secrets | One issue branch and one draft PR within platform envelope | Merge, release, deploy, visibility/rules/settings, Actions/environment/secret administration |
| PR deterministic checks | Read-only `GITHUB_TOKEN`; `pull_request` context | None | None | None; no protected environment | Check artifacts/results only | `pull_request_target` head execution, privileged checkout, comments/labels with untrusted token, deployment |
| Independent review reasoning | Read issue, frozen plans, PR final-head diff, checks | Read-only summary | None | None | Guarded review comment/status proposal only | Self-approval, merge, code mutation, secrets |
| Privileged post-check writer | Narrow GitHub App or job token after live binding validation | Separately scoped credential only if needed | None | No PR-accessible secrets; never checks out head | Validated comment/label/Project update from `factory-post-check-result-v1` | Execute untrusted code, accept stale repository/PR/base/head/actor/run |
| Project updater | Minimum Projects v2 credential rung selected below | Exact project/item fields only | None | Protected non-agent context | Idempotent Project item/field updates after live validation | Repository contents/admin scopes or agent exposure |
| Subscription preflight | Metadata read only | None | OIDC identity with read-only quota/policy/model/resource discovery | Protected preflight environment | Evidence only | Provisioning, role assignment, deletion |
| RG bootstrap | Read workflow metadata only | None | Separate OIDC identity: create/delete validated run RG and conditional delegation of one approved RG-scoped role/principal | Protected bootstrap environment with human reviewer | Exact run RG and approved role assignment | Subscription-wide Contributor/Owner, arbitrary principal/role/scope, product deployment |
| Staging deployment | Read approved default-branch SHA and artifacts | None | OIDC deployment identity scoped to exact owned RG; managed identities for runtime | Protected staging environment with human reviewer | Resources inside exact run RG | Production, other RGs, role broadening, reusable Azure secret, Foundry/ACR keys |
| Cleanup | Read ownership manifest and approved SHA | None | Protected deletion identity limited to exact run RG; subscription-read identity measures unrelated resources; dedicated narrow purge identity removes only predeclared soft-deleted Cognitive Services accounts | Protected cleanup environment with human reviewer when invoked separately | Delete exact owned scope, purge exact declared account names, and emit measured proof | Enumerate/delete all azd envs, tag-only broad deletion, scope broadening after failure |
| Release | Create prerelease only after evidence/cleanup validation | None | None | Protected release environment with human reviewer | One prerelease and retrospective references | Release before cleanup, mutable/unsanitized evidence, production deployment |
| Orphan detector | Read repository/workflow metadata | None | Subscription-read inventory of factory-named groups and their resources | No deletion credential | Open or update one cleanup incident for expiry, invalid group tags, or incompletely tagged contents | Delete or mutate Azure resources |

## Projects v2 credential ladder

Choose the first live-proven least-privilege option; never expose it to an agent or PR job:

1. A built-in guarded safe output that can update the exact Project item/fields.
2. A dedicated GitHub App or fine-grained token constrained to the needed Project capability and protected non-agent job.
3. A classic PAT with only minimal `project` scope as a separately approved last resort for personal-account limitations, stored behind a protected environment and carrying no repository scopes.

If no rung can be proven and isolated, the live factory is `BLOCKED`.

## Required configuration names

- `COPILOT_GITHUB_TOKEN`: repository secret used only by compiled gh-aw jobs that launch or call GitHub Copilot; never expose it to product code or PR checks.
- `AIMARKET_FACTORY_ENABLED`: repository variable controlling product-state advancement and dispatch. Keep it `false` during control-plane changes.
- `AIMARKET_FACTORY_AZURE_ENABLED`: separate repository variable for Azure automation. Keep it unset or `false` until protected environments, OpenID Connect (OIDC), ownership tags, and cleanup have been verified. The scheduled orphan detector also requires every read-only Azure identity variable to be populated.
- `AZURE_CLIENT_ID`: protected staging/cleanup deployment identity variable.
- `AZURE_READONLY_CLIENT_ID`: read-only subscription inventory identity used by the orphan detector.
- `AZURE_PURGE_CLIENT_ID`: dedicated identity with only the narrow Cognitive Services soft-delete purge action needed for exact predeclared accounts; it is never exposed to product or PR jobs.
- `AZURE_TENANT_ID` and `AZURE_SUBSCRIPTION_ID`: protected Azure scope variables.

The setup dry run lists these names but never reads, prints, or creates their values.

## Azure federation subjects

Record exact federated subjects only in sanitized private provisioning evidence after environment creation. Bind staging/bootstrap/cleanup identities to their exact protected environment and repository; do not use wildcard branch or pull-request subjects. Identity creation or modification is a separate reviewed mutation and requires an explicit setup flag and human approval.

## Read-back rules

After every credential-related configuration mutation, verify only non-secret metadata: credential name, issuer, exact subject, audience, identity object reference, environment association, role definition, condition, and scope. Never retrieve or print values. If conditional role-assignment delegation is unsupported, stop `BLOCKED` unless a human approves and performs a narrower assignment; do not fall back to subscription-wide Contributor or Owner.
