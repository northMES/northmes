# Replay eval suite: the tasks that build it

This document lists the tasks that build the replay eval suite of [ADR 0085](../adr/0085-replay-evals-of-agent-delivery-from-merged-pull-requests-graded-by-their-hidden-tests-pnpm-check-and-a-calibrated-rubric.md). The ADR holds the decisions and the terms: eval task, variant, trial and comparison. Each task below is session work, test first, with the review before the pull request that `CLAUDE.md` describes.

## Before the first task

* [ADR 0084](../adr/0084-agent-sessions-in-auto-mode-inside-the-claude-code-sandbox-with-their-own-github-identity-and-the-maintainers-approval-on-main.md) (pull request 740) is merged and its setup is done on the maintainer's machine, because a trial runs inside that sandbox.
* The maintainer creates the eval API key and sets its cost cap at the provider.

## Shape of the code

`evals/` is a private workspace package, `@northmes/evals`, added to `pnpm-workspace.yaml`. It is not published and nothing in the product imports it. Root scripts run it: `pnpm evals:mine`, `pnpm evals:oracle`, `pnpm evals:run` and `pnpm evals:report`. The agent session and the judge both run through the `claude` command in headless mode, so the suite adds no model SDK dependency. Results are written to a folder named by an environment variable that points into the maintainer's private repository. The harness refuses to start when that variable is missing or the folder is inside this repository.

## Tasks

| Id | Task | Blocked by | Tests first |
|---|---|---|---|
| EV-01 | Eval task manifests and the miner: `pnpm evals:mine` lists merged pull requests that change tests and source and close an issue over 300 characters, and writes a manifest per pull request with the parent and merge shas, the hidden test paths, the issue text as of the pull request's opening, the area, the size, the merge date and the `hard` tag | none | `evals/test/task-manifest.test.ts` |
| EV-02 | Variant manifests and the trial environment: a shallow clone at the parent commit outside the main checkout, `origin` removed, the variant's agent files overlaid, a fresh `CLAUDE_CONFIG_DIR` with the trial user settings, and `pnpm install --frozen-lockfile` before the session | none | `evals/test/trial-settings.test.ts` |
| EV-03 | The oracle run: `pnpm evals:oracle` checks that the hidden tests fail on the parent commit and pass on the merge commit three times in a row, and that `pnpm check` passes on the merge commit | EV-01, EV-02 | `evals/test/oracle.test.ts` |
| EV-04 | The trial runner: one headless session per trial with the variant's prompt, the 90-minute and turn limits, the transcript saved with the result, and the infrastructure failure rules with one rerun of the failed step | EV-02 | `evals/test/failures.test.ts` |
| EV-05 | The grader: the agent's commits applied to a fresh copy, the hidden tests copied over the agent's files, Vitest files run one by one, the pull request's Playwright specs, `pnpm check`, the reinstall after a lockfile change, and the contamination scan | EV-04 | `evals/test/grade.test.ts` |
| EV-06 | The rubric and the judge: `evals/rubric.md` with the six criteria, the test-first script on the commit list, and the judge prompt with its fixed model | EV-05 | `evals/test/test-first.test.ts` |
| EV-07 | The run manifest and the report: `pnpm evals:report` with pass^3, the mean pass rate and its bootstrap interval, the rubric scores, cost and time, the infrastructure failure count, the flipped eval tasks, and the refusal to compare runs whose manifests differ outside the variant | EV-05 | `evals/test/report.test.ts` |
| EV-08 | The first eval task set: the maintainer reviews about 30 mined candidates, stratified by area and size with every rework pull request included, and the ones that pass the oracle run join as set version 1 | EV-03 | the oracle run on every eval task |
| EV-09 | Judge calibration: a smoke tier of about 8 eval tasks at k = 1 under the current setup, the maintainer grades 20 trial results by hand, and the judge is compared with his grades | EV-06, EV-08 | `evals/test/judge-calibration.test.ts` |
| EV-10 | The first baseline: a full run of set version 1 at k = 3 under the setup on `main`, kept as the reference for the next comparison | EV-07, EV-09 | none; the report is the outcome |

EV-01 and EV-02 can run in parallel, and so can EV-06 and EV-07 once EV-05 is merged.

## Open points for the maintainer

These are the parts of ADR 0085 that its `needs-confirmation` names: the cost and wall-clock cap per comparison, the 90-minute agent limit with the turn limit and the 30-minute grading limit, concurrency 2 on his machine, the commit order rule for the test-first criterion, and `evals/` as a private workspace package.
