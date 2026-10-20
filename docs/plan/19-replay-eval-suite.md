# Replay eval suite: the tasks that build it

This document lists the tasks that build the replay eval suite of [ADR 0085](../adr/0085-replay-evals-of-agent-delivery-from-merged-pull-requests-graded-by-their-hidden-tests-pnpm-check-and-a-calibrated-rubric.md). The ADR holds the decisions and the terms: eval task, variant, trial and comparison. Each task below is session work, test first, with the review before the pull request that `CLAUDE.md` describes.

## Before the first task

* [ADR 0084](../adr/0084-agent-sessions-in-auto-mode-inside-the-claude-code-sandbox-with-their-own-github-identity-and-the-maintainers-approval-on-main.md) is merged and its setup is done on the maintainer's machine, because trials and their grading run inside that sandbox.
* The maintainer creates the eval API key, sets its monthly credit limit at the provider and answers M-95 and M-96 in [16-open-questions.md](16-open-questions.md).

## Shape of the code

These are plan proposals; M-99 asks the maintainer to confirm them.

* `evals/` is a private workspace package, `@northmes/evals`, added to `pnpm-workspace.yaml`. It is not published and nothing in the product imports it.
* Root scripts run it: `pnpm evals:mine`, `pnpm evals:oracle`, `pnpm evals:run` and `pnpm evals:report`.
* The agent session and the judge both run through the `claude` command in headless mode, so the suite adds no model SDK dependency. The judge's session allows no tools.
* The grader runs its commands under the trial's sandbox settings. EV-05 picks the mechanism, for example a headless session of its own that only runs the grading commands.
* Results go to a folder that an environment variable names, in the maintainer's private repository. The harness refuses to start when the variable is missing or the folder is inside this repository.

## Tasks

| Id | Task | Blocked by | Tests first |
|---|---|---|---|
| EV-01 | Eval task manifests and the miner: `pnpm evals:mine` lists merged pull requests that change tests and source, close an issue over 300 characters and leave the lockfile and `pnpm-workspace.yaml` alone, and writes a manifest per pull request with the parent and merge shas, the proposed hidden set, the issue text as of the pull request's opening, the area, the size, the merge date and the `hard` tag | none | `evals/test/task-manifest.test.ts` |
| EV-02 | Variant manifests and the trial environment: a repository of one commit fetched over `file://`, the variant's agent files overlaid, a `CLAUDE_CONFIG_DIR` with the reviewed trial user settings, the listed session environment with the key through `apiKeyHelper` and the probe that no agent command can read it, `--permission-mode auto`, the refusal of a variant whose sandbox block differs from ADR 0084's, and `pnpm install --frozen-lockfile` before the session | none | `evals/test/trial-settings.test.ts` |
| EV-03 | The oracle run: `pnpm evals:oracle` checks that the hidden tests fail on the parent commit and pass on the merge commit three times in a row, that `pnpm check` passes on the merge commit, and records the merge commit's test count | EV-01, EV-02 | `evals/test/oracle.test.ts` |
| EV-04 | The trial runner: one headless session per trial with the variant's prompt, the 90-minute and turn limits, the transcript saved with the result, and a rerun when a session does not start | EV-02 | `evals/test/failures.test.ts` (the session cases) |
| EV-05 | The grader, inside the sandbox: the agent's commits applied to a fresh copy in a folder no trial can read, the hidden set copied over the agent's files, the parent's checks restored, Vitest files run one by one, the pull request's Playwright specs, `pnpm check` with the test count, the failed trial on a lockfile change, the grading rerun, and the contamination scan | EV-03, EV-04 | `evals/test/grade.test.ts`, `evals/test/failures.test.ts` (the grading cases) |
| EV-06 | The rubric and the judge: `evals/rubric.md` with the six criteria, the test-first script on the commit list, and the judge prompt with its fixed model and no tools | EV-05 | `evals/test/test-first.test.ts` |
| EV-07 | The run manifest and the report: `pnpm evals:report` with the overlay check, pass^3 and the tasks left out of it, the mean pass rate and its bootstrap interval, the rubric scores, cost and time, the cost and time cap, the infrastructure failure count, the flipped eval tasks, and the refusal to compare runs whose manifests differ outside the variant | EV-05 | `evals/test/report.test.ts` |
| EV-08 | The first eval task set: the maintainer reviews about 30 mined candidates and their hidden sets, stratified by area and size with the rework pull requests under 2,000 lines included, and the ones that pass the oracle run join as set version 1 | EV-03 | the oracle run on every eval task |
| EV-09 | The smoke tier: about 8 eval tasks at k = 1 under the setup on `main`, to check the harness end to end | EV-06, EV-07, EV-08 | none; the report is the outcome |
| EV-10 | The first baseline: a full run of set version 1 at k = 3 under the setup on `main`, with the rubric marked uncalibrated, kept as the reference for the next comparison | EV-09 | none; the report is the outcome |
| EV-11 | Judge calibration: the maintainer grades 20 trial results of the baseline by hand, and the judge is compared with his grades | EV-10 | `evals/test/judge-calibration.test.ts` |

EV-01 and EV-02 can run in parallel, and so can EV-06 and EV-07 once EV-05 is merged.
