# AIMarket Factory: Governed Agentic Delivery Implementation Contract

Build the inherited AIMarket product through a dependency-aware, human-governed GitHub factory. This is the shared implementation contract for coordinator, specialists, reviewers, deterministic workflows, and maintainers; it is not the learner walkthrough.

## Contract precedence

1. [`PRODUCT.md`](./PRODUCT.md) defines customer-facing behavior and identifies inherited versus factory-only requirements.
2. [`FACTORY.md`](./FACTORY.md) defines authorization, state, WIP, stacks, credentials, evidence, and cleanup.
3. Files under [`factory/`](./factory/) are machine-readable projections of those contracts.
4. A child Issue narrows one F0–F15 work item but cannot override the preceding contracts.

Conflicts stop work as `factory:needs-clarification` or `factory:blocked`; agents do not choose a weaker interpretation.

## Fixed stack and boundaries

Use Node.js 24, TypeScript, Express, SQLite repositories, React 18, Vite, Tailwind CSS, Playwright, azd, Bicep, Azure Container Apps, ACR, Azure AI Search, and Microsoft Foundry. This factory does not offer the interactive journey's alternative API languages.

Do not implement authentication, payments, production deployment, automatic merge, cross-repository code changes, hidden durable agent state, or a proprietary factory dashboard. Do not activate event-triggered workflows in the public curriculum repository: setup tooling copies inert repository templates into an explicitly selected private lab before compilation/activation.

## Repository-local contracts

The private lab must contain and validate local copies of `PRODUCT.md`, `FACTORY.md`, this `PLAN.md`, and all `factory/*` files before dispatch. Issues are authoritative; Project v2 is a projection. Every child issue and PR uses the templates under [`templates/`](./templates/) and includes stable ID, parent, dependencies, owned paths, referenced headings, acceptance commands, risk, artifacts, rollback, budget/TTL impact, and prohibited actions.

Reserved factory-control paths (`.github/workflows/**`, `.github/agents/**`, `.github/skills/**`, `factory/**`, setup/provisioning code, and deployment/cleanup/release code) require an explicitly approved control issue. Product workers cannot own them.

## Work graph F0–F15

| ID | Deliverable | Depends on | Stack | Exit evidence |
|---|---|---|---|---|
| F0 | Freeze product contract and referenced headings | Approved RFC | Contract | Approved contract diff and heading inventory |
| F1 | Schemas, canonical fixtures, contract tests, CI baseline | F0 | Contract | Contract checks pass |
| F2 | API package baseline, models, and validation | F1 | API | Package, model, and unit tests pass |
| F3 | Repository interfaces, SQLite, atomic inventory transactions | F2 | API | Repository and rollback tests pass |
| F4 | REST routes and API integration tests | F3 | API | API contract/mutation tests pass |
| F5 | Web package baseline, React shell, typed API client, mocked catalog | F1 | Web | Package, build, and component baseline pass |
| F6 | Product, cart, order, and accessibility flows | F4, F5 | Web | Browser and accessibility checks pass |
| F7 | Local search and Azure AI Search adapter | F4 | Search | Adapter/normalization/fallback tests pass |
| F8 | AI Search UI and semantic-search evals | F6, F7 | Search | Deterministic top-N/UI evals pass |
| F9 | Catalog-grounded chat API and adversarial evals | F4 | Chat | Grounding/failure/injection tests pass |
| F10 | ChatWidget and multi-turn browser tests | F6, F9 | Chat | Multi-turn browser tests pass |
| F11 | Region, quota, model, Search, identity, budget, and blocked-outcome preflight | F8, F10 | Preflight | Factual READY or BLOCKED report; no provisioning |
| F12 | Containerization and deterministic local build proof | F4, F6, F8, F10 | Infra | Reproducible image/build proof |
| F13 | Bicep, RG-scoped identities, ACR hooks, policy, ownership inventory | F11, F12 | Infra | Bicep build/full preview and policy checks pass |
| F14 | Integration candidate and full local suite | F8, F10, F13 | Integration | All canonical required checks pass on final SHA |
| F15 | Protected staging, proof, teardown, prerelease, retrospective | F14 + human approval | Release | Live proof, verified cleanup, evidence read-back, prerelease |

The canonical DAG is [`factory/task-graph.yml`](./factory/task-graph.yml). Do not skip, merge, or invent IDs.

## Stack and dispatch implementation

Use separate Contract, API, Web, Search, Chat, and Infra work sequences in dependency order. The live lab waits for each dependency to merge before dispatching its child, so every worker pull request targets the current default branch. F11 is a preflight gate rather than a code stack: it can run alongside F12 after their product prerequisites pass, and F13 waits for both. F14 and F15 are gated work items. A branch belongs to one issue and one sequence; every draft PR links exactly one approved issue. Agents and workflows never rewrite worker branches or merge automatically.

