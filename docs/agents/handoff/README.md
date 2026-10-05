# How NorthMES uses handoff

This page describes the maintainer's workflow. Contributors do not need handoff: they open issues with the GitHub issue forms and send pull requests, as [the issue tracker page](../issue-tracker.md) describes.

The maintainer builds planned NorthMES tasks with handoff: each run takes one task issue through a graph of agents and checks, from a plan to a squash-merged pull request. NorthMES has three graphs in `graphs/`. An operating Claude Code session starts every run and picks its graph, and the routine graph moves from the first to the last as the foundation settles:

| Graph | Krister approves | Merge | Use it for |
|---|---|---|---|
| `northmes-guided` | the plan, the code, Try it for UI changes, the merge | manual, when Krister requests it | the foundation, new patterns, tasks labelled `human` |
| `northmes-standard` | the plan | automatic | optional middle rung |
| `northmes-lean` | nothing by default | automatic | routine tasks once the switch criteria below hold |

In every graph a person also steps in when an agent asks a question, when a step fails or a loop runs out of rounds, and when a step asks permission for a tool call. The operating session brings each of these to Krister, and only Krister answers questions and permission requests.

## The plan

The plan lives on the GitHub Project that handoff's `setup_plan` links to the repository. See [the issue tracker page](../issue-tracker.md) for how issues are shaped.

- Plan mode is Flow: the plan is an order of tasks and their blockers, with no dates and no sizes. Stories and tasks carry no Size; the Flow order, the blockers and each task's Status show progress. `setup_plan` still adds a Size field to the Project; leave it empty and call `create_task` without `size`. Each epic keeps its estimate in raw days as planning information, in the epic issue and in [14 roadmap](../../plan/14-roadmap.md); the weekly ledger counts merged tasks against it.
- The Flow view shows progress, not estimates. handoff draws every card without a size at the same default length. The planner instructions leave the planner's size proposal out, so no card shows a proposed size either. A running card fills with the share of its graph's steps that have passed, for example "5 of 13 steps". The count includes the question gates and Try it, which most runs never visit, so a run seldom shows every step done before it merges.
- Labels: `epic`, `story` and `task` mark the kind of issue. `human` marks a task that runs only on the guided graph, or that a person works in a session (see "Tasks that stay guided"). `setup_plan` creates only `epic`, `story` and `task`, and no handoff tool sets other labels, so create `human` on GitHub and add it there, for example `gh issue edit 123 --add-label human`.
- Status: everything starts in Shaping. Only Krister moves a task to Ready, with `move_to_ready` or on the board. handoff sets Running when a run starts, In review when the pull request opens and Done when it merges; a cancelled run puts the task back where it was.
- Milestones: one GitHub milestone per release, created on GitHub, because handoff cannot create, edit or close one. Release 1 is milestone `Release 1`. Pass `milestone` to `create_epic`, or call `set_milestone` on the epic; its stories and tasks inherit it in handoff, and `list_plan` names the epic under `inherited_from`. Set a milestone on a story or task only when it ships in a different release than its epic. The inheritance exists only in handoff, so GitHub's milestone page counts the epics alone. The scheduler does not order by milestone; the Project order decides when a release's tasks run.
- Order: Project order. Use `arrange_plan` to preview an order and `set_order` to write it.
- Plan budget (Project settings, Plan budget): keep 15 files and 12 steps. handoff tells only the planner the budget, so the plan reviewer's instructions in all three graphs name these two numbers; change the text if the budget changes.

## Pacing runs

handoff's scheduler is not used. An operating Claude Code session with handoff's MCP tools paces the work:

