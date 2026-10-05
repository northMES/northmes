# Issue tracker

Work items are GitHub issues in the NorthMES repository.

## Contributors

Open an issue with one of the GitHub issue forms: bug report, feature request or plugin request. Report a security vulnerability through private reporting, which the issue chooser links to. Send changes as a pull request whose description names the issue with `Closes #N`. A reported issue starts with the label `needs triage`; after triage the maintainer may add it to the plan as a task.

An agent working for a contributor follows `AGENTS.md` and notes follow-up ideas in the pull request description.

## Planned work

The maintainer shapes planned work with the handoff plugin: epics, stories and tasks (labels `epic`, `story`, `task`), sub-issue and blocked-by links, and Status on the plan's GitHub Project. The maintainer creates these issues and changes their plan fields with handoff's tools (`create_epic`, `create_story`, `create_task`, `plan_issue`, `move_to_ready`) in interactive sessions, and only the maintainer moves a task to Ready.

The plan uses handoff's Flow mode: an order of tasks and their blockers, with no dates and no sizes. Stories and tasks carry no size; the Flow order, the blockers and each task's Status show progress. Each epic keeps its estimate in raw days as planning information, in the epic issue and in [the roadmap](../plan/14-roadmap.md), and the weekly ledger turns it into credit as the epic's tasks merge. Blockers come from `create_task`'s `blocked_by`, and the order from `arrange_plan` and `set_order`. `create_task` runs without `size`, and the Project's Size field stays empty. The label `human` marks a task that runs only on handoff's guided graph, or that a person works in a session.

[The maintainer's handoff workflow](handoff/README.md) describes how runs start, which graph each run uses and when a task carries `human`.

A story is split into thin vertical slices: each task delivers one small end-to-end behaviour (for example migration, command, GraphQL field, screen state and their tests) inside handoff's plan budget, not one task per layer.