After a maintainer merges the approval record that binds the parent and child work-order hashes, the state controller projects verified human merges to `factory:done` and promotes dependency-ready F2–F13 work within two-stack, one-open-PR-layer-per-stack, and four-review-PR capacity. F12 and F13 must retain `factory-control:approved`. F14 and F15 remain explicit gates. The controller reconstructs missed merge events and refuses edited, duplicated, ambiguous, or unverified work orders. `factory:ready` is still provisional: after entering Issue-scoped workflow concurrency, the dispatcher must re-read live budgets, existing assignments, sessions, branches, pull requests, and all dispatch prerequisites before assigning at most one Copilot session. Advisory branch and path instructions are not enforcement.

F2 owns `api/package.json`, `api/package-lock.json`, and `api/tsconfig.json` and establishes the complete approved API dependency baseline needed by F2–F10. F5 owns `client/package.json`, `client/package-lock.json`, `client/tsconfig.json`, and its bounded Vite and Tailwind configuration and establishes the complete approved Web dependency baseline needed by F5–F10. Later parallel work does not share manifest ownership; a new dependency requires a reviewed contract amendment rather than an undeclared manifest edit.

## Deterministic quality gates

[`factory/required-checks.yml`](./factory/required-checks.yml) owns exact check identifiers. Branch rules, CI jobs, status summaries, templates, and evidence must resolve those identifiers without drift. Required categories are formatting/build, unit, schema/contract, API mutation, deterministic browser, accessibility, dependency vulnerability, secret, license, changed-path, agent/workflow security, stack state, Bicep build/preview when applicable, and evidence schema.

No LLM conclusion substitutes for a required check. PR code executes in secretless read-only context. Independent review examines the issue, frozen plans, final-head diff, required checks, correctness, security, reliability, cost, and prohibited actions. Head changes invalidate checks and review.

## Product acceptance

Implement and verify every invariant in `PRODUCT.md`, including ten canonical products, atomic inventory decrement, complete error envelope, local filters, accessible cart/order flows, normalized semantic scores, deterministic travel-query relevance, catalog-only multi-turn chat, prompt-injection resistance, 503/502 failure semantics, correct production API URL, and successful required resources.

Use deterministic mocks and fixtures for merge gates. Run bounded live Search/Foundry conformance only after staging approval. Service/quota/transient failure is `BLOCKED` and cannot be restated as deterministic code failure or PASS.

## Protected staging and identity

F15 runs only from an approved, pinned default-branch SHA through protected manual or verified post-merge contexts. It never runs from `pull_request`, `pull_request_target`, or an agent branch.

Use separate protected OIDC identities for read-only subscription preflight, resource-group bootstrap, and RG-scoped deployment. The bootstrap may create/delete only the validated run RG and conditionally assign only the approved role/principal. If conditional delegation is unsupported, stop unless a human explicitly performs a narrower assignment. Never use a reusable Azure client secret or subscription-wide Contributor/Owner fallback.

The deployment has one dedicated tagged resource group, staging concurrency one, maximum TTL 4 hours, Azure estimate ceiling USD 20, Actions ceiling 240 minutes, and Copilot ceiling 40 premium requests. Public endpoints are strictly temporary. Every resource is inventoried by run ID, owner, repository, and expiry.

## Evidence, failure, and cleanup

Emit versioned, sanitized evidence tied to repository, run/issue/PR, policy version, exact SHA, check conclusions, immutable producer run, timestamps, and artifact hashes. Store no token, credential, connection string, cookie, authorization header, private identifier, or unsanitized endpoint in curriculum artifacts.

Before deployment can start, staging uploads an immutable cleanup checkpoint. A failed run invokes measured cleanup in `always()` steps; if cancellation prevents those steps, a default-branch recovery workflow opens a blocked incident from the checkpoint. Inventory the exact run RG, predeclare every Cognitive Services account by name/location/group, reject other soft-delete types, delete the group, and use a dedicated narrow identity to purge only those declared accounts. Verify RG/tag/soft-delete absence and unrelated-resource preservation from Azure read-back. A scheduled detector is read-only; protected cleanup requires human approval. Cleanup failure opens an incident and blocks prerelease. Only after evidence read-back and cleanup PASS may a human approve a prerelease and retrospective.

## Definition of done

The factory implementation is complete when:

- All F0–F15 Issue, dependency, state, sequence, WIP, concurrency, and duplicate-state contracts validate.
- Every merged implementation PR has historical ready-at-dispatch evidence, links exactly one approved work order, and passes required deterministic checks plus independent final-head review.
- Zero prohibited actions succeeded and no unrelated repository artifact was modified.
- One protected staging run passed live product conformance or recorded a factual `BLOCKED` result without false success.
- Cleanup proved zero owned active and soft-deleted resources and preserved unrelated resources.
- Evidence hashes/read-back match the tested SHA; actual budgets and flow metrics are reported; prerelease follows cleanup.
