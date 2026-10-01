# Agentic Fundamentals

The journeys teach agentic coding by doing it. This page is the map: each technique, what it's for, and the journey where you practice it. Read it before you start, or come back to it when a journey uses something new.

## The loop

Every journey repeats one loop: **plan → generate → inspect → verify → review → ship.** The agent generates, and you decide. Most of what follows is a way to make one step of that loop cheaper or safer.

## Steer the agent before it writes

| Technique | What it's for | Practice it in |
| --- | --- | --- |
| Plan mode (**Shift+Tab**) | The agent proposes files and steps without changing anything, so a wrong direction costs one sentence to fix. | [WeatherView](../journeys/weather-view/README.md), Phase 1 |
| `@` mentions | Attach a plan, a mockup, or a diagram to a prompt, so the agent reads the spec instead of guessing. | [WeatherView](../journeys/weather-view/README.md), [SmartTodo](../journeys/smart-todo/README.md) |
| A plan (`PLAN.md`) as the contract | Prompts stay short because the plan holds the requirements; reviews check against it. | [WeatherView](../journeys/weather-view/README.md), [AIMarket](../journeys/aimarket/README.md), [SmartTodo](../journeys/smart-todo/README.md) |
| Plan interviews (`grill-plan`) | The agent asks the questions it would otherwise answer silently, and the answers become tests. | [SmartTodo](../journeys/smart-todo/README.md), Phase 1 |
| Custom agents (`/agent`) | A persona with one job, such as `oss-to-azure-deployer` or `tdd-builder`. | [Grafana](../journeys/grafana/README.md), [n8n](../journeys/n8n/README.md), [Superset](../journeys/superset/README.md), [SmartTodo](../journeys/smart-todo/README.md) |
| Skills | Reusable know-how the agent loads when it's relevant, such as how to deploy Superset to AKS. | Every journey |
| Azure MCP (Azure Skills plugin) | Current Bicep schemas, pricing, deployment guidance, and logs, instead of what the model remembers. | Every journey |

## Check the work, and undo it

| Technique | What it's for | Practice it in |
| --- | --- | --- |
| `/diff` | See exactly what the last step changed before you build on it. | [WeatherView](../journeys/weather-view/README.md), Phase 1 |
| `/rewind` | Undo a turn, including its file changes (choose **Conversation + files**), so trying an idea is cheap. | [WeatherView](../journeys/weather-view/README.md), Phase 1 |
| `/fork` | Explore a what-if in a copy of the session without disturbing the original. | [Superset](../journeys/superset/README.md), Step 4 |
| `/review` and `/rubber-duck` | A focused review, or a second opinion from another model, before you open a pull request. | [WeatherView](../journeys/weather-view/README.md), [AIMarket](../journeys/aimarket/README.md), [SmartTodo](../journeys/smart-todo/README.md) |
| Checked-in verifiers | A script you didn't let the agent write decides whether the deployment works. | Every journey (`.github/scripts/verify-*.mjs`) |
| Infrastructure gates | A script written before the infrastructure checks the rules a preview misses. | [AIMarket](../journeys/aimarket/README.md), [Superset](../journeys/superset/README.md), [SmartTodo](../journeys/smart-todo/README.md) |
| Red/green tests | Failing tests first, then code, with a tag that proves the tests didn't change. | [SmartTodo](../journeys/smart-todo/README.md) |

## Work in parallel

| Technique | What it's for | Practice it in |
| --- | --- | --- |
| Build while you deploy | The agent writes the next piece while `azd up` runs in another terminal. | [n8n](../journeys/n8n/README.md), Step 4 |
| Copilot cloud agent | Assign an issue; the agent works on GitHub and opens a pull request while you build something else. | [AIMarket](../journeys/aimarket/README.md), Phase 3; [SmartTodo](../journeys/smart-todo/README.md), Phase 4 |
| `/delegate` | Hand the current task from the CLI to the cloud agent. | [AIMarket](../journeys/aimarket/README.md), Phase 3 |
| Autopilot and `/fleet` | Let the agent keep going until a goal is met, or split a plan across parallel subagents. | [SmartTodo](../journeys/smart-todo/README.md), Phase 1 |
| Worktrees | A second checkout, so a running API doesn't stop when you switch branches. | [SmartTodo](../journeys/smart-todo/README.md), Phase 1 |

## Ship through GitHub

| Technique | What it's for | Practice it in |
| --- | --- | --- |
| Issues as shared memory | Decisions, test lists, and known limitations attach to the issue, so the next session or agent starts with the same context. | [SmartTodo](../journeys/smart-todo/README.md), [AIMarket](../journeys/aimarket/README.md) |
| Copilot code review | An automated reviewer on every pull request. Triage each comment: fix it, or decline it with a reason. | [AIMarket](../journeys/aimarket/README.md), [SmartTodo](../journeys/smart-todo/README.md) |
| Rulesets and required checks | Nothing reaches `main`, including the agent's work, without a pull request and green checks. | [SmartTodo](../journeys/smart-todo/README.md) |
| Stacked pull requests | Small, reviewable layers that merge together. | [SmartTodo](../journeys/smart-todo/README.md) |

## Habits the journeys taught us

These come from the validation runs behind each journey's "Lessons from validation runs" section.

1. **Plan and price before you create anything.** Every deployment journey starts with a read-only plan and cost estimate, then a preview. Surprises are cheapest before `azd up`.
2. **The agent never changes the checks.** Tests, gates, and verifiers are yours. After any fix, `git diff` them. In one run, an agent "fixed" a failing deployment by moving the verifier's check to somewhere it would pass.
3. **Send the exact error.** Use each journey's "When something fails" prompt with the real command and the redacted output. Don't accept "contact support" until the agent has narrowed the failure to one resource or setting. In one run, "unusual activity" turned out to be a resource name prefix.
4. **Turn a repeated lesson into a script.** A prompt discovers how to do something, a skill repeats it, and a script checks it for free, in seconds, every time. The infrastructure gates are this idea in practice.
5. **Not every review comment needs code.** Fix what's real, decline what isn't with a one-line reason, and do one round.
6. **Clean up the same day.** Run `azd down --force --purge` when you finish a journey.

When a journey itself is wrong, not just your run of it, [report it](https://github.com/microsoft/agentic-journeys/issues/new?template=journey-failure.yml).
