---
status: "accepted"
date: 2026-10-05
decision-makers: Krister Johansson
consulted: internal research notes 16, 25, 28, 29, 30, 31 and 32
informed: contributors and coding agents
release: "1"
needs-confirmation: "maintainer (persona list, epic order)"
---

# Delivery workflow: handoff, thin vertical slices and Claude Design per task

## Context and problem statement

One developer builds NorthMES with coding agents. Krister Johansson decided that work is shaped as epics, stories and tasks and built with Krister Johansson's handoff plugin on GitHub issues, that stories split into thin vertical slices and not one task per layer, that the coder keeps a refactor step after green, that mockups are made per task in the Claude Design project, and that ten skills from `mattpocock/skills` are installed in the repository. handoff runs a graph of agents (planner, plan reviewer, coder, Tester, code review, demo, pull request, merge) for one task issue in a fresh git worktree.

A run agent sees only the files git tracks in its worktree, with Claude Code hooks off, no user MCP servers and no URL fetches. An internal stress test found that the design facts the first epics port were not in the repository, that Krister's gates alone would take 6 to 12 days at 180 to 240 tasks of 15 to 25 minutes each, and that the first weeks needed an explicit order (internal research note 32). An earlier proposal split each slice into one task per layer (internal research note 28); Krister Johansson's decision replaces that split.

This ADR records how issues are shaped, how a story becomes tasks, how runs are started and measured, how agent instructions are layered, how designs reach the code, which skills are installed and the persona list. It covers GitHub issues and the plan's Project, `AGENTS.md` and `CLAUDE.md`, `docs/agents/`, `docs/design/`, `docs/sources/`, `.claude/skills` and the handoff graph files.

## Decision drivers

* Krister Johansson's decision: handoff on GitHub issues, thin vertical slices, a refactor step after green, Claude Design per task, ten installed skills.
* Run agents read only tracked files, so every fact a task needs must be in the repository.
* Krister's gate time is the throughput limit, and measured velocity sets the pilot date.
* One task is one pull request inside handoff's plan budget of 15 files and 12 steps.
* Tests come first ([ADR 0041](0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md)).

## Considered options

* Thin vertical slices on handoff, with guided then lean graphs, and approved designs committed to `docs/design/` on `main`
* One task per layer for each story on handoff
* Thin vertical slices with approved designs kept on a separate `design-assets` branch

## Decision outcome

Chosen option: "Thin vertical slices on handoff, with guided then lean graphs, and approved designs committed to `docs/design/` on `main`", because it follows Krister Johansson's decision, gives every task a behaviour a person can check, and puts designs where run agents can read them.

### Issues

* Labels `epic`, `story` and `task`; sub-issue and blocked-by links; Status on the plan's GitHub Project. The plan uses handoff's Flow mode: an order and blockers, no dates and no sizes. Stories and tasks carry no size, and the Flow order and the blockers show progress. Epics keep their estimates in raw days as planning information for the weekly ledger.
* Issues are created and their plan fields changed only with handoff's tools in interactive sessions. Story context and Design sections are added with `gh issue edit` in the same session. Run agents never open issues; follow-ups go into the pull request description ([docs/agents/issue-tracker.md](../agents/issue-tracker.md)).
* Plan identifiers: `E02`, `E02-S03`, `E02-S03-T01`. Each epic from E02 on has a shaping file `docs/plan/Enn-<slug>.md` (E00 and E01 live in `docs/plan/14-roadmap.md`); once issues exist, the issue is the source of truth.
* Issue titles read `<module>: <outcome>`; pull request titles `type(module): outcome` ([ADR 0038](0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md)); red commits start with `test:`.
* A task body stays under about 3 500 characters, has 3 to 8 criteria under `## Acceptance criteria`, names its tests and seam under Tests first, and links its ADRs.

### Thin vertical slices

* Each task delivers one small end-to-end behaviour: the migration, command, GraphQL field, screen state and their tests, as far as that behaviour needs them. A task never covers one layer for a whole story.
* A change to a shared package is its own task, ordered before the module tasks that use it ([ADR 0022](0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md)). Adding a dependency is its own task, reviewed by Krister.
* Tasks that change a hot file (the lockfile, schema snapshots, generated files, root configs, shared docs) are ordered with `blocked_by`.
* Generated and module docs are updated in each task, extension point docs in the task that changes the extension point, user guides in one docs task per epic.