1. It reads the plan with `list_plan` and `list_backlog` and picks the next Ready task, in Project order, that has no open blocker. Tasks labelled `design` or `spike`, the E00 and E01 tasks, each epic's "docs: record the Enn plan and ADRs" task, and any other task whose issue says a person works it in a session go to Krister; the session starts no run for them.
2. It picks the graph for that run (see "Switching graphs") and starts it with `start_run({ issues: [n], graph: "<graph>" })`. It always passes `graph`, because without it `start_run` uses the graph of the project's latest run.
3. It follows the run with `get_run`, `get_run_events` and `list_attention`, and brings every question, paths question, permission request, failed step, loop that ran out and merge decision to Krister. It answers a gate, a question or a permission request only with Krister's decision, and repairs, resolves or cancels a run only when Krister says so.
4. It keeps one run active at first, and two after two runs have finished without a collision on owned paths.
5. It batches gate questions so Krister answers gates in two batches a day.
6. It checks that CodeRabbit reviewed each new commit of a run's pull request. The pull request step asks by itself (see "Before the first run"); the session posts `@coderabbitai review` only on pull requests it opens itself.
7. Before it starts the run of a UI task, and again before Krister answers its plan gate where the graph has one, it compares the approved etag in the issue's Design section with the design project's current etag, and brings a mismatch to Krister.

### Where run rules live

