---
status: "accepted"
date: 2026-10-05
decision-makers: Krister Johansson
consulted: internal research notes 16, 25, 28 and 30
informed: contributors and coding agents
release: "1"
needs-confirmation: ""
---

# Record architecture decisions in MADR

## Context and problem statement

One developer builds NorthMES with coding agents. A planning session shapes the work into epics, stories and tasks as GitHub issues, and handoff run agents build each task in a worktree of the public repository ([ADR 0049](0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md)). A run agent reads only the files that git tracks. Krister Johansson has decided that `docs/plan` and `docs/adr` are public and self-contained, while the project brief, the research notes and the spike code stay private, because they name the pilot customer and hold product owner, legal and commercial material.

An earlier attempt at the same product kept 26 ADR files, and two of them had the number 016, because parallel sessions picked numbers by scanning the folder (internal research note 16).

This ADR decides the format, place, status rules and numbering of architecture decisions, and what a public ADR may contain. It covers `docs/adr`, `docs/plan` and `GLOSSARY.md`.

## Decision drivers

* A run agent reads only tracked files, so an ADR that points at a private note points at nothing.
* The repository is public. It must not name a customer or contain legal strategy, commercial terms or private cost figures.
* Parallel sessions must not create two ADRs with the same number.
* A task must prove that its code follows a decision, so each decision needs checks that a task can carry.
* Only Krister Johansson accepts decisions, and a task must not start on a decision that is not accepted.

## Considered options

* MADR files in `docs/adr`, public and self-contained, with research cited by number only
* MADR files that link to the research notes, with the research made public
* Decisions recorded only in the plan documents and in GitHub issues

## Decision outcome

Chosen option: "MADR files in `docs/adr`, public and self-contained, with research cited by number only", because a run agent then finds every fact a decision needs in its worktree, and no private material reaches the public repository.

### Format and place

Each decision is one file, `docs/adr/NNNN-kebab-title.md`, started from [template.md](template.md): MADR 4 with NorthMES front matter. The title names the problem and the chosen solution. The sections are context and problem statement, decision drivers, considered options, decision outcome (with consequences and confirmation), pros and cons of the options, and more information.

| Front matter field | Allowed values |
|---|---|
| `status` | `proposed`, `accepted`, `rejected`, `deprecated` or `superseded by ADR-NNNN` |
| `date` | the day the decision was last updated, `YYYY-MM-DD` |
| `decision-makers` | `Krister Johansson` for an accepted ADR; `proposed by the planning session, to be confirmed by Krister Johansson` for a proposed one |
| `consulted` | people, and internal research notes by number only |
| `informed` | the people and groups who must know the decision |
| `release` | `1`, `later` or `vision` |
| `needs-confirmation` | empty, or who must still confirm which part: maintainer, product owner, pilot IT, lawyer |

ADRs are plain technical prose with sentence-case headings, and they use the terms in [GLOSSARY.md](../../GLOSSARY.md). An ADR is as long as its substance needs.

### Status

* A new ADR has status `proposed`. Only Krister Johansson sets `accepted`.
* An accepted ADR records a decision Krister Johansson made. Details inside it that were adopted from research are named as such in its body, and the parts that still need Krister Johansson's confirmation are listed in `needs-confirmation`.
* A changed decision gets a new ADR, and the old ADR's status becomes `superseded by ADR-NNNN`.
* Status changes on existing ADRs go into the docs task at the end of each epic, which runs alone, because shared files cause merge conflict loops between parallel runs.

### Numbers

* Numbers come from the ADR numbering script. Until that script exists, the planning session takes the next free number from the index in [README.md](README.md).
* Nobody takes a number by scanning the `docs/adr` folder.
* The index lists every ADR with its number, title, status, release and needs-confirmation value.

### When an ADR is written

* Every decision that the plan in `docs/plan` lists has an ADR.
* A session also offers an ADR when a decision is hard to reverse, surprising without context and a real trade-off.
* Each Confirmation item names a test, lint rule or CI check that a task can carry. The planning session copies each item into a task's tests-first lines or acceptance criteria.
* A task moves to Ready only when every ADR it links is on `main` with status `accepted` and an empty `needs-confirmation`. Until then the task stays in Shaping, or it carries the `human` label, so it runs only on the guided handoff graph, where Krister approves the plan and the code, or a person works it in a session.

