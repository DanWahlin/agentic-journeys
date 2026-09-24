---
name: grill-plan
description: |
  Interview the user about an issue or plan before any code is written, one question at a time, until the decisions and the test list are clear. Turns a plan into a Decisions table and a behavior-to-test list for red/green TDD.
  USE FOR: grill me, grill the plan, stress-test a plan, plan interview, clarify an issue before coding, find ambiguous requirements, decide defaults before implementation.
  DO NOT USE FOR: writing code or tests (use the tdd-builder agent), reviewing finished code (use /review), or creating new journeys (use journey-template).
---

# Grill the Plan

Find the decisions a plan leaves open before an agent fills them in silently. The output is a short list of decisions and the tests that will prove them.

## Process

1. **Read first.** Read the issue and every plan document and section it links to. Do not ask questions the plan already answers.
2. **Mandatory questions.** If a linked plan has a `Decision Points` section, ask about every item in it. Each item lists a default. Offer that default as the first, recommended option.
3. **Your own questions.** Then ask up to three more questions about gaps you found yourself. Good targets are boundary values, failure paths, what happens to related data, and how each acceptance criterion will be tested. Skip questions whose answer would not change the code or the tests.
4. **One at a time.** Ask each question with the ask-user tool. Include two to four options, put the recommended default first, and add one sentence on why the choice matters. If the user says "use the defaults", accept every remaining default and stop asking.
5. **Summarize.** When the questions are done, print:
   - A `Decisions` table with the columns Question, Decision, and Default or changed.
   - A `Test list` with one row per behavior (Behavior, Plan section, Proposed test name). The tdd-builder agent writes these tests in the red phase.
   - Anything still unresolved.
6. **Record it.** When the user asks, post the summary as a comment on the issue with `gh issue comment <number> --body-file <file>`. Write the body to a temporary file first so the command works in PowerShell, Command Prompt, bash, and zsh. Delete the temporary file afterward.

## Non-interactive sessions

If the ask-user tool isn't available, as in `copilot -p` or a cloud agent session, don't pretend an interview happened. Apply the recommended default for every question, mark each plan Decision Point row in the `Decisions` table as `Default (not asked)` and each question you raised yourself as `Agent recommendation (not asked)`, and start the summary with one sentence saying that the interview ran non-interactively.

## Rules

- Do not write application code or tests.
- Do not add requirements the plan and issue do not support. If you think one is missing, ask about it as a question.
- If the issue and the plan conflict, ask which one wins.
- Keep each question under 60 words.
