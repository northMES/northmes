---
status: "accepted"
date: 2026-10-05
decision-makers: Krister Johansson
consulted: internal research notes 04, 16, 22, 23, 24 and 32
informed: product owner, contributors and coding agents
release: "1"
needs-confirmation: ""
---

# Agent proposals as planning records a person commits

## Context and problem statement

Release 1 has two AI surfaces that can suggest changes to the plan: the in-app planning assistant ([ADR 0035](0035-ai-provider-port-with-customer-configured-providers.md)) and the `/mcp` endpoint ([ADR 0034](0034-mcp-surface-one-endpoint-a-read-mostly-planning-toolset.md)). Krister Johansson decided that the AI features stay in release 1, that agent proposals reach the planner's draft, and that a person commits them. AI never commits a change.

Four designs existed side by side before this ADR: moves written straight into the planner's draft, an agent-owned draft per user (internal research note 04), the earlier attempt's shared plant draft (internal research note 16), and a separate `planning.commitProposal` command with its own audit rows (internal research note 22). The stress test of the design found that none of them said where a proposal lives before anyone reviews it, how it meets another planner's soft lock, or whether command validators see AI moves (internal research note 32).

This ADR decides where proposals are stored, what a release 1 proposal may contain, how proposing meets locks and the frozen window, and how a planner reviews, accepts and commits it. It covers the tables `planning.proposal` and `planning.proposal_item`, the tool `planning_propose_changes`, the review panel in the planning remote and the board's cue for proposed rows. Drafts, soft locks and Save are decided in [ADR 0029](0029-per-planner-drafts-soft-locks-and-the-plan-revision.md).

## Decision drivers

* Only a person's Save changes the committed plan and triggers ERP write-back.
* AI moves pass the same command validators, plan revision check, events and audit as manual moves, so a plugin rule cannot be skipped by asking the assistant.
* Proposing must not block or disturb other planners: it takes no lock, breaks no lock and reveals no lock holder.
* ERP free text reaches tool results, so injected text must not move rows the planner never looked at or carry data read at one plant to another.
* A model writes plant local times, and those are ambiguous or missing on DST nights.
* Agent tool input schemas must work across the providers a customer can configure.
* The release 1 ledger holds 8 to 12 days for proposals (an estimate, not measured).

## Considered options

* Proposals as planning records that a planner accepts into their own draft and commits with Save
* An agent-owned draft per user that a planner reviews and saves
* Agent moves written straight into the planner's draft
* A separate `planning.commitProposal` command that commits a proposal
* Approval inside the chat or MCP client (tool approval in the AI SDK, MCP elicitation, host confirmation)

## Decision outcome

Chosen option: "Proposals as planning records that a planner accepts into their own draft and commits with Save", because it keeps one commit path for every source of change, works with per-planner drafts and soft locks, and shows the planner engine-computed consequences before a move reaches the draft. The flow is Krister's decision; the tables, lock rules and review details come from the stress test.

### Records

