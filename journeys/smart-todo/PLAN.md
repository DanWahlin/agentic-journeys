# SmartTodo: AI-Powered Task Breakdown

SmartTodo is an iPhone app and Azure backend that turns vague goals into actionable steps. This document defines the vision, shared decisions, the quality gates every phase must pass, and how work moves through GitHub. Detailed implementation requirements live in the phase plans so an agent can load only the context needed for the current phase.

README prompts use exact document names and section names as stable references. If a document or section is renamed, update its README references in the same change.

## Vision

Deploying to Azure is the easy part for an agent. The hard part is getting output that is worth deploying. SmartTodo teaches a workflow that makes agent output trustworthy:

1. Turn an architecture diagram into GitHub issues.
2. Interview the plan (the `grill-plan` skill) so decisions are made by the learner, not guessed by the agent.
3. Write failing tests first (red), then let the agent make them pass without touching the tests (green).
4. Ship only through deterministic gates: tests, a black-box contract verifier, infrastructure checks, CI, and code review.
5. Automate the whole loop so the next feature runs through the same factory.

The learner's job is to make decisions and review tests. The agent's job is to write the code that satisfies them.

## End State

The completed application has:

- An Azure Functions REST API for todos and action steps, with unit and contract tests that run without a database, AI key, or network.
- Azure SQL storage behind repository interfaces, with an in-memory implementation for local development and tests.
- AI task decomposition with `gpt-5-mini` on Microsoft Foundry, with a deterministic fake for local development and tests.
- A SwiftUI iOS client built from the mockups in [`images/mockups/`](./images/mockups/), with unit tests and a UI test.
- Azure Functions Flex Consumption hosting with managed-identity access to Azure SQL, provisioned by Bicep that passes a deterministic infrastructure gate before deployment.
- A GitHub repository with issues, a protected `main` branch, required CI checks, Copilot code review, and auto-merge.
- A reusable infrastructure skill, a deterministic scaffold script, and a cloud agent setup that can deliver the next feature from an issue.

## Scope

**Included:** Todo management, AI-generated action steps, step completion, automatic todo status changes, deterministic seed data, local development without Azure, a SwiftUI client, tests, CI, repository rules, Azure deployment, monitoring, verification, and cloud agent automation.

**Out of scope:** User authentication, push notifications, collaboration and sharing, offline sync, recurring todos, image attachments, rate limiting, and mobile-app distribution through azd.

## Shared Decisions

- **API stack:** Node.js LTS + TypeScript + Azure Functions v4 programming model. Tests use Vitest. Other languages are possible, but the tests, gates, and CI in these plans are specified for Node.js only.
- **Client:** Swift and SwiftUI for iOS 17 or later, tested with XCTest and XCUITest.
- **Data:** Azure SQL in Azure. An in-memory store locally and in tests. Access only through repository interfaces.
- **AI:** `gpt-5-mini` on Microsoft Foundry, with `gpt-4.1` as the regional fallback. A deterministic fake generator locally and in tests.
- **Pull requests:** Phases 1 to 3 are one GitHub stack of pull requests, managed with `gh stack`. Phase 4 uses ordinary pull requests.
- **Deployment:** Azure Developer CLI (`azd`) and Bicep. Prefer Azure Verified Modules, and use a raw `Microsoft.*` fallback when AVM parameter drift blocks deployment.
- **Default region:** `westus`.
- **API status values:** `pending`, `in_progress`, and `completed`.
- **Custom agent:** `tdd-builder` (in `.github/agents/`) runs the red and green phases.
- **Planning skill:** `grill-plan` (in `.github/skills/`) runs the plan interview.

## Workspace Setup

Create the learner's workspace in a sibling directory named `smart-todo-workspace` next to the journeys repository. Stop and ask before changing anything if that directory already exists and isn't empty. Don't modify the journeys repository.

1. Copy these directories into the workspace, keeping their paths: `journeys/smart-todo`, `.github/agents`, `.github/skills`, `.github/scripts`, and `docs`.
2. Initialize a Git repository on a `main` branch at the workspace root.
3. Add a root `.gitignore` that excludes secrets and generated files: `.env` and `.env.*` (but allow `.env.example`), `.azure/`, `local.settings.json`, `node_modules/`, `dist/`, `build/`, `coverage/`, `.azurite/`, and the Xcode artifacts `*.xcuserstate`, `xcuserdata/`, and `DerivedData/`.
4. Commit everything as `Initial SmartTodo workspace`.

