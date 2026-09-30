# Journey Runner Issues

## 2026-07-17 — Non-interactive Copilot helper omitted required permissions

- **Phase:** Runner Step 3, Copilot invocation
- **Observed:** `copilot -p` could read the journey file in its working directory but returned `Permission denied and could not request permission from user` for parent skills and executable commands such as `node --version`.
- **Cause:** Prompt mode is non-interactive. `run-copilot-prompt.mjs` passed only `-p`, so Copilot couldn't request tool, URL, or parent-directory approval after startup.
- **Fix:** Added explicit `--allow-dir`, `--allow-all-tools`, and `--allow-all-urls` options to the wrapper and documented them in the runner skill. These remain opt-in rather than silently granting access.
- **Verification:** A smoke prompt read the parent `journey-runner/SKILL.md`, executed `node --version`, and returned `PERMISSIONS_OK v24.13.0` with exit code 0.
- **Status:** Resolved and integrated. The permission-aware helper was used throughout the five-journey campaign, including the repaired clean-environment reruns.

## 2026-07-28 — Prerequisite checker accepted `git` but could not execute it

- **Phase:** Runner Step 2, prerequisite validation.
- **Observed:** WeatherView requested `node,az,azd,copilot,git`, but `check-prerequisites.mjs` rejected `git` because the command registry had no Git entry.
- **Cause:** The runner documented and accepted arbitrary required-tool names without defining the executable/version arguments for Git.
- **Fix:** Added `git: ['git', ['--version']]` to the command registry.
- **Verification:** The same prerequisite invocation then passed with Git required.
- **Status:** Resolved and integrated.

## 2026-07-28 — Static Web Apps publisher cannot execute on ARM64 Linux

- **Phase:** WeatherView deployment after successful Bicep provisioning.
- **Observed:** azd downloaded Microsoft `StaticSitesClient` as an x86-64 ELF and failed with `Exec format` output on the ARM64 runner.
- **Cause:** The current Static Web Apps deployment client has no ARM64 Linux build; Bicep provisioning and content publishing are separate azd phases.
- **Fix:** Added architecture-aware recovery to the runner and journey-template skills. ARM64 is not rejected automatically because Windows 11 on ARM can emulate many x64 applications. After the exact publisher architecture error, the learner may use the approved temporary x64 Azure publisher with secure token handling and verified deletion, or continue from an approved x64 host. Do not silently install privileged emulation or make local Docker a prerequisite.
- **Verification:** The runner used a temporary scoped x64 Azure publisher for this validation only, deleted it, then passed the checked-in HTTP/assets verifier and the full Playwright deployed-behavior verifier.
- **Status:** Upstream limitation documented; runner behavior corrected.

## 2026-09-27 — journey-runner v2: six-journey rerun

Every journey ran from its README prompts through `extract-prompts.mjs`, `run-copilot-prompt.mjs`, and `run-command.mjs`, with per-step timing and credits from `summarize-run.mjs`. All six deployed, passed their checked-in verifiers, and cleaned up. Runner defects found and fixed:

- **Skill scripts denied under `-p`.** Azure skills run scripts from `~/.agents/skills`, which prompt mode denied. Added `--allow-skill-dirs`.
- **Computer Use drove the host.** With `--allow-all-tools`, an acceptance check opened the user's Safari. The helper now turns off `computer-use` unless `--allow-mcp-server computer-use` is passed.
- **Azure MCP tools hang under `-p`.** `get_azure_bestpractices` never returned in prompt mode (31 minutes). Cause: in the plugin's namespace mode, an intent-only call asks the client to pick the command through MCP sampling (the server log shows a pending continuation, then `Failed to get command and parameters from intent`), and Copilot CLI doesn't answer sampling under `-p` (github/copilot-cli#2882). The helper now serves the same package in `--mode all`, which never samples; the best-practices and Bicep schema tools return in seconds. It also adds `--timeout-minutes`.
- **Agent-run `azd up` abandoned at 600 seconds.** Prompt mode stops waiting for background shell tasks after `COPILOT_TASK_WAIT_TIMEOUT_SECONDS` (600). The helper sets 3600 unless the caller did.
- **Credits scraped from text.** The helper now reads `--usage-output-file`.
- **Prompt blocks with `> ` on every line.** The extractor splits them into separate prompts; the Superset README block that used this style for one prompt was fixed.
- **Screenshot password on the command line.** Added `--password-env`.
- **Verifier tampering.** A Superset repair edited `.github/scripts/verify-superset.mjs` to test from inside the cluster. The runner now checks `git diff --exit-code -- .github/scripts` after every prompt.
- **Stale global azd subscription.** `azd config get defaults.subscription` pointed at a subscription this account can't access. Preflight now compares it with `az account show`.

## 2026-09-28 — v3 reruns with Azure MCP on

Grafana, n8n, Superset, WeatherView, and AIMarket reran with Azure MCP through `--azure-mcp all`. All five passed and cleaned up; Azure MCP served 5 to 30 calls per journey.

- **All 519 `--mode all` tools overflow the context in plan mode.** WeatherView's plan prompt failed with "Static system messages and tool definitions exceed the model's usable context budget". The helper now loads 11 namespaces (41 tools).
- **Interactive agents ask before breaking the spec.** WeatherView's throwaway `/rewind` prompt conflicted with PLAN.md, so the interactive agent asked questions instead of editing, and the pexpect script waited for file changes. The README prompt now marks it as an experiment.
- **The tutorial README gets edited.** AIMarket's agent wrote run instructions into the journey README even when asked to "tell me". PLAN.md now forbids it, as WeatherView's already did (WeatherView's README stayed untouched this time).
- **Verifier and plan disagreed.** verify-aimarket.mjs asked a lookup while PLAN-phase4 requires a comparison prompt; the read-only review caught it. Fixed in the verifier, not by the agent.

## 2026-09-29 — Infrastructure gates for AIMarket and Superset, and cross-platform script checks

- **New `portable-scripts` workflow** runs `.github/scripts/test-portable-scripts.mjs` on Linux, Windows, and macOS runners. Its first Windows run found a real bug: SmartTodo's checkpoint gate ran `node` through the PowerShell launcher with `PATH` restricted to the Node.js directory, so the hook dry-run check failed with `spawnSync powershell.exe ENOENT`. Fixed in the checkpoint and in the plan spec (run Node.js with `process.execPath`).
- **AIMarket and Superset gates validated with real runs.** Both went red before any infrastructure existed and green after generation, and deliberately broken rules (an `ai-` prefix, a `resourceId()` misuse, an unquoted Helm setting, a one-node cluster) each failed the gate. Both deployments passed their unmodified verifiers after one "When something fails" repair each.
- **A gate that reads only literals fails on correct AVM infrastructure.** After the review moved AIMarket to AVM modules, the agent-written gate couldn't resolve values passed into modules. The spec now requires resolving parameters across module boundaries, and the README has a prompt for fixing a wrong gate as a new red commit.
- **New rules from these runs:** the Superset hook resolved the repository root one folder too high (the gate now runs the hook's `--dry-run`), and AIMarket read the AI Search admin key before the service existed (the gate now checks the ordering), plus `*.db` in every `.dockerignore`.

## 2026-09-30 — Full journey runs on GitHub-hosted Windows runners

`run-journey.mjs` and the `journey-windows` workflow ran every journey on `windows-latest` with Copilot CLI, the Azure Skills plugin, Azure MCP, and a real Azure deployment. Grafana, n8n, WeatherView, Superset, and AIMarket passed their unmodified verifiers and cleaned up completely. Windows found problems macOS and Linux never showed:

- **Public images pulled through local Docker.** `azure.yaml` declared Grafana as a service with `image:`, so azd pulled it with Docker running Windows containers. Public-image deployments now have no azd service (Container Apps, Grafana, and n8n skills).
- **Hook commands the Windows launcher rejects.** Superset's `az aks command invoke` strings used `"` and `&&`, which the PowerShell launcher refuses for `.cmd` targets. Rule: no quotes, `; ` after `set -e`, and doubled backslashes in the ingress annotation (skill and gate).
- **`az` crashing on non-ASCII output.** A ✓ in `az acr build` logs and Helm's banner in `az aks command invoke` output crashed `az` with `UnicodeEncodeError` on the Windows console. Hooks pass `--no-logs` to `az acr build` and drop `helm repo update`.
- **OIDC sign-in expiring mid-run.** `azure/login` reuses one short-lived GitHub token, so long runs failed with `AADSTS700024`. `refresh-azure-oidc.mjs` signs in again every 4 minutes.
- **The OIDC subject uses immutable IDs.** GitHub issued `repo:<owner>@<id>/<repo>@<id>:environment:journey-windows`; the federated credential needs that exact subject.
- **Agents' `taskkill /T` could kill the runner.** Copilot now runs detached on Windows, and the runner always writes a report and logs.
- **Portable-script bug.** SmartTodo's checkpoint gate ran Node through the PowerShell launcher with `PATH` limited to Node's folder (found by the `portable-scripts` workflow).

Journey rules that runs on every OS benefit from, found on Windows: storage account names without hyphens, `NodeNext` modules and a load check for SmartTodo, attached-file base names and `PYTHONPATH` as a container variable for Superset, and a SQLite folder in AIMarket's API image. Each is in the journey's plan or skill, a gate check where a program can check it, troubleshooting, and "Lessons from validation runs".