| Table | Columns |
|---|---|
| `planning.proposal` | `id`, `plant_id`, `owner_user_id`, `origin` (`assistant` or `mcp`), `credential_id`, `correlation_id`, `ai_run_id`, `created_at`, `expires_at`, `status` |
| `planning.proposal_item` | `job_order_id`, `base_version`, `target_equipment_id`, `target_start_local`, `target_start_instant`, `status` (`pending`, `accepted`, `rejected`, `stale`, `blocked`), `block_reason`, `draft_row_hash` (a hash of the requester's `planning.draft_change` row for that job order when the item was written; null when the draft held no change for it), `accepted_by`, `committed_command_id` |

* A proposal holds structured moves for one plant and stores no model text. The model's rationale stays in the requester's chat, so it cannot carry data read at another plant to other planners.
* A proposal expires after 24 hours. An item turns `stale` when its job order's base version changes or the proposal expires.
* `owner_user_id` is the user the agent acts for. Only that user reviews and accepts the proposal.
* The lifecycle class of both tables is `record` as a working default ([07-production-planning.md](../plan/07-production-planning.md#planning-records), [ADR 0013](0013-audit-trail-written-in-the-command-transaction.md)).

### Proposing

* `planning_propose_changes` is the only tool with the effect `proposal`. It opens an audit context and writes exactly one command: for the assistant, principal type `agent` with surface `assistant` and `acting_for` the user; for MCP, the user with the personal access token and surface `mcp` ([ADR 0013](0013-audit-trail-written-in-the-command-transaction.md)).
* The input is one move shape with an enum kind and at most 50 items. Release 1 allows only moves of existing job orders (equipment and start): no splits, no quantity changes, no new job orders.
* The input schema stays in the portable subset: objects, enums, arrays of primitives or of flat objects of primitives, optional fields; no unions, records or recursion.
* The input takes a plant local date-time with an optional offset. The server resolves it with `resolveWallClock` in the plant zone ([ADR 0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md)) and echoes local time, offset and instant per item, with the flags `resolvedAmbiguous` and `resolvedGap`.
* Each item runs through the shared lock rules: `judgeMove` (`PINNED`, `LOCKED`, `STARTED`), the frozen window and rows held by another planner. It gets `pending`, or `blocked` with a `block_reason`.
* Proposing never takes or breaks a soft lock. Read tools return `heldByOther` as true or false, never the holder's identity. The agent permission set strips `lock` and `breakLock` ([ADR 0029](0029-per-planner-drafts-soft-locks-and-the-plan-revision.md)).

### Review, accept and Save

* The review panel is a list in the planning remote with "show on board". Per item it shows the target, the resolved-time flags, any block reason, the conflicts the selection creates (precedence, lead time, send-ahead, frozen window) and the engine-computed consequences (which orders become late or later, and by how much). The planning domain computes them with `plan()` and `validate()` on the draft view, as for a manual move. Conflicts are shown, not used to reject the selection; a version mismatch fails for that row only.
* The rationale, where the review shows it, is labelled AI-written, and the fixed text "Written by an AI assistant. Check before you commit." stays in the panel ([ADR 0035](0035-ai-provider-port-with-customer-configured-providers.md)).
* The planner accepts or rejects items one at a time. Accepting takes the soft lock in the planner's name and copies the move into the planner's draft as a `planning.draft_change` row with `proposal_id` set. The accept command sets `audit.command.proposal_id`, and the item records `accepted_by`.
* Accept recomputes the draft row hash. When the requester's draft row for that job order changed after the proposal, the item shows "changed in your draft since the proposal", and the planner confirms before the accepted move replaces the draft move.
* Save commits the draft through `planning.commitScheduleChanges` like any other change ([ADR 0029](0029-per-planner-drafts-soft-locks-and-the-plan-revision.md)). Command validators, the example validator plugin included, see AI moves ([ADR 0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md)), and only Save triggers write-back. The committed item records `committed_command_id`, and History joins `audit.change` to `proposal_item` to show the AI origin per row.
* `planning.commitProposal` is not built. No assistant or MCP tool accepts, rejects or saves.
* The board shows proposed rows with their own cue: a spark icon in the text color and a dotted border, distinct from the draft's double border, and "proposed by assistant, not reviewed" in the accessible name ([ADR 0021](0021-accessibility-target-wcag-2-2-aa.md)). The review groups them under "Proposed by assistant".

### Consequences

* Good, because AI moves reach the committed plan only through the same command as manual moves, so validators, the plan revision, events, audit and write-back cannot differ by source.
* Good, because proposing writes no lock and no draft row, so an agent cannot block a colleague or overwrite the planner's own unsaved work.
* Good, because injected text can at most create a proposal of moves on one plant that a person must review against computed consequences.
* Good, because DST ambiguity is visible per item instead of hidden in a resolved instant.
* Bad, because accepting one item at a time is slow for a 50-item proposal.
* Bad, because release 1 proposals cannot express splits or quantity changes, so some fixes for late orders stay manual.
* Bad, because proposals go stale quickly on a busy plant, and the planner must ask again.
* Neutral, because the rationale of an MCP proposal lives in the outside client's chat, not in NorthMES.

### Confirmation

* `proposal.int.test.ts` (proposed name), Testcontainers Postgres ([ADR 0041](0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md)): planner A holds a soft lock on R1; a mocked model proposes moves of R1 and R2 for planner B; R1 is `blocked` with `heldByOther`, R2 is `pending`; the propose call created and broke zero locks and wrote no security events; B accepts R2 and the lock on R2 belongs to B.
* Validator path: the CI example validator vetoes an accepted proposal item at Save with `core.command_rejected` and `rejectedBy: "example-validator"`, and no `audit.change` rows are written.
* Time resolution: in `Europe/Stockholm`, `2026-10-25T02:30` without an offset resolves to `00:30Z` with `resolvedAmbiguous`, and `2027-03-28T02:30` resolves to `01:00Z` with `resolvedGap`.
* Audit: a mocked assistant run that calls `planning_propose_changes` writes exactly one `audit.command` with principal type `agent`, surface `assistant` and `acting_for` the user; a run that only reads writes none.
* `mcp/schema-subset.test.ts`: the propose input passes the schema lint; a `z.union` input fails; an input with 51 items is rejected.
* `proposal-accept.int.test.ts` (proposed name): a planner moves job order R2 in the draft after the proposal; accepting the R2 item returns the changed-in-draft flag and leaves the draft row unchanged until the planner confirms.
* Expiry: an item turns `stale` when its job order's version changes, and every item of a proposal past `expires_at` reads as `stale`.
* Playwright with a mocked model: "propose a fix for late orders", accept 2 of 3 items, Save; the board shows the moved blocks, History shows the AI origin, and the write-back queue holds the two orders in shadow mode.
* The board's ARIA snapshot of a proposed row contains "proposed by assistant, not reviewed".
* The opt-in live suite holds the prompt-injection fixture ([ADR 0042](0042-ai-in-tests-mocked-by-default-opt-in-live-runs.md)).

## Pros and cons of the options

### Proposal records accepted into the planner's draft

* Good, because it works with per-planner drafts and soft locks as decided, and one commit command serves every source.
* Good, because each item carries its own status, so a blocked or stale item does not spoil the rest.
* Bad, because it adds two tables, a review panel and a board cue.

### An agent-owned draft per user

* Good, because the draft machinery already exists.
* Bad, because an agent draft would take soft locks like any draft and block other planners while nobody has reviewed it.
* Bad, because the planner would merge two drafts at Save, which the draft model has no rule for.

### Moves written straight into the planner's draft

* Good, because it needs no new tables.
* Bad, because the agent overwrites or mixes with the planner's unsaved moves and takes locks in the planner's name before the planner has looked.
* Bad, because a draft row cannot record per-item status, block reasons or the AI origin.

### A separate `planning.commitProposal` command

* Good, because "who proposed" and "who approved" sit on two linked command rows.
* Bad, because it is a second commit path next to `planning.commitScheduleChanges`, and validators, the plan revision and write-back would need to be kept equal on both.

### Approval inside the chat or MCP client

* Good, because it needs no NorthMES screen.
* Bad, because a client can answer approvals automatically, so it shows intent, not that a person looked; an in-chat approval is still inside the agent loop.
* Bad, because the planner sees no board, no conflicts and no consequences when approving.

## More information

* Related ADRs: [0013](0013-audit-trail-written-in-the-command-transaction.md) agent principal and audit, [0021](0021-accessibility-target-wcag-2-2-aa.md) accessibility, [0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md) wall-clock resolution, [0028](0028-autoplan-as-a-pure-deterministic-function.md) `plan()` and the frozen window, [0029](0029-per-planner-drafts-soft-locks-and-the-plan-revision.md) drafts and Save, [0034](0034-mcp-surface-one-endpoint-a-read-mostly-planning-toolset.md) MCP toolset, [0035](0035-ai-provider-port-with-customer-configured-providers.md) assistant and prompt-injection defences, [0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md) validators, [0042](0042-ai-in-tests-mocked-by-default-opt-in-live-runs.md) AI in tests, [0051](0051-regulated-readiness-no-regret-rules.md) regulated readiness, [0055](0055-release-1-scope-under-option-b-and-the-scope-rule.md) scope and cut order.
* Plan: [10-ai-and-agents.md](../plan/10-ai-and-agents.md#agent-proposals), [07-production-planning.md](../plan/07-production-planning.md#agent-proposals-in-the-plan), [05-graphql-and-apis.md](../plan/05-graphql-and-apis.md#the-mcp-endpoint).
* If velocity forces cuts, proposals are the second AI feature to move to a 0.x release, after `/mcp` ([ADR 0055](0055-release-1-scope-under-option-b-and-the-scope-rule.md)).
* Revisit when planners ask for splits or quantity changes in proposals, when the product owner decides whether autoplan writes its result as a proposal ([ADR 0028](0028-autoplan-as-a-pure-deterministic-function.md)), and when a regulated profile needs to hide AI per module.
