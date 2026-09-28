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