`AGENTS.md` and `CLAUDE.md` hold the rules for any contributor's agent and say nothing about handoff. The rules for handoff runs live in the project's agent notes in handoff (the text is in the Project settings table of [13 delivery and GitHub](../../plan/13-delivery-and-github.md#project-settings)) and in the node instructions in the graph files. The maintainer's instructions for the operating session are private and stay out of the repository.

## The graphs

All three graphs share the planner and coder instructions, the Tester and the pull request settings. Each loop that sends work back has a limit; when a loop runs out, the run stops with "ran out of rounds" and waits for `resolve_loop` (retry, continue or stop). None of the graphs sets an exhausted gate.

Each Claude step sets its own `effort` (Claude Code's `--effort`); no node sets `model`, so the worker's default model runs every step:

| Node | `effort` |
|---|---|
| Plan | `high` |
| Review the plan | `medium` |
| Code test first | `xhigh` in `northmes-guided`, which gets the foundation and new patterns; `high` in the other two |
| Code review | `medium` (the code-review skill's own `level` stays `high`) |
| Demo | `medium` |

The node instructions follow the Claude Opus 5 prompting guide:

- They say what to do rather than what to avoid.
- The planner and the coder deliver what the issue asks at its scope, ask only when readings of it lead to materially different work, and note follow-ups: the planner in its plan, the coder in the pull request description.
- Both reviewers report every finding with its severity, and the verdict follows from the severities.
- Review is its own step, so no instruction asks an agent to check its work a second time. `pnpm check` in the coder's instructions is the gate that ADR 0058 requires.
- The coder has no Agent tool, so its instructions say nothing about subagents.

### northmes-guided

| Step | Node type | What it does |
|---|---|---|
| Plan | `planner` | Plans what the issue asks, one behaviour at a time: one step writes the failing test (file, test name, why it fails), the next makes it pass. Names the test for each acceptance criterion and puts tests, migrations, generated files and lockfiles in the owned paths. Returns a question when neither the issue nor an ADR decides, or when readings of the issue differ materially. Leaves the size proposal out. |
| Answer the planner | `human_gate`, question | Krister answers the planner's question; the answer goes back to the planner. |
| Review the plan | `reviewer` | An agent reports every finding with its severity. It blocks code before its test, a step with two behaviours, a criterion without a test, a test at the wrong seam, a database test outside `packages/testing`, a conflict with an ADR, missing owned paths, a step for behaviour the issue does not ask for, and a plan over 15 files or 12 steps that does not split. Sends the plan back up to 2 times. |
| Approve the plan | `human_gate`, approval | Krister checks the test list, the seam and the owned paths, and accepts or rejects a proposed split. Answers: approve, changes, or approve after fixes. |
| Code test first | `coder` | Writes and commits each failing test with a `test:` subject, then the code, then refactors, and runs `pnpm check` before it finishes. Contract checks run after every attempt: `diff_within_paths` (when it is the only failed check, files outside the plan raise a paths question for Krister) and `node scripts/handoff/tests-changed.mjs` (fails when source changed and no test did). A failed tests-changed check fails the step, so Krister sees every run that skipped the test and repairs it with a note. |
| Answer the coder | `human_gate`, question | Krister answers the coder's question. |
| Test | `tester` | `pnpm check`, the one gate command ([ADR 0058](../../adr/0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md)), 20 minute timeout, one retry for a flaky run. A failure goes back to the coder with the output tail, up to 3 times. |
| Code review | `code_review`, level `high` | Claude Code's code-review skill with the NorthMES blocking rules (acceptance criteria and scope, tests, RLS with split policies and no `FORCE ROW LEVEL SECURITY`, audit, command pipeline, module boundaries, GraphQL nullability and prefixes, shared singletons, accessibility, tokens, ADRs). Reports every finding with its severity; blocking findings go back up to 3 times. |
| Approve the code | `human_gate`, approval | Krister reads the diff with the review's findings. "Approve after fixes" sends the chosen findings back and lets the fixed work through without asking again. Every fix round from the pull request step comes back through this gate (and Try it for a UI change); an approval holds without a new question only while the run's own change is the same (a merge from `main` alone keeps it). |
| Demo | `demo`, only for UI changes | Starts the app from `.claude/launch.json` (`handoff-demo`) and takes a screenshot per acceptance criterion. A browser console error fails it. A change outside the UI paths skips it and goes straight to the pull request. |
| Try it | `human_gate`, try | Krister marks each criterion as working or not in the running app, with a keyboard pass and both themes. |
| Pull request | `pr` | Pushes, opens the pull request with `Closes #N`, waits for CI and for a review from `coderabbitai[bot]` on the head commit (up to 30 minutes), then sends failed job logs, unresolved threads and non-approval review summaries back to the coder, up to 3 times. |
| Merge | `merge`, manual, squash | Waits in handoff's merge queue until Krister requests the merge (dashboard or `request_merge`). A branch that is behind or conflicts with `main` goes back to the pull request step, up to 3 times. Closes the task and sets Done. |

### northmes-standard

The guided plan half (plan, plan review, plan gate) followed by the automatic back half of the lean graph. Krister decides what gets built; the code goes through without waiting for Krister. The planner can still propose a split, because a plan gate follows it.

### northmes-lean

| Step | Differs from guided |
|---|---|
| Review the plan | No plan gate follows, so the planner cannot split. The reviewer also blocks a plan over 15 files or 12 steps, a plan that needs a product, legal or design decision the issue does not record, and a plan that adds a pattern the issue and ADRs do not name. Two send-backs, then the run stops for Krister. |
| Code test first | Contract check `diff_within_paths` only. Files the coder declares in `extraPaths` with a reason pass; any other file outside the plan raises a paths question. |
| Tests came first | A `tester` node that runs `node scripts/handoff/tests-changed.mjs`. A failure goes back to the coder, up to 2 times, instead of failing the run. |
| Test | Up to 2 send-backs. |
| Code review | Level `high`, up to 2 send-backs. Told that nobody reads the code after it, so it grades each finding as blocking (fix before the merge) or follow_up (another issue). |
| Demo for the PR | Runs only for UI changes. Its screenshots go into the pull request description (handoff pushes them to the `handoff-assets` branch). No Try it gate. |
| Pull request | Same settings as guided. |
| Merge | `auto`, squash, with a notification on each merge. Merges when the pull request is first in handoff's queue and its step reported CI green and no changes requested. |

A person is involved in a lean run only when:

- the planner or the coder asks a question (question gates);
- the coder touched files outside the plan without declaring them (paths question);
- a step asks permission for a tool call outside its allowed tools;
- a step fails, or a loop runs out after its automatic rounds; the operating session brings the run to Krister, who repairs, resolves or cancels it;
- the task carries `human`, so the operating session runs it on the guided graph or leaves it to a person.

### What handoff cannot express, and the shape used instead

- Merge only after CodeRabbit approves. The pull request step waits for a review from `coderabbitai[bot]` on the head commit for `reviewTimeoutMinutes` (30) and then continues without it. Its `ready` port needs CI success and no requested changes. `requireApproval` stays off: it would wait for an approval with no time limit, and the `main` ruleset already refuses a merge without one ([ADR 0065](../../adr/0065-coderabbit-check-run-and-a-required-approval-on-main.md)). The weekly log counts `github.reviewers_timeout` events so a merge without a CodeRabbit review is visible. The other direction is stricter: handoff takes the review decision from GitHub, and while GitHub reports CodeRabbit's request for changes (`request_changes_workflow`) as the decision, the `ready` port stays closed until CodeRabbit approves a later commit or someone posts `@coderabbitai approve`. Each round in between goes back to the coder and uses one of the `fix` loop's 3 rounds; when they run out, the run stops.
- "A person only after a run fails twice." handoff has no run-level retry counter. Rate limits and timeouts retry by themselves, and a coder that ran out of turns with work committed continues once; other failed steps stop the run at once. The closest shape is a limit on each loop: the lean graph gives the coder 2 automatic rounds per check (3 for the pull request, which mixes CI and CodeRabbit), and the next failure stops the run.
- Retrying the coder after a failed contract check. The graph editor never connects a node to itself, so the lean graph moves the tests-changed check into its own tester node, whose `fail` port is a normal bounded loop.
- Two edges from the demo to the pull request (one for `done`, one for `skipped`). A graph holds at most one edge between two nodes; `compileGraph` throws on a second. The lean and standard graphs use one edge without a port and with the condition `{"always": true}`. The editor keeps such an edge as a custom route.
- Reading the `human` label inside a graph. Conditions cannot test whether a list contains a value, so the operating session reads the label before it starts a run and passes the guided graph.
- Library skills and MCP servers. The planner and coder nodes name the skills `tdd` and `codebase-design` and the MCP server `context7` under `library`; the coder also names `vitest`, `pnpm`, `turborepo`, `apollo-client` and `playwright-cli`; the plan reviewer names `context7`; the code review node names `wrdn-authz` and `secret-serialization`. Runs pass `--strict-mcp-config`, so a node gets no other MCP server. A node that names something the library does not have fails, so a new skill is imported first (Settings, Library, or `pnpm handoff library import-repo northMES/northmes --group northmes` from the handoff checkout) and the graphs are imported again afterwards, with `northmes-guided` last so it stays the default.

## Before the first run

The graphs assume these exist on `main`:

- the root `pnpm check` script, the one gate command of [ADR 0058](../../adr/0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md) (the Node major assertion, turbo `lint` and `typecheck`, `pnpm gen --check`, then Vitest over the `unit`, `integration`, `web` and `types` projects), and `pnpm test:handoff` as an alias that runs it, so a graph version imported before the switch to `pnpm check` runs the same gate;
- `scripts/handoff/tests-changed.mjs`, which runs `git diff --name-only origin/main...HEAD` and exits 1 when a non-generated file under `modules/`, `packages/` or `examples/` changed (generated: `*.gen.*`, schema snapshots, link snapshots and `pnpm-lock.yaml`) and no `*.test.ts`, `*.test.tsx`, `*.int.test.ts` or `*.test-d.ts` file did. Until it exists, the three graphs run the check as `[ ! -f scripts/handoff/tests-changed.mjs ] || node scripts/handoff/tests-changed.mjs`, so a run passes it; E00-S06-T01 adds the script and removes the guard;
- `packages/testing` with the Testcontainers global setup, and one unit and one integration test that pass, so the first Tester run starts green;
- `.claude/launch.json` with a `handoff-demo` configuration before the first UI task;
- `.coderabbit.yaml` with incremental reviews on (`reviews.auto_review.auto_incremental_review: true`). The pull request step waits for a review of the head commit, so a push after a fix needs a new review or the step waits the full 30 minutes.

handoff project settings: the setup command, agent notes, UI paths (`apps/web/**`, `modules/*/web/**`, `packages/ui/**`, `packages/web-sdk/**`) and the demo seed command, with the values in the Project settings table of [13 delivery and GitHub](../../plan/13-delivery-and-github.md#project-settings). `setup_project` reports what is missing.

handoff's support for repositories and Projects owned by a GitHub organization is built and checked (spike SP0). The repository moved to the `northMES` organization on 2026-10-05 and is named `northmes`. `add_project` adds `northmes/northmes` directly, `setup_plan` creates or adopts the plan's Project under the organization, and `pnpm dev:webhooks northmes/northmes` relays the repository's events. If handoff ever holds the project under an old owner or name, move it with `pnpm handoff project move northmes --repo northmes/northmes` instead. The move unlinks the old plan Project, so run `setup_plan` again with `copy_from` set to the old Project's owner and number (see "Moving a repository to an organization" in handoff's README).

The pull request step sets `noChecksAfterMinutes` to 30: handoff treats CI as passed when no check has started within that time. 30 minutes leaves room for a queued runner. The ruleset's required checks still stop a merge that GitHub has not seen pass.

While the repository has fewer than 10 stars, CodeRabbit reviews only after an `@coderabbitai review` comment. The pull request step in all three graphs sets `reviewRequest` (`{ "reviewer": "coderabbitai[bot]", "comment": "@coderabbitai review", "afterMinutes": 2 }`): when CodeRabbit has not reviewed the newest commit two minutes after a push, the step posts that comment, once per commit. It covers the pull request opening, each fix round and the catch-up with `main` after the merge step's `update` edge. CodeRabbit's check run is on (`review_progress: true` in `.coderabbit.yaml`, [ADR 0065](../../adr/0065-coderabbit-check-run-and-a-required-approval-on-main.md)), so handoff sees a review in progress and does not ask while CodeRabbit is already working. Pull requests a session opens get the comment from that session.

## Import the graphs

From the handoff checkout, with the dashboard's database running (`pnpm db:up`). The project is named `northmes` when `add_project` added it; `current_project` shows the name.

```bash
pnpm handoff graph import --project northmes --name northmes-guided <northmes-checkout>/docs/agents/handoff/graphs/northmes-guided.json
pnpm handoff graph import --project northmes --name northmes-standard <northmes-checkout>/docs/agents/handoff/graphs/northmes-standard.json
pnpm handoff graph import --project northmes --name northmes-lean <northmes-checkout>/docs/agents/handoff/graphs/northmes-lean.json
```

The import runs handoff's `compileGraph` and refuses a graph that does not compile. Importing the same name again stores a new version; a run keeps the version it started with, and so does its repair. These files are the source: change a graph here and import it again. A change made only in the dashboard's editor has no copy in the repository.

## Switching graphs

The operating session picks the graph for every run. A task that stays guided (see "Tasks that stay guided") runs on `northmes-guided`. Every other task runs on the current rung: the graph named in the latest decision in the weekly log. Because the graph is chosen per run, foundation-sensitive tasks stay guided after a switch.

The rungs are guided, standard and lean. Standard is optional: going from guided straight to lean needs both sets of criteria below.

A clean run is a run that merged with no repair, no cancel and no `resolve_loop`, where every gate it reached was answered approve at its first question. "Approve after fixes" and changes count as requested changes. Question gates do not count against a run.

### Guided to standard

All of these hold:

1. Epics E00, E01 and E02 (the walking skeleton) are closed.
2. Each core pattern is on `main`, built through a guided run at least once: a pure domain function with unit tests; a migration whose table has row-level security with split policies (no `FORCE ROW LEVEL SECURITY` in release 1) and the audit trigger, with SQL-level tests in `packages/testing`; a command through the command pipeline with an integration test on Testcontainers Postgres; a GraphQL field with resolver tests and the schema snapshot; a web remote screen with component tests, an end-to-end test and a passed Try it.
3. The last 10 guided runs in a row are clean.
4. Among the last 20 merged task pull requests: no revert, and at most 1 follow-up fix pull request (a `fix` pull request for a defect in a task merged in the 14 days before it).
5. `ci / gate` passed on every push to `main` in the last 14 days.
6. The weekly log holds the median gate minutes of the last 10 guided runs, as the baseline the switch is measured against.

### Standard to lean

All of these hold:

1. The last 10 standard runs in a row are clean (the plan gate approved at its first question).
2. Criteria 4 and 5 above, over the latest merges.
3. CodeRabbit reviews every pull request without anyone posting `@coderabbitai review` (the repository has 10 or more stars, or an automatic trigger has been checked on 5 pull requests), and the last 10 runs recorded no `github.reviewers_timeout`.
4. Unresolved review threads do not block an automatic merge: either CodeRabbit resolves its own threads after the coder's fix, checked on 5 pull requests, or the ruleset no longer requires conversation resolution. Otherwise the merge step names the open threads and waits until a person resolves them.
5. `ci / e2e` is a required check, since nobody tries UI changes by hand.

### How to switch

1. The operating session measures the criteria from `list_runs`, `get_run`, handoff's `events` table and GitHub, and shows Krister the result next to the weekly row.
2. Krister decides, and the decision goes into the weekly log's Decision column.
3. From the next run on, the operating session passes the new graph to `start_run` for every task that does not stay guided, for example `start_run({ issues: [123], graph: "northmes-lean" })`.
4. Active runs finish on the graph they started with. Cancel one and start it again only when it must move to the new graph.

### Tasks that stay guided

A task runs on `northmes-guided` whatever the current rung when it carries `human`, or when it:

- is the first task of a new pattern: a new module, a new kind of migration, the first screen of a new kind, a new shared package or dependency;
- builds on an ADR that is `proposed` or has an open `needs-confirmation`;
- needs a product owner, legal or design decision;
- touches authentication, row-level security policies or secrets handling;
- is a docs task for an epic, or changes shared files such as the root README.

Label such a task `human` before it moves to Ready, so the board shows it; the operating session also checks the list before it picks a graph. It starts each of these runs with `start_run({ issues: [123], graph: "northmes-guided" })`.

Krister can have any other task run guided as well; the operating session then passes the guided graph for that run.

### Control in the standard and lean phases

Krister reads two pull requests a week that the standard or lean graph merged, picked at random, plus every pull request that merged after a `github.reviewers_timeout`. A broken NorthMES rule that the code review missed goes into the code review instructions and counts toward going back.

### Going back

Go one rung down (lean to standard, standard to guided) when any of these happens:

- a pull request merged by the standard or lean graph is reverted;
- 2 follow-up fix pull requests within 10 merged tasks;
- `ci / gate` fails on `main` twice in one week;
- 3 or more runs in one week stop on a loop that ran out;
- the weekly sample finds a broken NorthMES rule that the code review did not flag.

A revert caused by a security or data defect goes straight back to guided. Going back means the operating session passes the stricter graph from the next run on. Note the trigger in the weekly log. Climb again only when the rung's criteria hold again, counting clean runs from the date of the step down.

## Weekly metrics

Record one row a week. The sources are `list_runs`, `get_run` (steps with their attempts, times and durations, and the answers given at each gate), `get_run_events`, the dashboard's Runs table, the merge queue and GitHub. `get_run_events` returns at most the latest 200 events of a run, and every Claude step logs each tool call as an event, so count events over a whole run (`edge.taken`, `edge.exhausted`, `loop.resolved`, `run.failed`, `github.review_findings`, `github.reviewers_timeout`) in the `events` table of handoff's database, which has `run_id`, `type`, `payload` and `created_at`.

| Metric | How it is measured |
|---|---|
| Graphs and active runs | The graphs the week's runs used (`list_runs`) and the most runs the operating session kept active at once (one or two). |
| Runs started, merged, failed, cancelled | `list_runs` for the week. |
| Merged tasks per working day | Merged runs divided by working days. |
| Median run time | From run creation to the merge, over runs merged in the week. |
| Median gate minutes per run | For each merged run, the sum of the durations of its plan gate, code gate and Try it steps in `get_run` (a gate step lasts from its question to the answer), plus the time from `merge.ready` to the merge for a manual merge. Median over the week's merged runs. Question gates are counted separately. |
| Clean run streak | Consecutive clean runs on the current graph at the end of the week. |
| Requested changes | Count of changes and approve after fixes at the plan gate, the code gate and Try it. |
| Automatic rounds | `edge.taken` events on the tester, tests-came-first, code review and pull request `fix` loops, with the pull request rounds split into CI and CodeRabbit. |
| Stops for a person | Questions, paths questions, permission requests, failed steps (`run.failed`) and loops that ran out (`edge.exhausted`). |
| CodeRabbit | Reviews received, `github.review_findings` events, and `github.reviewers_timeout` events. |
| Reverts and follow-up fixes | `gh pr list --state merged` for the week: revert pull requests, and `fix` pull requests for defects in tasks merged in the 14 days before. |
| Cost | The sum of the cost each run reports (an estimate from the Claude CLI, not a bill). |

### Weekly log

| Week | Graph | Runs merged | Tasks per day | Median run time | Median gate minutes | Clean streak | Reverts | Follow-up fixes | Reviewer timeouts | Decision |
|---|---|---|---|---|---|---|---|---|---|---|