### Runs

* handoff runs in worktree mode; each test run starts its own Postgres through Testcontainers.
* Three graphs live in `docs/agents/handoff/graphs/`: `northmes-guided` (a human plan gate and code gate, plus Try it for UI changes and a manual merge; for the foundation), `northmes-standard` (the plan gate only; an optional middle rung) and `northmes-lean` (no human gates, automatic merge; a person steps in only for an agent's question, a run that fails twice, or a task labelled `human`). The project starts guided and climbs one rung when the measurable switch criteria in [docs/agents/handoff/README.md](../agents/handoff/README.md) hold. Because the operating session picks the graph per run, some tasks run guided whatever the rung: a task labelled `human`, the first task of a new pattern, a task that builds on a proposed ADR or needs a product owner, legal or design decision, a task that touches authentication, row-level security or secrets, and an epic's docs task.
* handoff's scheduler is not used. An operating Claude Code session paces the work: it reads `list_plan` and `list_backlog`, starts the next Ready task without open blockers with `start_run` and names the graph for that run, follows the run events, and brings every question, permission request, failed run and merge decision to Krister. Only Krister answers questions and permission requests. One run is active at first, two after two runs finish without a collision on owned paths.
* The Tester runs the one gate command, `pnpm check` ([ADR 0058](0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md)), and the coder instructions name it; `pnpm test:handoff` stays only as an alias. `scripts/handoff/tests-changed.mjs` fails a change to source with no changed test.
* The code review's blocking rules include the spec rule: "Blocking: an acceptance criterion the diff does not implement, or behaviour the issue did not ask for." On the guided graph Krister resolves review threads before requesting the merge; on the standard and lean graphs an open thread must not block the automatic merge (switch criterion 4 in [docs/agents/handoff/README.md](../agents/handoff/README.md)).
* E03 runs start only after the E02 foundation pull request has settled the root configs, or all root-config changes land in one session pull request before runs start.

### Agent instructions

* `AGENTS.md` holds the tool-neutral rules for any contributor's agent. `CLAUDE.md` starts with `@AGENTS.md` and adds only a short note on the installed skills. Neither mentions handoff.
* Maintainer-only instructions are private and load through the gitignored `CLAUDE.local.md`.
* The handoff run rules live in handoff's project agent notes and in the graph node instructions.
* Public docs describe handoff as the maintainer's workflow, not as a step every contributor takes. Contributors open issues with the GitHub issue forms and send pull requests.
* Node instructions follow the Claude Opus 5 prompting guide. They are phrased as what to do. The planner and coder carry the scope rule: deliver what the issue asks at its scope, ask only when readings differ materially, and note follow-ups in the pull request description. Agents delegate to subagents only for large independent work, and written deliverables are as long as the substance needs. No instruction asks an agent to double-check, to verify again or to write out its reasoning; review is a separate step. Review instructions ask for every finding with its severity and let the verdict step filter. Each node sets its effort where handoff supports it: lower for the plan review and code review, higher for the coder on hard work.

### Gate time is measured

From the first runs, the weekly velocity row records median gate minutes per task and merged tasks per day, and the handoff weekly log records the measurements the graph switches use. The weekly ledger credits each merged task with its share of its epic's estimate, and the velocity checkpoints work from epic estimates and merged-task counts. Gates are answered in two batches a day. The code gate leaves the routine path when the project moves to the standard graph.

### Definitions of ready and done

The full lists are in [13 delivery and GitHub](../plan/13-delivery-and-github.md#definition-of-ready). A task moves to Ready only when every linked ADR is accepted with no open needs-confirmation ([ADR 0001](0001-record-architecture-decisions-in-madr.md)), every file it refers to is in the repository, its plan fits the budget, product owner and legal answers it needs are in the issue, and, for UI, its design is approved and committed. Done includes a `test:` commit before the code, one named test per criterion, `pnpm check` and the required checks green, and for data, split row-level security policies without `FORCE` ([ADR 0008](0008-row-level-security-with-transaction-local-scopes.md)).

### Design facts live in the repository

* The research notes and the brief move to a private companion repository, which exists since 2026-10-05. The spike sources that E02 ports move to `docs/sources/` in this repository as code only, with no customer data, excluded from Biome, `tsc` and Vitest.
* Files that the product owner or customers share are never committed to any repository, the companion repository included. Tests use synthetic fixtures.
* E00 creates `docs/adr/README.md` with the index and the ADR numbering script. ADR numbers come from the script or a CI check, never from scanning the folder.
* An E00 checklist item in [docs/plan/README.md](../plan/README.md) lists the ADRs E02 needs: module package and manifest, backend federation rules, web remote contract and CSS rule, migration roles and naming, test layout and harness, plugin surface and validator payload, developer environment.

### Claude Design per task

* Designs are made one task at a time, between `create_task` and `move_to_ready`, in design sessions outside handoff runs. Order: D1 tokens and contrast, D2 shell and navigation, then D3 planning board and D4 operator station, then the canonical list and form page.
* Every page has a header frame, the domain states, the widths (planner 1280, 1440 and 1920 px plus a 320 px reflow; station 1280 by 800, 1920 by 1080 and portrait), light and dark themes, a long-strings frame, keyboard and focus frames, and build notes naming shadcn components, tokens, ARIA, slots, WCAG criteria and the final English copy.
* Approval is recorded by the page's etag. The PNGs and build notes are committed to `docs/design/<area>/` on `main`, and the issue's Design section names the etag, the frames and the paths.
* The implementing agent takes layout, states, copy and the keyboard model, and rebuilds everything with `@northmes/ui` components and tokens; it copies no markup or token values ([ADR 0020](0020-frontend-libraries-tanstack-router-apollo-client-4-shadcn-ui-and-forms.md), [ADR 0021](0021-accessibility-target-wcag-2-2-aa.md)).

### Skills and personas

* Ten skills are installed in `.claude/skills` at commit `24fe0ef`, recorded in `skills-lock.json`, with the MIT notice: grilling, grill-me, grill-with-docs, domain-modeling, tdd, codebase-design, writing-for-agents, to-questionnaire, wait-what and improve-codebase-architecture. handoff's library group `northmes` enables tdd and codebase-design on the planner and coder; the run configuration denies grilling and domain-modeling. The project skills (db-test, vertical-slice, graphql-subgraph, web-remote, dst-test) are written by the E02 tasks that build each extension point. The pin moves only after reading the changelog.
* Issues, issue forms and design header frames share one persona list in [docs/plan/README.md](../plan/README.md): Planner, Operator, Plant admin, Plugin developer, Maintainer, Hosting partner.

### First weeks

Day 1 (2026-10-15) sends the written requests to the Pyramid administrator and books the product owner session. The private companion repository and spike SP0 were done ahead of it, on 2026-10-05. Days 2 to 5 run E00 until handoff's `setup_project` reports ready. Week 1 also runs the Node 26 hook tests and gets one Windows PC of the pilot planner PC class. Weeks 2 and 3 (2026-10-26 to 2026-11-06) run the board spike SP3 against the headless board core fed through Apollo from a mocked schema or a stub resolver, with its verdict on 2026-11-06; SP3 has no blocker on E07, and only the board's data-wiring story (E08-S10) waits for E07. Weeks 2 to 4 build the walking skeleton and SP1, with design approvals D1 and D2 beside them, and the skeleton is green by 2026-11-13. E09 (Pyramid import) starts right after core master data (E06), inside M2. E17 (install on a pilot-like VM with a timed restore) is done on or before 2027-02-26 (M3). The epic order is in [14 roadmap](../plan/14-roadmap.md).

### Consequences

* Good, because each task ends in a behaviour Krister can check at Try it or in the diff, and each pull request stays reviewable.
* Good, because run agents find every design, ported source and decision in their worktree.
* Good, because gate time is measured, so the move to lighter graphs and the pilot date rest on numbers.
* Bad, because the first weeks run on the guided graph with every gate, which costs Krister the most time.
* Bad, because UI tasks wait for a design session and an approval before they can move to Ready.
* Bad, because hot files force a strict order between tasks that would otherwise run in parallel.

### Confirmation

* `test/meta/doc-links.test.ts` fails on a relative Markdown link in `docs/plan`, `docs/adr`, `docs/agents` or `GLOSSARY.md` whose target `git ls-files` does not list, on any Markdown link into the gitignored `docs/research` folder, and on a backticked repository path in `AGENTS.md`, `CLAUDE.md` or `docs/agents` that `git ls-files` does not list and that the test's list of planned paths does not hold (each planned path names the task that creates it). Backticked paths in `docs/plan` and `docs/adr` name files that later tasks create, so the test does not check them.
* `test/meta/gates.test.ts`: the Tester command in each committed graph file is `pnpm check`, and each coder instruction names `pnpm check` ([ADR 0058](0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md)).
* `test/meta/agent-files.test.ts`: `CLAUDE.md` starts with `@AGENTS.md`, and neither `AGENTS.md` nor `CLAUDE.md` mentions handoff.
* Graph file test: the plan reviewer instructions in all three graph files name 15 files and 12 steps, and every graph runs `scripts/handoff/tests-changed.mjs`.
* Skills test: `.claude/skills` holds exactly the ten skills in `skills-lock.json`, pinned at `24fe0ef`.
* Persona test: the persona options in the issue forms equal the list in `docs/plan/README.md`.
* `ci / linked issue` requires `Closes #N`; `ci / pr title` checks the `type(module): outcome` format.
* Plan checks: SP3 has no `blocked_by` on E07; E09 comes before E08's data-wiring story (E08-S10) in Project order; E17 targets a date on or before 2027-02-26 (M3); `e2e/board-perf.spec.ts` exists by 2026-11-06; no E03 task is Ready before the E02 foundation pull request is merged.
* The weekly velocity row carries median gate minutes and merged tasks per day once runs start.

## Pros and cons of the options

### Thin vertical slices, graph rungs, designs on `main`

* Good, because each slice can be demoed, tried and reverted alone.
* Bad, because a slice touches several layers, so the planner must keep it inside the budget or split it.

### One task per layer

* Good, because each task touches one part of the code base.
* Bad, because no layer task has a behaviour a person can try, a criterion often has no test until the last task, and Krister Johansson's decision rules it out.

### Designs on a `design-assets` branch

* Good, because PNGs stay out of `main`.
* Bad, because run agents read only their worktree of the run's branch, so they could not open the approved design.

## More information

* Related ADRs: [0001](0001-record-architecture-decisions-in-madr.md) ADRs and Ready, [0020](0020-frontend-libraries-tanstack-router-apollo-client-4-shadcn-ui-and-forms.md), [0021](0021-accessibility-target-wcag-2-2-aa.md), [0022](0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md) recipes and generators, [0038](0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md) pull request titles, [0041](0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md) test first, [0050](0050-github-organization-rulesets-ci-runners-and-supply-chain.md) rulesets and agents on GitHub, [0055](0055-release-1-scope-under-option-b-and-the-scope-rule.md) velocity and the pilot date, [0058](0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md) the gate command.
* Plan: [13 delivery and GitHub](../plan/13-delivery-and-github.md), [06 web and UX](../plan/06-web-and-ux.md) (design page contents), [14 roadmap](../plan/14-roadmap.md), [README](../plan/README.md) (persona list, E00 checklist, velocity row), [17 risks](../plan/17-risks.md) (one developer and gate time).
* Agent files: [docs/agents/handoff/README.md](../agents/handoff/README.md), [docs/agents/issue-tracker.md](../agents/issue-tracker.md), [docs/agents/domain.md](../agents/domain.md).
* mattpocock skills: https://github.com/mattpocock/skills
* Krister confirms the persona list and the epic order with the first weeks.
* Revisit when the switch criteria move the project to the lean graph, when a second developer joins, or when the repository moves to the `northMES` organization (handoff's organization support passed SP0 on 2026-10-05).