## Target Project Structure

The learner's workspace is also their GitHub repository. Paths are relative to the workspace root.

```text
smart-todo-workspace/
├── .github/
│   ├── agents/tdd-builder.agent.md
│   ├── skills/                        # grill-plan and the Phase 3 infrastructure skill
│   ├── scripts/verify-smart-todo.mjs  # checked-in black-box contract verifier
│   ├── workflows/ci.yml               # api, ios, infra, and windows checks
│   ├── workflows/copilot-setup-steps.yml
│   └── copilot-instructions.md        # definition of done (Phase 4)
└── journeys/smart-todo/
    ├── PLAN*.md, images/
    ├── starter/ios/                   # starter Xcode project copied into src/ios in Phase 2
    ├── src/api/                       # Azure Functions API + tests
    ├── src/ios/                       # SwiftUI app + tests
    ├── scripts/                       # test-ios.mjs, check-infra.mjs, scaffold-infra.mjs
    ├── infra/                         # Bicep and portable deployment hooks
    └── azure.yaml
```

## Phase Plans

| Journey phase | Detailed plan | Outcome |
| --- | --- | --- |
| Phase 0: Plan the work | This document and [`images/architecture.png`](./images/architecture.png) | Repository, CI workflow, protected `main`, and one GitHub issue per phase |
| Phase 1: Build the API test-first | [`PLAN-phase1-api.md`](./PLAN-phase1-api.md) | Models, repositories, REST endpoints, seed data, AI decomposition, tests, and the first CI checks |
| Phase 2: Build the iOS app from mockups | [`PLAN-phase2-ios.md`](./PLAN-phase2-ios.md) | SwiftUI app, API client, unit tests, UI test, and the `ios` check |
| Phase 3: Deploy to Azure with gates | [`PLAN-phase3-azure.md`](./PLAN-phase3-azure.md) | Cost review, infrastructure gate, Flex Consumption deployment, a reusable skill, and a scaffold script |
| Phase 4: Build the factory | [`PLAN-phase4-factory.md`](./PLAN-phase4-factory.md) | Definition of done, cloud agent environment, and an issue delivered by the cloud agent |

Read this overview before beginning. During implementation, load the current phase plan and only the earlier phase plan needed to confirm an existing contract. A final review must check this overview and all phase plans.

## Issue Breakdown

Phase 0 creates one parent issue and one sub-issue for each of Phases 1 to 3:

- **Parent issue:** `SmartTodo v1`, summarizing the architecture and linking this document.
- **Sub-issues:** `Phase 1: API`, `Phase 2: iOS app`, and `Phase 3: Azure deployment`.

Each sub-issue body contains:

1. **Goal:** One or two sentences.
2. **Plan:** A link to the phase plan.
3. **Acceptance criteria:** A task list copied from the phase plan's acceptance criteria section.
4. **Gate:** A table copied from the phase's rows in [Quality Gates](#quality-gates), with one command per row and the directory to run it from. Don't combine commands with `cd` or `&&`, because the next command then runs in the wrong directory.
5. **Depends on:** The earlier phase, when one exists.

