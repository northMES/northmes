---
status: "proposed"
date: 2026-10-20
decision-makers: Krister Johansson
consulted: Anthropic engineering posts "Demystifying evals for AI agents", "Infrastructure noise" and "Harness design for long-running apps", and the April 23 postmortem; a survey of the 222 pull requests merged from 2026-10-05 to 2026-10-20
informed: contributors and coding agents
release: "1"
needs-confirmation: "maintainer (the cost and wall-clock cap per comparison on the eval API key; the 90-minute agent limit, the turn limit and the 30-minute grading limit; concurrency 2 on the maintainer's machine; the commit order rule for the test-first criterion; evals/ as a private workspace package under the repository's license)"
---

# Replay evals of agent delivery from merged pull requests, graded by their hidden tests, pnpm check and a calibrated rubric

## Context and problem statement

Coding agents deliver most of NorthMES as Claude Code session work and session workflows: test first, a fresh-context review before the pull request ([ADR 0065](0065-coderabbit-check-run-and-a-required-approval-on-main.md)), CI and CodeRabbit. What they do depends on files that change every week (`CLAUDE.md`, `AGENTS.md`, the skills in `.claude/skills/`, the session workflow prompts) and on the model. Nothing measures whether such a change makes delivery better or worse. handoff's weekly metrics log in [docs/agents/handoff/README.md](../agents/handoff/README.md) was designed for that and has no rows, and handoff is paused.

Live delivery cannot answer the question either: every task is different, each is delivered once, and a change to the setup lands between tasks, so a better or worse week says nothing about the change. A comparison needs the same tasks delivered under two setups, several times each, on a fixed machine.

This ADR decides how NorthMES measures agent delivery: where the eval tasks come from, what a trial runs and sees, how a trial is graded, what a comparison reports and how infrastructure noise is kept apart. It covers a new `evals/` folder in the repository, the trial settings on top of the sandbox of [ADR 0084](0084-agent-sessions-in-auto-mode-inside-the-claude-code-sandbox-with-their-own-github-identity-and-the-maintainers-approval-on-main.md), and the run results in the maintainer's private repository. It builds nothing in the product.

The words this ADR uses:

* An eval task is one merged pull request turned into a replayable job: its parent commit, its issue text and its hidden tests. It is not a handoff task or a GitHub issue.
* A variant is the agent setup under test: a manifest of agent configuration files, the trial prompt and the model id with its effort.
* A trial is one agent session that delivers one eval task under one variant, followed by its grading.
* A comparison runs every eval task k times under a baseline variant and under a candidate variant, and reports both.

## Decision drivers

* A change to an instruction, skill, workflow or model must be comparable before it lands, on the same tasks.
* Agents are not deterministic, so one trial per task says little; a regression that shows up one time in three still costs rework.
* The grade must come from what NorthMES already trusts: its tests and `pnpm check`, plus the review points those cannot catch.
* An eval run must not leak the answer to the agent through git history, GitHub or the web.
* Infrastructure noise (a container that does not start, an API outage, a slow machine) must not count as an agent failure, and must not move between the two variants.
* The suite has to run on the maintainer's machine inside the boundary that ADR 0084 sets, with a cost that stops at a cap.

## Considered options

* Replay eval tasks from merged pull requests, graded by their hidden tests, `pnpm check` and a calibrated rubric
* Measure live delivery: the weekly metrics log, or outcome statistics of merged pull requests
* A public benchmark of coding tasks
* Eval tasks written for the suite

## Decision outcome

Chosen option: "Replay eval tasks from merged pull requests, graded by their hidden tests, `pnpm check` and a calibrated rubric", because it measures the work agents actually do in this repository, with a reference solution and its tests already written and reviewed, and it lets two variants run the same tasks under the same conditions.