### Public and self-contained content

* An ADR states every fact its decision needs: names, versions, measured numbers, error codes and test names. A reader with only `docs/plan` and `docs/adr` understands it.
* ADRs and plan documents never name a customer. They say "the pilot customer". They contain no legal strategy, commercial terms or private cost figures.
* A research note is cited as "internal research note NN", by number, never as a path or link. The `consulted` field follows the same rule. These citations tell people where the evidence sits; an agent cannot open them.
* The research notes, the brief and the spike code live in a private companion repository, and `.gitignore` keeps them out of this one. Files that the product owner or a customer shares are not committed to any repository, the private one included; tests use synthetic fixtures. Spike code that a task ports moves to `docs/sources/` as code only, with no customer data ([ADR 0049](0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md)).
* Public documents link each other with relative links, for example `../plan/04-data-and-platform.md` or `0002-modular-monolith-with-module-owned-schemas-and-process-roles.md`. Public URLs are allowed.

### Consequences

* Good, because a run agent finds the facts, names and tests of a decision in its worktree.
* Good, because one index or one script hands out numbers, and a CI check catches a duplicate that two sessions took at the same time.
* Good, because the Confirmation section turns each decision into named checks, so a reviewer can see whether a task honoured it.
* Bad, because an ADR repeats facts that also sit in a private research note, and the two copies can drift. When research changes a fact, the same session updates the ADR.
* Bad, because a public reader cannot check the evidence behind "internal research note NN".
* Bad, because a task under a proposed ADR waits for Krister Johansson, which adds gate time.

### Confirmation

* `test/meta/doc-links.test.ts` fails on a relative Markdown link in `docs/plan`, `docs/adr`, `docs/agents` or `GLOSSARY.md` whose target `git ls-files` does not list, on any Markdown link into `docs/research`, and on a backticked repository path in `AGENTS.md`, `CLAUDE.md` or `docs/agents` that `git ls-files` does not list and that the test's list of planned paths does not hold (each planned path names the task that creates it). Backticked paths in `docs/plan` and `docs/adr` name files that later tasks create, so the test does not check them.
* `test/meta/adr.test.ts`: every `docs/adr/NNNN-*.md` file has the seven front matter fields (status, date, decision-makers, consulted, informed, release, needs-confirmation) with allowed values; numbers are unique and run from 0001 without gaps; every file appears in `docs/adr/README.md` with the same status, release and needs-confirmation; the index lists no file that does not exist; an accepted ADR has `decision-makers: Krister Johansson`.
* Plan review checklist item: the ADRs and plan text of a planning pull request name no customer and contain no legal strategy, commercial terms or private cost figures.
* Definition of ready item: every ADR a task links is accepted on `main` with an empty `needs-confirmation`.

## Pros and cons of the options

### MADR files in `docs/adr`, public and self-contained

* Good, because MADR's drivers, options and confirmation sections map to the questions a task asks: why, what else, and how to check.
* Good, because contributors and agents see the decisions without access to pilot material.
* Neutral, because the template adds two fields that plain MADR lacks (`release`, `needs-confirmation`).
* Bad, because facts are copied from research into ADRs and can drift.

### MADR files linking to public research

* Good, because the full reasoning and the raw measurements stay one link away.
* Bad, because the research notes name the pilot customer and hold product owner and legal material, which Krister Johansson decided stays private.

### Decisions only in plan documents and issues

* Good, because there is one place fewer to keep current.
* Bad, because a plan document holds many decisions, so a task cannot link the one decision it implements, and the status of each decision has no home.
* Bad, because issue text changes without review and is not part of the repository history.

## More information

* [ADR 0049](0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md): the delivery workflow, the definition of ready, `docs/sources/` and the doc-links test.
* [ADR 0050](0050-github-organization-rulesets-ci-runners-and-supply-chain.md): the repository, its rulesets and CI.
* Plan: [README](../plan/README.md), [13 delivery and GitHub](../plan/13-delivery-and-github.md).
* MADR: https://adr.github.io/madr/
* Revisit when the numbering script lands (this ADR then names it), or when someone other than Krister Johansson may accept ADRs.