Label the sub-issues `phase-1`, `phase-2`, and `phase-3`. Also create a `known-limitation` label; [Review Triage](#review-triage) files real issues that are out of scope as issues with that label. Create the labels when they don't exist.

## Quality Gates

No phase ships until its gate passes. A gate is a command with a deterministic exit code, not an agent's opinion.

| Phase | Gate command (from `journeys/smart-todo`) | Proves | Runs in CI job |
| --- | --- | --- | --- |
| 1 | `npm run check` in `src/api` | Type checks, unit tests, and contract tests pass without Azure | `api` |
| 1 | `git diff --exit-code phase1-red -- src/api/test` | The green phase didn't change the latest red-phase tests | Local only |
| 1 | `node ../../.github/scripts/verify-smart-todo.mjs --base-url http://localhost:7071` | The running API honors the contract from the outside | `api` |
| 2 | `node scripts/test-ios.mjs` | The iOS unit tests and UI test pass on a simulator | `ios` (macOS runner) |
| 2 | `git diff --exit-code phase2-red -- scripts/test-ios.mjs src/ios/SmartTodoTests src/ios/SmartTodoUITests` | The green phase didn't change the red-phase tests or the test runner | Local only |
| 3 | `node scripts/check-infra.mjs --offline` | Bicep compiles and lints cleanly, and it satisfies the deployment contract | `infra` |
| 3 | `git diff --exit-code phase3-red -- scripts/check-infra.mjs` | Generating infrastructure didn't weaken the gate | Local only |
| 3 | `node scripts/check-infra.mjs` | The offline checks plus an `azd provision --preview` what-if run against Azure | Local only |
| 3 | `node ../../.github/scripts/verify-smart-todo.mjs` | The deployed API honors the contract | Local, or the Phase 4 release pipeline |
| 4 | [Verify Before Merge](#verify-before-merge) | A pull request that changes the API or infrastructure works on Azure before it merges | Local |

The checked-in verifier (`.github/scripts/verify-smart-todo.mjs`) is the one gate an agent doesn't write. Treat changes to it as a review-required change.

**Red tags move forward.** `phase1-red`, `phase2-red`, and `phase3-red` always point at the latest red commit. When review findings add tests later in the phase, commit those tests as a new red commit and move the tag with `git tag -f phase1-red`. The diff gate then proves that the fix didn't change the new tests either.

## Verify Before Merge

Local gates use the in-memory store and the fake AI, so they can't catch bugs that only exist in Azure. Validation runs hit three: a model parameter that gpt-5-mini rejects, a SQL parameter bound with the wrong type, and a schema change that the code needed before the database had it. Once the Azure environment exists (after Phase 3), a pull request that changes `src/api` or `infra` must also pass this gate before it merges:

1. Check out the pull request branch (`gh pr checkout <number>`).
2. From `journeys/smart-todo`, run `azd deploy api` for code changes, or `azd up` when `infra/` changed.
3. Run `node ../../.github/scripts/verify-smart-todo.mjs` and paste its `PASS` line into a pull request comment.

The deployed app then runs the pull request's code until the next deployment, which is fine for a learning environment. The unit tests also check the boundaries the fake AI and memory store hide: the exact fields of the model request and the SQL parameter types (see [Test Strategy](./PLAN-phase1-api.md#test-strategy)).

## Continuous Integration

Generate `.github/workflows/ci.yml` at the workspace root during Phase 0, before the ruleset exists. Each job skips its work until its area exists, so the file is correct from the first commit, and `/review` in later phases doesn't report CI as missing.

- Trigger on `pull_request` (for any base branch, so every layer of the stack gets checks) and on `push` to `main`.
- Use jobs named exactly `api`, `ios`, `infra`, and `windows`. The first three are required status checks. `windows` is informational: it proves the Windows path but doesn't block merging.
- **Every job must always run and must succeed when its area doesn't exist yet.** Don't use workflow-level `paths` filters. A required check that never reports blocks the pull request forever. Use a first step that detects whether `journeys/smart-todo/src/api`, `journeys/smart-todo/src/ios`, or `journeys/smart-todo/infra` exists, and condition the later steps on it.
- `api` (ubuntu-latest): Use `journeys/smart-todo/src/api` as the working directory. Set up Node.js LTS with npm caching and `cache-dependency-path: journeys/smart-todo/src/api/package-lock.json`. Run `npm ci`, `npm run check`, and `npm run build`. Copy `local.settings.example.json` to `local.settings.json`, because the real file is gitignored and `func start` needs its `AzureWebJobsStorage`, `FUNCTIONS_WORKER_RUNTIME`, `DATA_PROVIDER=memory`, and `AI_PROVIDER=fake` values. Install Azure Functions Core Tools v4 with npm, start `npm run azurite` and `func start` in the background, wait until `GET /api/todos?userId=user-1` returns 200 (at most 120 seconds), and then run the checked-in verifier with `--base-url http://localhost:7071`.
- `ios` (macos-latest): Run `node journeys/smart-todo/scripts/test-ios.mjs` when the Xcode project exists.
- `infra` (ubuntu-latest): Run `node journeys/smart-todo/scripts/check-infra.mjs --offline` when `infra/` exists. Azure CLI is preinstalled. Run `az bicep install` first.
- `windows` (windows-latest, `defaults.run.shell: pwsh`): When `src/api` exists, run the same steps as `api` (install, `npm run check`, build, Azurite, `func start`, the checked-in verifier). When `infra/` exists, install `azd` with `Azure/setup-azd@v2` and run `node journeys/smart-todo/infra/hooks/postprovision.js --dry-run`. Fail the job if its output reports `az` or `azd` as `MISSING`; that proves the hook finds and runs them through its Windows launcher without touching Azure. Start background processes with `Start-Process` and poll with `Invoke-WebRequest`.
- Use `permissions: contents: read`. The workflow needs no secrets.

## Repository Protection

Create one branch ruleset on the default branch during Phase 0:

- Require a pull request before merging, with 0 required approvals. The learner authors most pull requests and can't approve their own. Phase 4 explains when to raise this.
- Require conversation resolution before merging, so unresolved Copilot code review comments block the merge.
- Require the status checks `api`, `ios`, and `infra`. Don't require branches to be up to date, because auto-merge doesn't update branches for you.
- Automatically request a Copilot code review on new pull requests only. Turn off review on new pushes (`review_on_push: false` in the ruleset's `copilot_code_review` rule), so fixing review comments doesn't start another review. [Review Triage](#review-triage) allows one round per pull request.
- Block force pushes and branch deletion.

Also enable auto-merge, squash merging, and automatic head-branch deletion on the repository (`gh repo edit --enable-auto-merge --enable-squash-merge --delete-branch-on-merge`). Stack layers merge with `gh stack merge`; auto-merge is for the ordinary pull requests in Phase 4.

**Copilot code review doesn't block by itself.** Its review arrives a few minutes after a pull request opens and is a comment, not an approval or a required check. Conversation resolution only blocks once the comments exist. So never enable auto-merge when you open a pull request. Wait for the Copilot review, handle it with the [Review Triage](#review-triage) rules, and then enable auto-merge.

**Without Copilot code review** (your plan doesn't include it), leave the `copilot_code_review` rule out of the ruleset. Run `/review` locally before you open each pull request and triage its findings the same way. Every other gate is unchanged.

Rulesets are enforced on public repositories on every GitHub plan. Private repositories need GitHub Pro, Team, or Enterprise. If the ruleset can't be enforced, report it and continue. The gates still run, but they don't block merging.

## Review Triage

Every review finding, from `/review`, `/rubber-duck`, or Copilot code review, gets one of three outcomes:

1. **Fix:** Correctness, security, or contract findings get a red/green loop: a failing test in a new red commit (and move the phase's red tag), then the fix. Reply to the comment with the commits and resolve the thread.
2. **Known limitation:** Real issues outside this phase's scope become a GitHub issue labeled `known-limitation`, with the finding and a one-line suggested fix. Reply to the comment with the issue link and resolve the thread.
3. **Decline:** Findings that are wrong or conflict with the plan get a reply that cites the plan section. Resolve the thread.

**One round per pull request.** Copilot reviews a pull request once, when it opens or, for an upper stack layer, when you request it (the ruleset doesn't review new pushes). Fix everything in that round with one push. If you request another review, file anything it finds as `known-limitation` issues instead of fixing it in the same pull request. Validation runs showed that each extra round finds something new in the previous fix and costs more than the fix itself.

**Problems you hit and fixed** during a phase go in the pull request description under a "Problems and fixes" heading, so they're recorded without a file that every branch edits.

**Triage procedure for a pull request's review** (what "handle the review" means in the README):

1. Read every review comment with the GitHub CLI.
2. Give each one an outcome from the list above. Write fixes as the tdd-builder agent's red/green loop: failing tests in a new red commit, then the fix as a green commit. Commit each fix in the layer that owns the change, and move the phase's red tag with `git tag -f` when the phase has one; a cloud agent pull request has no tag, so its fix is checked against the latest red commit instead.
3. If a fix touched `infra/` or `src/api` and the Azure environment exists, run [Verify Before Merge](#verify-before-merge) (for `infra/`, `node scripts/check-infra.mjs` and `azd up` first, then `node infra/hooks/postprovision.js`) and paste the verifier's `PASS` line into a pull request comment.
4. Reply to every thread with its commits, issue link, or reason, and resolve it.
5. Push once, after every fix is committed (`gh stack push` for a stack layer). Don't merge; the human does that.

## Stacked Pull Requests

Phases 1 to 3 are one **GitHub stack**, managed with the [`gh stack`](https://github.com/github/gh-stack) extension. Each phase is a layer whose pull request shows only that phase's changes, and each layer can start before the one below it merges:

```text
main ← phase-1-api ← phase-2-ios ← phase-3-azure
```

| Phase | Create the layer | Pull request base |
| --- | --- | --- |
| 1 | `gh stack init --base main phase-1-api` | `main` |
| 2 | `gh stack add phase-2-ios` (from the top of the stack) | `phase-1-api` |
| 3 | `gh stack add phase-3-azure` (from the top of the stack) | `phase-2-ios` |

- **Open pull requests with `gh stack submit --auto --open`.** It pushes every layer and creates or updates one ready-for-review pull request per layer, linked as a stack. Put `Closes #<issue>` in each pull request description.
- **Titles become commits.** `submit --auto` titles each pull request from its branch name (`phase 1 api`), and the squash merge uses that title as the commit message. Retitle each one (`Phase 1: API`) when you open it.
- **Merge rules apply to every layer as if it targeted `main`.** Required checks and conversation resolution are evaluated against `main` for every layer, and CI's `pull_request` trigger runs for every layer.
- **Request Copilot review for every layer above the bottom.** The ruleset's automatic Copilot review fires only for pull requests whose base is `main`, so layers 2 and 3 get no review on open. Run `gh pr edit <pr> --add-reviewer @copilot` right after `submit`. Copilot review doesn't block by itself, so a layer without it can merge unreviewed.
- **Fix a lower layer in that layer.** Run `gh stack checkout <branch>` (or `gh stack down`), commit the fix, run `gh stack rebase --upstack` to replay the layers above it, then `gh stack top` and `gh stack push`.
- **Merge with `gh stack merge <pr> --yes --squash`**, not `gh pr merge` or auto-merge, which can't merge a stack. It merges that pull request and every unmerged one below it, and it fails without merging anything if any of them isn't ready. Merge a layer as soon as its review is done, then run `gh stack sync` to rebase the remaining layers onto `main`.
- **Red tags survive rebases.** `gh stack rebase` and `sync` rewrite commit IDs, so `phase1-red`, `phase2-red`, and `phase3-red` keep pointing at the original commits. The diff gates compare file contents, so they still work as long as a layer never edits another layer's test files.
- **One checkout holds the stack.** Layers are built one after another in the same checkout: you can open the next layer while the one below is in review, but you can't have two agents writing two layers at the same time. Don't put stack layers in separate worktrees. Use a worktree only to run the local API, as a detached checkout that moving between layers doesn't disturb: `git worktree add --detach ../../../smart-todo-api phase-1-api`. Worktrees don't share ignored files, so copy `src/api/local.settings.example.json` to `local.settings.json` and run `npm ci` there. After a Phase 1 fix, refresh it with `git checkout --detach phase-1-api` in that worktree and restart the API.

Stacked pull requests are in public preview. If `gh stack submit` reports that stacks aren't enabled for the repository (exit code 9), open ordinary pull requests with the same bases instead, and merge them bottom-up.

## Cross-Phase Contracts

- Phase 1 ([`PLAN-phase1-api.md`](./PLAN-phase1-api.md)) owns the canonical Todo, ActionStep, error, REST response, and AI-generation contracts, and the `DATA_PROVIDER` and `AI_PROVIDER` settings.
- Phase 2 ([`PLAN-phase2-ios.md`](./PLAN-phase2-ios.md)) consumes the Phase 1 contracts and centralizes calls in one Swift API client.
- Phase 3 ([`PLAN-phase3-azure.md`](./PLAN-phase3-azure.md)) configures and deploys the application built in the first two phases. It does not redefine application behavior.
- Phase 4 ([`PLAN-phase4-factory.md`](./PLAN-phase4-factory.md)) automates the workflow and must not weaken any gate.
- Section names referenced by README prompts are part of the journey contract.

## End-to-End Acceptance Criteria

The local application is complete when:

- `npm run check` passes and the checked-in verifier passes against the local API with the in-memory store and fake AI.
- `node scripts/test-ios.mjs` passes on a Mac.
- Each phase merged to `main` through a pull request with green `api`, `ios`, and `infra` checks.

The Azure deployment is complete when:

- `node scripts/check-infra.mjs` passes before `azd up`.
- The post-provision hook creates the managed-identity database user, and the API applies its migrations and seed data at startup.
- The checked-in verifier passes against the deployed API.
- The iOS app can use the deployed HTTPS API URL.

The journey is complete when a Phase 4 feature issue has been delivered through the same gates, and `azd down --force --purge` has removed the run's Azure resources.

## Production Hardening (Out of Scope)

Before exposing this beyond a demo, wrap multi-write operations (step generation, regeneration, and step-driven status changes) in Azure SQL transactions, add API authentication, move `AZURE_AI_KEY` to Key Vault or managed identity, add rate limiting for `/generate-steps`, encode output if data is rendered in a browser, and replace broad storage and SQL firewall rules with private networking.