1. **Purpose.** The suite compares two variants on demand: before a change to the agent setup merges, and when a new model is adopted. It runs on no schedule. The latest baseline result is kept as the reference for the next comparison.
2. **Variant.** A trial takes product code, ADRs, plan and glossary from the eval task's parent commit, and overlays the variant's agent configuration on it: `CLAUDE.md`, `AGENTS.md`, `.claude/` (skills, settings, agents) and `docs/agents/`. A variant manifest in `evals/variants/` lists those files by source commit or path, the trial prompt, the model id and the effort. The manifest's hash names the variant in every result.
3. **Delivery path.** A trial runs one headless Claude Code session that follows the `CLAUDE.md` flow up to the point where `pnpm check` passes and the fresh-context review's findings are handled. It does not push, open a pull request or reach CodeRabbit. The session ends when the agent reports done or a limit runs out: 90 minutes of wall clock or the variant's turn limit.
4. **Agent input.** The agent gets the issue title and body as they were when the pull request opened, taken from the issue's edit history, without comments, wrapped in the trial prompt of the variant: "Deliver this issue as CLAUDE.md describes. Stop when pnpm check passes and the review findings are handled. Do not push." The pull request's tests stay hidden. The agent writes its own, test first, as `AGENTS.md` requires.
5. **Isolation.** A trial runs in a shallow clone at the parent commit, outside the main checkout, with `origin` removed. It uses the sandbox of ADR 0084 through the variant's `.claude/settings.json`, and its own `CLAUDE_CONFIG_DIR` with no memory, no plugins and user settings that copy the maintainer's ADR 0084 user settings with two changes: the GitHub hosts leave the network allowlist, and `WebFetch` and `WebSearch` are denied. The trial has no GitHub token and no `.claude/settings.local.json`. Because `pnpm install` fails inside the sandbox ([#739](https://github.com/northMES/northmes/issues/739)), the harness runs `pnpm install --frozen-lockfile` before the session starts; a trial whose agent changes the lockfile is installed again by the harness, outside the sandbox, before grading.
6. **Grading.** The grader works outside the sandbox on a fresh copy of the parent commit with the agent's commits applied. It copies the hidden tests over the agent's files at the same paths, keeping the agent's versions for the rubric, and runs them: every test file the pull request added or changed, in every Vitest project, file by file, and the pull request's Playwright specs through `pnpm e2e` limited to those specs. Then it runs `pnpm check`. A trial passes when all three hold: every hidden test passes; `pnpm check` passes with the hidden tests in place, which also covers the tests that passed before (pass to pass); and the trial stayed inside its limits and did not reach the future (rule 9). The grading time limit is 30 minutes.
7. **Rubric.** Six pass/fail criteria, each defined in one line in `evals/rubric.md`, are scored next to the pass and are not part of it:
   * it builds at the seam the issue names and stays inside the issue's scope;
   * it follows the ADRs the issue links;
   * each behaviour the issue names has a test, and the test came first: a script checks the agent's commit list for a `test:` commit that adds the failing test before the commit that changes the source;
   * its names use the terms of [GLOSSARY.md](../../GLOSSARY.md);
   * it keeps the security rules of `AGENTS.md`;
   * the diff has no dead, duplicated or unexplained code.

   A fixed judge model with a fixed prompt grades the five criteria other than test-first. It sees the issue, the linked ADRs, the agent's diff and commit list, and the merged pull request's diff as a reference. The judge counts as calibrated when, on 20 trial results the maintainer grades by hand with the same criteria, it agrees with him on at least 85% of the verdicts and on no criterion below 75%. A criterion below that is rewritten or dropped. Calibration is repeated when the judge model, its prompt or the rubric changes.
8. **Eval tasks.** The eval tasks come from merged pull requests that change tests together with source and close an issue with a body over 300 characters (122 of the 222 merged by 2026-10-20). The first set has about 30, stratified by area (apps, modules, packages, repository tooling) and by size, with nothing over 2,000 changed lines. Every pull request that needed rework (a later fix pull request names it, or CodeRabbit requested changes at least three times) is included and tagged `hard`. A pull request joins only after its oracle run passes in the trial environment: the hidden tests fail on the parent commit and pass on the merge commit three times in a row, and `pnpm check` passes on the merge commit. An eval task's manifest in `evals/tasks/` records the parent and merge shas, the hidden test paths, the issue text, the area, the size, the merge date and the `hard` tag. The set grows from newly merged pull requests.
9. **Contamination.** The grader scans the session transcript and the agent's commands for the pull request's number, its branch name and its merge sha, for any request to a GitHub host, and for a container that reaches the network (the Docker socket gets around the sandbox proxy, risk A-07 of ADR 0084). A hit makes the trial invalid. Each result flags eval tasks merged before the model's published training cutoff, because the public repository may be in a later model's training data, and when a new model's cutoff passes most of the set, the set is refreshed with newer pull requests.
10. **Infrastructure failures.** An infrastructure failure is a step outside the agent's control that fails: Docker or a Testcontainers container that does not start, the harness's `pnpm install`, an API error that outlasts Claude Code's own retries, a grading step that runs out of memory or exceeds the grading limit, and a sandbox that is not available. The agent running out of its wall-clock or turn limit is a task failure. An infrastructure failure gets one rerun of the step that failed: grading reruns grading, and a session that failed to start reruns the trial. A second failure leaves the trial out of the denominator, and the report counts it. A comparison where more than 10% of the trials failed on infrastructure is void.
11. **Constants.** Every run writes a run manifest: the machine (model, CPU, memory), Docker Desktop's CPU and memory limits, the concurrency, the Claude Code version, the model id and effort, the judge model, the Node and pnpm versions, the eval task set version and the variant hash. Concurrency is 2 trials at once. The report refuses to compare two runs whose manifests differ in anything other than the variant.
12. **Report.** Per variant, the report gives pass^k with k = 3 (the share of eval tasks whose three trials all pass), the mean pass rate per trial with a 95% bootstrap interval over eval tasks, the rubric score per criterion, cost and time per trial, and the infrastructure failure count. Per eval task, it puts the baseline and candidate results side by side and lists the tasks that flipped. The harness gives no verdict. The maintainer decides, and when the intervals overlap the report says that the difference may be noise. With about 30 eval tasks, one or two flipped tasks are within noise.
13. **Cost.** The harness runs on its own API key, and the cost and wall-clock cap per comparison sits on that key, at the provider, as [ADR 0042](0042-ai-in-tests-mocked-by-default-opt-in-live-runs.md) does for live AI tests. A smoke tier of about 8 eval tasks at k = 1 runs before a full comparison.
14. **Where things live.** The harness, the eval task manifests, the variant manifests, the trial settings and the rubric live in the public repository under `evals/`. The tasks come from public pull requests, and the harness is development tooling. Run results, transcripts and the maintainer's calibration grades live in the maintainer's private repository, because a transcript can hold whatever the agent read on the machine.

### Consequences

* Good, because a change to the agent setup gets a paired before and after result on the same eval tasks, under the same machine, model and concurrency.
* Good, because pass^3 shows a regression that fails one trial in three, which one trial per task and live delivery both hide.
* Good, because the grade rests on the hidden tests and `pnpm check` that NorthMES already trusts, and the rubric covers the scope, ADR and naming points that tests cannot see.
* Good, because infrastructure failures are counted apart, so a flaky container start does not show up as a worse variant.
* Bad, because a comparison of 30 eval tasks, k = 3 and two variants is 180 trials, each one an agent session plus a grading of about the length of a CI run (5 to 6.5 minutes on main), which takes days of machine time and real model spend.
* Bad, because hidden tests reward the merged pull request's shape: an agent that solves the issue with other names than the issue gives fails. The oracle run and curation keep only eval tasks whose issue names the seam the tests use, which leaves out some real work.
* Bad, because about 30 eval tasks cannot separate small differences, and the report has to say so.
* Bad, because the trials share the maintainer's machine and Docker with his own sessions, so a comparison runs when nothing else needs them.
* Neutral, because handoff's weekly metrics log stays as it is: the suite does not fill it or replace it.

### Confirmation

Each item is a test that the task building the piece carries.

* `evals/test/task-manifest.test.ts`: "an eval task manifest without a parent sha, a merge sha, hidden test paths or the issue text is refused"; "the issue text is the body as of the pull request's opening, not the current body".
* `evals/test/trial-settings.test.ts`: "the trial user settings allow no GitHub host and deny WebFetch and WebSearch"; "a trial has no GitHub token and no settings.local.json"; "the trial's sandbox block equals the variant's project sandbox block".
* `evals/test/grade.test.ts`: "a trial passes only when every hidden test and pnpm check pass"; "a hidden test replaces the agent's file at the same path and the agent's version is kept"; "a trial whose transcript names the merge sha is invalid".
* `evals/test/test-first.test.ts`: "a commit list with a test: commit before the source commit passes the test-first criterion"; "a source commit before any test commit fails it".
* `evals/test/oracle.test.ts`: "an eval task whose hidden tests pass on the parent commit is refused"; "an eval task that passes two oracle runs of three is refused as flaky".
* `evals/test/failures.test.ts`: "a container that does not start during grading is an infrastructure failure and grading reruns once"; "an agent that runs out of its time limit is a task failure"; "a comparison with more than 10% infrastructure failures is void".
* `evals/test/report.test.ts`: "pass^3 counts an eval task only when its three trials pass"; "the report refuses two runs whose manifests differ outside the variant"; "the report lists every eval task that flipped".
* `evals/test/judge-calibration.test.ts`: "a judge below 85% overall or 75% on one criterion against the hand grades is not calibrated".

## Pros and cons of the options

### Replay eval tasks from merged pull requests, graded by their hidden tests, `pnpm check` and a calibrated rubric

* Good, because every eval task is real NorthMES work with a reviewed solution and tests.
* Good, because the same eval tasks run under both variants, so the difference belongs to the variant.
* Good, because it needs no new task writing: the merged history supplies the set and keeps adding to it.
* Bad, because a trial is expensive, and a comparison takes days.
* Bad, because the history is short and only six pull requests have a fix pull request that names them, so the `hard` subset is small.

### Measure live delivery: the weekly metrics log, or outcome statistics of merged pull requests

* Good, because it costs nothing beyond the delivery that happens anyway.
* Bad, because each week's tasks differ, so a change in the numbers cannot be put on the change to the setup.
* Bad, because each task is delivered once, so flakiness does not show.
* Bad, because session commits carry no attribution trailer, and git and GitHub data cannot tell 136 of the 222 merged pull requests apart by author.

### A public benchmark of coding tasks

* Good, because it exists, with a harness and published scores.
* Bad, because it measures general coding, not NorthMES's ADRs, skills, glossary and test-first rules, which are what the variants change.
* Bad, because public benchmarks are likely in a model's training data.

### Eval tasks written for the suite

* Good, because each task can target one rule or skill exactly.
* Bad, because every task and its tests have to be written and reviewed, which is the work the agents are there to do.
* Bad, because hand-written tasks drift from the work the repository actually gets.

## More information

* Related ADRs: [0042](0042-ai-in-tests-mocked-by-default-opt-in-live-runs.md) (the provider-side cap for live model calls), [0065](0065-coderabbit-check-run-and-a-required-approval-on-main.md) (the review before the pull request), [0084](0084-agent-sessions-in-auto-mode-inside-the-claude-code-sandbox-with-their-own-github-identity-and-the-maintainers-approval-on-main.md) (the sandbox a trial runs in; this ADR merges after it).
* The tasks that build the suite are in [19-replay-eval-suite.md](../plan/19-replay-eval-suite.md).
* handoff's weekly metrics log in [docs/agents/handoff/README.md](../agents/handoff/README.md#weekly-metrics) measures live handoff runs and stays as it is while handoff is paused.
* Revisit when the eval task set passes 50, when a variant comparison has to run more often than the machine allows, when the sandbox of ADR 0084 changes, or when the judge's calibration fails twice in a row.
