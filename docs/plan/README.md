# NorthMES plan

This folder holds the release 1 plan for NorthMES, an open source, developer-first manufacturing execution system. NorthMES is a monorepo of modules, each with its own services and frontend, and production planning is the first module to release. Release 1 goes to a pilot at the pilot customer, which runs the Pyramid ERP and hosts NorthMES on one Linux server with Docker Compose. One developer builds it with coding agents. The scope follows option B: the full release 1 scope, with a pilot date that measured velocity sets at the checkpoints in [14-roadmap.md](14-roadmap.md) ([ADR 0055][adr-0055]).

`docs/plan` and `docs/adr` are public and self-contained: every plan document, ADR and task brief carries the facts it needs, because handoff run agents read only files tracked in the repository. Internal research is cited as "internal research note NN" with no path, and no public document links to it. No customer is named: the plan says "the pilot customer". Legal strategy and commercial terms stay out of these documents. Decisions live in the ADRs under [docs/adr](../adr/README.md), recorded as MADR files ([ADR 0001][adr-0001]), and terms follow [GLOSSARY.md](../../GLOSSARY.md). When a plan document and an ADR disagree, the ADR holds and the plan document gets fixed.

## Reading order

Read the glossary first and the documents in this order. Each document links the ADRs it depends on.

| Step | Document | What it holds |
|---|---|---|
| 1 | [GLOSSARY.md](../../GLOSSARY.md) | The domain terms for code names, test names, issue titles, ADRs and the UI, with the ERP word for each and the words to avoid. |
| 2 | [01-product-and-scope.md](01-product-and-scope.md) | What NorthMES is, the module map, release 1 scope under option B, the cut order, the draft pilot acceptance criteria and what done means for release 1. |
| 3 | [02-architecture.md](02-architecture.md) | The modular monolith in one Node process: process roles, repository layout, module-owned schemas, the command write path, events and jobs, the embedded gateway, the web shell, boot and shutdown. |
| 4 | [03-modules-and-extensibility.md](03-modules-and-extensibility.md) | The package shape, the `defineModule` manifest, catalog checks, plugins with command validators and UI slots, the two example plugins and the license boundary of shared packages. |
| 5 | [04-data-and-platform.md](04-data-and-platform.md) | Database roles, data access and migrations, tenancy and row-level security, commands, identity and principals, audit, events and jobs, settings, secrets, units, file storage and health contributions. |
| 6 | [05-graphql-and-apis.md](05-graphql-and-apis.md) | The `/graphql` endpoint, federation in one process, list conventions, scalars, the error model, subscriptions, the REST routes, the MCP endpoint and the schema gates. |
| 7 | [06-web-and-ux.md](06-web-and-ux.md) | The shell as a Module Federation runtime host, the remote contract, CSS rules, shared web packages, UI patterns, accessibility, design tokens, Claude Design per task and supported browsers. |
| 8 | [07-production-planning.md](07-production-planning.md) | The planning domain: master data, planning records, statuses, the planned duration formula, calendars and DST, autoplan, drafts and soft locks, conflicts, the board and the board spike. |
| 9 | [08-pyramid-connector.md](08-pyramid-connector.md) | The Pyramid connector: polling and file mode, snapshot import, pending changes, write-back and the questions for the Pyramid administrator. |
| 10 | [09-operator-station.md](09-operator-station.md) | The minimal online operator station: registration, operator sign-in, start, pause, finish, good and scrap reports, corrections and idempotent submits. |
| 11 | [10-ai-and-agents.md](10-ai-and-agents.md) | Customer-configured AI providers, usage metering and budgets, the read-only planning assistant, agent proposals and the `/mcp` toolset. |
| 12 | [11-quality-and-testing.md](11-quality-and-testing.md) | Test-first rules, test tiers, Vitest projects, the Testcontainers harness, Playwright, accessibility tests, AI test modes, performance budgets and CI gates. |
| 13 | [12-operations-and-security.md](12-operations-and-security.md) | The Docker Compose bundle on one host, TLS, backups and restore drills, upgrades and rollback, health, logs, secrets, the supply chain and the go-live checklist. |
| 14 | [15-regulated-readiness.md](15-regulated-readiness.md) | What a regulated customer requires, the no-regret rules release 1 follows and the work list per industry. |
| 15 | [13-delivery-and-github.md](13-delivery-and-github.md) | The handoff configuration, issue formats, acceptance criteria, labels and Project fields, the definitions of ready and done, Claude Design per task, CI and release-please. |
| 16 | [14-roadmap.md](14-roadmap.md) | The checkpoints that set the pilot date, the weekly ledger row, the epics in dependency order with their stories, the tasks of E00 and E01, the cut list and the critical path. |
| 17 | [16-open-questions.md](16-open-questions.md) | Open questions grouped by who answers them, each with a working default, the ADR or plan section it affects and the date it is needed by. |
| 18 | [17-risks.md](17-risks.md) | The risk register for release 1 and the pilot: likelihood, impact, mitigations, warning signals, owners and ADRs. |

Where each reader starts:

- The session that shapes an epic into issues reads [13-delivery-and-github.md](13-delivery-and-github.md) and [14-roadmap.md](14-roadmap.md) first, then the plan documents and ADRs the epic names, and takes working defaults from [16-open-questions.md](16-open-questions.md).
- A coding agent on a task reads its issue, the story and epic above it, the ADRs and plan sections the issue names by repository path, and [GLOSSARY.md](../../GLOSSARY.md).
- Krister Johansson, the maintainer, fills the weekly ledger below and reviews it with [17-risks.md](17-risks.md). The decisions that wait for Krister are in the last section of this file.

## How the plan feeds handoff

handoff runs graphs of coding agents on GitHub issues, and the maintainer builds NorthMES work with it ([ADR 0049][adr-0049]). This is the maintainer's workflow: contributors open issues with the GitHub issue forms and send pull requests, and need no handoff. The plan becomes issues in these steps:

1. Identifiers. Epics are `E00` to `E22`, stories `E01-S02`, tasks `E01-S02-T03`. The design tasks D1 to D4 are tasks under the story that owns the screen. Blockers name identifiers until the issues exist.
2. Plan files. [14-roadmap.md](14-roadmap.md) holds every epic with its stories, and the tasks of E00, E01 and the design tasks D1 and D2. From E02 on, each epic gets one shaping file, `docs/plan/Enn-<slug>.md`, with its stories and tasks as thin vertical slices, written when the epic is shaped. Each epic starts with the task "docs: record the Enn plan and ADRs", labelled `human` and closed by the docs pull request that adds the shaping file and the epic's ADRs.
3. Creation. An interactive planning session creates the issues with handoff's tools in dependency order: `create_epic`, `create_story`, then `create_task` with `blocked_by` and without `size`. Stories and tasks carry no size; epics keep their estimates in raw days as planning information. It adds story context and Design sections with `gh issue edit`. The first line of every issue body is `Plan: <id>`. Krister approves every write on handoff's approval card. Run agents never open issues; they put follow-ups in the pull request description.
4. Write-back. After an issue exists, the session writes its number next to the identifier in the plan file, once: `E01-S02-T03, #42`. From then on the issue is the source of truth for scope, and the plan file is not edited for that item again.
5. Ready. Krister moves a task to Ready when the definition of ready holds, including the rule that every linked ADR is accepted with an empty needs-confirmation.
6. Build. handoff's scheduler is not used. The operating session reads `list_plan` and `list_backlog`, starts the next Ready task without open blockers with `start_run`, names the graph for that run, follows the run events, and brings every question, permission request, failed run and merge decision to Krister. The graph ladder (`northmes-guided`, `northmes-standard`, `northmes-lean`) and the switch rule are in [docs/agents/handoff/README.md](../agents/handoff/README.md). handoff's merge queue squashes the pull request and closes the task, and each merged task earns its share of its epic's estimate in the weekly ledger below. Krister checks a story's criteria on `main` and closes the story.

The issue formats, labels, Project fields and the definitions of ready and done are in [13-delivery-and-github.md](13-delivery-and-github.md#shaping-the-plan-into-issues). The rules for converting the roadmap are in [14-roadmap.md](14-roadmap.md#how-to-turn-this-roadmap-into-issues).

## Status legend

ADR status, from each ADR's front matter. The rules for statuses and needs-confirmation are in [docs/adr/README.md](../adr/README.md#statuses).

| Status | Meaning |
|---|---|
| `proposed` | Drafted by a planning session; waits for Krister to accept or change it. A task under it carries `human` or stays in Shaping. |
| `accepted` | Krister made the decision. Tasks may depend on it once its needs-confirmation is empty. |
| `rejected`, `deprecated`, `superseded by ADR-NNNN` | Not in force. The file stays, and a superseded ADR names its replacement. |
| needs-confirmation | Who still has to confirm which part (maintainer, product owner, pilot IT, lawyer). Empty means nothing waits. |

Rule markers in plan documents. [07-production-planning.md](07-production-planning.md) marks each rule this way; the other documents give the status of the ADRs they depend on in their decisions table.

| Marker | Meaning |
|---|---|
| Decided | The rule comes from an accepted ADR. |
| Proposed | The rule comes from a proposed ADR; Krister accepts or changes it through that ADR. |
| Open | The product owner, pilot IT or the lawyer must answer. The working default applies until then, and the code keeps the choice behind a setting or a single function. |
| Plan proposal | No ADR covers the rule yet. The shaping session confirms it with Krister before a task depends on it. |

Issue status on the GitHub Project ([13-delivery-and-github.md](13-delivery-and-github.md#labels-and-project-fields)):

| Status | Meaning |
|---|---|
| Shaping | Every issue starts here. |
| Ready | Only Krister moves a task here, when the definition of ready holds. |
| Running | handoff sets it when a run starts. |
| In review | handoff sets it when the pull request opens. |
| Done | handoff sets it when the pull request merges. A cancelled run puts the task back. |

Other markers:

- A question in [16-open-questions.md](16-open-questions.md) stays open until its row is marked answered with the date. Until then its working default applies.
- A box in [ADRs needed by M0](#adrs-needed-by-m0) is ticked when the ADR is accepted and its needs-confirmation is empty.
- Checkpoint dates after M3 in [14-roadmap.md](14-roadmap.md#milestones-under-option-b) are proposals.

## Personas

This table is the persona list. Stories, issues, issue forms and design header frames use it and no other ([ADR 0049][adr-0049]). A test checks that the persona options in the issue forms equal this table. [14-roadmap.md](14-roadmap.md#personas) repeats it for the session that shapes issues; this file is the source.

| Persona | Who |
|---|---|
| Planner | Plans production orders on the board and in the job order table view, runs autoplan, saves drafts and handles ERP changes. |
| Operator | Signs in at a station by badge or personal login, starts, pauses and finishes jobs, and reports good and scrap quantities. |
| Plant admin | Sets up a company and its plants: users, roles, master data, calendars, settings, the Pyramid connector, AI providers and stations. Also installs and upgrades NorthMES on the customer's server together with the customer's IT. |
| Plugin developer | Builds a module or plugin on the `defineModule` contract: validators, slot widgets, subgraphs and remotes. Integration work such as an ERP connector counts here. |
| Maintainer | Builds and releases NorthMES itself: the repository, CI, the delivery workflow and the platform packages. |
| Hosting partner | A consultant or provider who installs and runs NorthMES for customers, one installation per customer. In release 1 it creates a customer's companies and their first company admins with scriptable CLI commands on the host, recovers company admins, and may run the onboarding wizard for the customer. |

## Weekly ledger

This table measures velocity under option B ([ADR 0055][adr-0055]). Krister fills one row each Friday from the merged tasks per epic on the plan Project and handoff's weekly log in [docs/agents/handoff/README.md](../agents/handoff/README.md). The credit comes from epic estimates and counts of merged tasks; stories and tasks carry no size. The meaning of each column, the ledger credit rule and how a checkpoint turns the rows into a pilot date are in [14-roadmap.md](14-roadmap.md#the-weekly-ledger-row). Cumulative and the 1x line count from Thu 2026-10-15. Rows before M1 (Fri 2026-11-20) may stay empty; from M1 every week has a row. The Week ending column is filled up to M2 (Fri 2027-01-22), the first velocity checkpoint, which needs at least eight rows; later rows are added in the same form. Krister reviews the rows with the risk register in [17-risks.md](17-risks.md).

| Week ending | Working days | Merged tasks | Ledger days earned | Cumulative | 1x line | Against the line | Rate | Median gate minutes per task | Merged tasks per working day | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 2026-10-16 | | | | | | | | | | |
| 2026-10-23 | | | | | | | | | | |
| 2026-10-30 | | | | | | | | | | |
| 2026-11-06 | | | | | | | | | | |
| 2026-11-13 | | | | | | | | | | |
| 2026-11-20 | | | | | | | | | | |
| 2026-11-27 | | | | | | | | | | |
| 2026-12-04 | | | | | | | | | | |
| 2026-12-11 | | | | | | | | | | |
| 2026-12-18 | | | | | | | | | | |
| 2026-12-25 | | | | | | | | | | |
| 2027-01-01 | | | | | | | | | | |
| 2027-01-08 | | | | | | | | | | |
| 2027-01-15 | | | | | | | | | | |
| 2027-01-22 | | | | | | | | | | |

## Epic order

The epics run in this order. Their dependencies, estimates and milestones are in [14-roadmap.md](14-roadmap.md#epics-in-dependency-order).

| Epic | Title |
|---|---|
| E00 | repo: Make the repository ready for the first handoff run |
| E01 | platform: Settle the first decisions with five spikes |
| E02 | platform: Boot a walking skeleton end to end |
| E03 | planning: Plan production in a pure scheduling package |
| E04 | web: Ship the shell, design tokens and shared UI patterns |
| E05 | core: Sign users in and make every write an audited command |
| E06 | core: Hold master data, units, settings and plant calendars |
| E07 | planning: Plan orders in per-planner drafts and run autoplan |
| E08 | planning: Move job orders on the board and in the table view |
| E09 | pyramid-connector: Import Pyramid orders, materials and stock |
| E10 | pyramid-connector: Write the committed plan back to Pyramid |
| E11 | production-start: Report production at an online station |
| E12 | planning: Answer planning questions through tools and /mcp |
| E13 | ai: Configure customer AI providers and meter usage |
| E14 | ai: Answer read-only planning questions in the assistant |
| E15 | planning: Review agent proposals into the planner's draft |
| E16 | core: Report health, readiness and System health |
| E17 | ops: Install on a pilot-like VM with backups and a timed restore |
| E18 | ops: Release, upgrade and roll back an installation |
| E19 | docs: Publish the docs site at docs.northmes.dev |
| E20 | web: Hold WCAG 2.2 AA with gates and screen-reader passes |
| E21 | plugins: Build the example plugins outside the workspace |
| E22 | core: Keep the regulated path open |

## ADRs needed by M0

M0 (Fri 2026-10-30) requires these ADRs to be accepted ([14-roadmap.md](14-roadmap.md#milestones-under-option-b)). A box is ticked when the ADR is accepted and has no open needs-confirmation, which is the rule a task needs to move to Ready. The front matter of each ADR is the source of truth for its status; the status in parentheses is the state on 2026-10-05.

E02 needs:

- [ ] [0003][adr-0003] module package and manifest (proposed)
- [ ] [0006][adr-0006] migration roles and naming (proposed)
- [x] [0015][adr-0015] backend federation rules (accepted)
- [ ] [0019][adr-0019] web remote contract and CSS rule (accepted; needs-confirmation: pilot IT, browser versions)
- [ ] [0037][adr-0037] plugin surface and validator payload (accepted; needs-confirmation: maintainer and product owner)
- [x] [0041][adr-0041] test layout and harness (accepted)
- [ ] [0058][adr-0058] developer environment (proposed)
- [x] [0060][adr-0060] configuration and the environment schema (accepted)
- [x] [0062][adr-0062] web form contracts, URL view state and module link manifests (accepted)
- [x] [0064][adr-0064] REST routes under /api/v1, reserved ids and slugs, the boot route check (accepted)

E03 and the rest of M0 need:

- [ ] [0029][adr-0029] per-planner drafts, soft locks and the plan revision (accepted; needs-confirmation: product owner)
- [ ] [0055][adr-0055] release 1 scope and the scope rule (accepted; needs-confirmation: maintainer, ledger additions)
- [ ] [0005][adr-0005] Postgres 18 official image with pgBackRest (accepted; needs-confirmation: maintainer, the pgBackRest source fallback)
- [ ] [0004][adr-0004] monorepo tooling and the Node pin after the week 1 test (proposed)
- [ ] [0057][adr-0057] scheduling domain as a pure package (proposed)

## Decisions waiting for the maintainer

These decisions wait for Krister Johansson on 2026-10-05. Each question id points at its group in [16-open-questions.md](16-open-questions.md#the-maintainer), which gives the working default the plan and the code use until Krister answers. After the answer, the planning session updates the ADR, the question's row and this list. Questions for the product owner and pilot IT are in the same document.

### ADRs to accept

31 ADRs are proposed: [0003][adr-0003], [0004][adr-0004], [0006][adr-0006], [0008][adr-0008], [0009][adr-0009], [0011][adr-0011], [0012][adr-0012], [0014][adr-0014], [0017][adr-0017], [0020][adr-0020], [0024][adr-0024], [0025][adr-0025], [0026][adr-0026], [0027][adr-0027], [0028][adr-0028], [0030][adr-0030], [0031][adr-0031], [0032][adr-0032], [0040][adr-0040], [0045][adr-0045], [0046][adr-0046], [0047][adr-0047], [0054][adr-0054], [0056][adr-0056], [0057][adr-0057], [0058][adr-0058], [0059][adr-0059], [0065][adr-0065], [0066][adr-0066], [0067][adr-0067] and [0068][adr-0068]. The ones M0 needs are in the checklist above.

### ADR parts to confirm

| ADR | Part Krister confirms | Question |
|---|---|---|
| [0004][adr-0004] | Node pin after the week-1 test; TypeScript 6.0.x | M-01 |
| [0005][adr-0005] | the pgBackRest source fallback until PGDG publishes 2.59.3 | none |
| [0007][adr-0007] | one plant at a time | M-12 |
| [0010][adr-0010] | operator placeholder email | M-08 |
| [0013][adr-0013] | lifecycle classes; tool results as exports | M-06, M-07 |
| [0020][adr-0020] | Base UI; token base | M-03 |
| [0034][adr-0034] | off by default per installation; personal access tokens before OAuth | M-10 |
| [0035][adr-0035] | Google in release 1 | M-11 |
| [0037][adr-0037] | no third-party plugin on the pilot; web-only plugins degrade | M-13 |
| [0038][adr-0038] | no range override in 0.x | M-13 |
| [0045][adr-0045] | disk layout, offsite target, RPO and RTO, together with pilot IT | M-14, IT-31 |
| [0048][adr-0048] | docs content license | M-16 |
| [0049][adr-0049] | persona list, epic order | M-15, M-04 |
| [0055][adr-0055] | ledger additions | M-04 |
| [0057][adr-0057] | the whole decision | M-02 |
| [0059][adr-0059] | no TimescaleDB backend from the project | M-50 |
| [0066][adr-0066] | the company admin role holding every installed permission | M-61 |
| [0067][adr-0067] | the top bar slot id; top bar items drawn from data | none; M-64 |
| [0068][adr-0068] | the ledger rows of the nine release 1 pieces; the AI budget banner as the first banner contribution; top bar items drawn from data; roles only for plugin permissions; plant-free fields for the notifications module; the `command.rejected` security event at the first regulated sale; acceptance before the skeleton's validator story | M-62 to M-68 |

### Questions before M0

From [16-open-questions.md](16-open-questions.md#before-m0-2026-10-30):

| Id | Decision | ADR | Needed by |
|---|---|---|---|
| M-01 | Node 26 or Node 24 after the week-1 tests, and the TypeScript 6.0.x pin | [0004][adr-0004] | week 1, by 2026-10-23 |
| M-02 | The scheduling domain as `@northmes/planning-domain` in `modules/planning/domain` | [0057][adr-0057] | before E03 is shaped |
| M-03 | Base UI as the primitive library; shadcn neutral tokens with the contrast fixes as the token base | [0020][adr-0020] | before design task D1 |
| M-04 | The ledger additions, the epic order and first weeks, and gate batching | [0055][adr-0055], [0049][adr-0049] | 2026-10-30 |
| M-05 | Spike sources in `docs/sources/` and the list of ADRs E02 needs; the private companion repository exists since 2026-10-05 | [0049][adr-0049] | 2026-10-15 |
| M-06 | The lifecycle class of each table; job orders as record class | [0013][adr-0013] | 2026-10-30 |
| M-07 | Whether tool results sent to a model count as exports | [0013][adr-0013] | 2026-10-30 |
| M-08 | The placeholder email scheme for operators without an email address | [0010][adr-0010] | before the first identity migration |
| M-09 | The station's online-only promise in place of an outage queue | [0033][adr-0033] | 2026-10-30 |
| M-10 | `/mcp` off by default per installation; personal access tokens before OAuth sign-in | [0034][adr-0034] | 2026-10-30 |
| M-11 | Whether Google Vertex and the Gemini API ship in release 1 | [0035][adr-0035] | 2026-10-30 |
| M-12 | A company user works one plant at a time | [0007][adr-0007] | 2026-10-30 |
| M-13 | No version range override in 0.x; no third-party plugin on the pilot; web-only plugins degrade | [0038][adr-0038], [0037][adr-0037] | 2026-10-30 |
| M-14 | The pilot host's disk layout, with pilot IT (IT-31) | [0045][adr-0045] | before go-live |
| M-15 | The persona list | [0049][adr-0049] | 2026-10-30 |
| M-16 | The docs content license, the robots signal and the CAA record | [0048][adr-0048] | before the docs site goes live |
| M-17 | Approving the transfer of the repository to the `northMES` organization; SP0 is done (2026-10-05) | [0050][adr-0050] | before the first image push |
| M-18 | The release cadence | [0038][adr-0038] | before the first release |
| M-19 | How models the customer deploys in Azure outside Azure OpenAI reach NorthMES | [0035][adr-0035] | before the assistant is enabled |

### Delivery and review

From [16-open-questions.md](16-open-questions.md#delivery-and-review):

| Id | Decision | ADR |
|---|---|---|
| M-20 | Whether the pull request step waits for CodeRabbit while the repository has fewer than 10 stars | [0050][adr-0050] |
| M-21 | Whether the `main` ruleset requires resolved review threads | [0050][adr-0050] |
| M-22 | The format of requirement ids in test names | [0041][adr-0041] |
| M-23 | Hand translation with `gt generate` or a General Translation account | [0053][adr-0053] |

### Design points from the plan documents

From [16-open-questions.md](16-open-questions.md#design-points-from-the-plan-documents):

| Id | Decision | ADR |
|---|---|---|
| M-30 | `audit` as its own module folder or a second schema in core, and its migration order | [0013][adr-0013], [0002][adr-0002] |
| M-31 | Which modules ship a web remote | [0019][adr-0019] |
| M-32 | Whether release 1 ships a dashboard with the slot `core/dashboard/widgets/v1` | [0019][adr-0019] |
| M-33 | Whether core or production-start owns the scrap reason register | [0033][adr-0033] |
| M-34 | The server decimal library and GraphQL decimal scalar for article quantities | [0023][adr-0023] |
| M-35 | One spelling for error codes | [0012][adr-0012] |
| M-36 | The base of the problem `type` URI in REST errors | [0012][adr-0012] |
| M-38 | The route for the audit export | [0013][adr-0013] |
| M-39 | Whether the shell or the core remote owns the chat panel code | [0035][adr-0035] |
| M-40 | The manifest key names for lifecycle classes, audit field declarations and subscriptions | [0003][adr-0003] |
| M-41 | Whether the example validator drops its own table, or the docs say plugin tables need the later plugin database API | [0037][adr-0037] |
| M-42 | The planning proposals in [07-production-planning.md](07-production-planning.md) | [0028][adr-0028], [0029][adr-0029], [0013][adr-0013] |
| M-43 | The Pyramid connector design points | [0031][adr-0031], [0032][adr-0032] |
| M-44 | Data layer points: `core.event` and `core.inbox` policies, the migration audit surface, the pseudonymization role | [0014][adr-0014], [0013][adr-0013] |
| M-45 | GraphQL limits and list details | [0015][adr-0015], [0016][adr-0016] |
| M-46 | AI provider details: the Entra token scope, proxy behaviour, a local model | [0035][adr-0035] |
| M-47 | The name of the instant filter input | [0016][adr-0016] |
| M-48 | Whether the restore drill switch may stay an environment flag under rule 6 of ADR 0051 | [0045][adr-0045], [0051][adr-0051] |
| M-61 | Whether core's company admin role holds every installed permission | [0066][adr-0066] |
| M-62 | Whether the nine release 1 pieces of ADR 0068 enter the ADR 0055 ledger | [0068][adr-0068], [0055][adr-0055] |
| M-63 | Whether the AI budget banner is the `ai` module's contribution to `core/shell/banners/v1` | [0068][adr-0068] |
| M-64 | Whether the shell draws top bar items from data | [0068][adr-0068], [0067][adr-0067] |
| M-65 | Whether plugin permissions reach users through roles only | [0068][adr-0068], [0066][adr-0066] |
| M-66 | Whether the notifications module may declare plant-free fields | [0068][adr-0068], [0066][adr-0066] |
| M-67 | Whether the `command.rejected` security event and the validator record wait for the first regulated sale | [0068][adr-0068] |
| M-68 | Whether ADR 0068 is accepted before the walking skeleton's validator story moves to Ready | [0068][adr-0068] |

### Later decisions from the roadmap

- A ledger estimate for each epic that [14-roadmap.md](14-roadmap.md#epics-in-dependency-order) lists as not estimated (E00, E03, E09, E10, E17 and E18, and the unestimated parts of other epics), set when the epic's stories are created.
- Whether the planning session's estimate of 2026-10-06 holds for the ledger row that [ADR 0066][adr-0066] adds for company and plant administration and onboarding (E05-S14, E05-S15, E06-S14 and the module steps): 13 to 21.5 raw days. Krister left the figure open, and M-04 stays open. Velocity checkpoint 1 (M2) checks the part of E05-S14 and E05-S15, and velocity checkpoint 3 (M4) the part of E06-S14 and the module steps, which lands at M4.
- The pilot install date and the pilot test start, fixed at M4 (Fri 2027-04-30, proposed) from the three velocity forecasts, with cuts from the cut order in [01-product-and-scope.md](01-product-and-scope.md#the-cut-order-when-velocity-is-low) if the forecast misses the date.

[adr-0001]: ../adr/0001-record-architecture-decisions-in-madr.md
[adr-0002]: ../adr/0002-modular-monolith-with-module-owned-schemas-and-process-roles.md
[adr-0003]: ../adr/0003-module-package-shape-and-the-definemodule-manifest.md
[adr-0004]: ../adr/0004-monorepo-tooling-pnpm-turborepo-node-and-typescript-versions.md
[adr-0005]: ../adr/0005-postgres-18-official-image-with-pgbackrest-timescaledb-deferred.md
[adr-0006]: ../adr/0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md
[adr-0007]: ../adr/0007-tenancy-company-plants-and-the-scope-tree.md
[adr-0008]: ../adr/0008-row-level-security-with-transaction-local-scopes.md
[adr-0009]: ../adr/0009-code-uniqueness-per-scope-with-an-exclusion-constraint.md
[adr-0010]: ../adr/0010-identity-with-better-auth-roles-and-permissions-in-core-tables.md
[adr-0011]: ../adr/0011-principals-credentials-and-same-origin-rules.md
[adr-0012]: ../adr/0012-commands-as-the-single-write-path.md
[adr-0013]: ../adr/0013-audit-trail-written-in-the-command-transaction.md
[adr-0014]: ../adr/0014-outbox-event-log-and-pg-boss-jobs.md
[adr-0015]: ../adr/0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md
[adr-0016]: ../adr/0016-graphql-list-conventions-connections-relations-filter-sort-search-and-group-by.md
[adr-0017]: ../adr/0017-zod-contracts-as-the-single-source-for-inputs.md
[adr-0019]: ../adr/0019-web-shell-with-react-module-federation-remotes.md
[adr-0020]: ../adr/0020-frontend-libraries-tanstack-router-apollo-client-4-shadcn-ui-and-forms.md
[adr-0023]: ../adr/0023-si-units-with-a-northmes-unit-catalog.md
[adr-0024]: ../adr/0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md
[adr-0025]: ../adr/0025-plant-calendars-shift-patterns-and-the-production-day.md
[adr-0026]: ../adr/0026-planning-domain-names-aligned-with-isa-95.md
[adr-0027]: ../adr/0027-planned-duration-formula-and-override-precedence.md
[adr-0028]: ../adr/0028-autoplan-as-a-pure-deterministic-function.md
[adr-0029]: ../adr/0029-per-planner-drafts-soft-locks-and-the-plan-revision.md
[adr-0030]: ../adr/0030-a-planning-board-built-in-house.md
[adr-0031]: ../adr/0031-erp-integration-connector-modules-field-ownership-and-pending-changes.md
[adr-0032]: ../adr/0032-pyramid-connector-polling-file-mode-and-shadow-write-back.md
[adr-0033]: ../adr/0033-online-operator-station-in-the-production-start-module.md
[adr-0034]: ../adr/0034-mcp-surface-one-endpoint-a-read-mostly-planning-toolset.md
[adr-0035]: ../adr/0035-ai-provider-port-with-customer-configured-providers.md
[adr-0037]: ../adr/0037-plugins-drop-in-packages-command-validators-and-ui-slots.md
[adr-0038]: ../adr/0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md
[adr-0040]: ../adr/0040-dependency-license-policy-ci-gate-and-sbom.md
[adr-0041]: ../adr/0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md
[adr-0045]: ../adr/0045-backups-restore-drills-upgrades-and-rollback.md
[adr-0046]: ../adr/0046-observability-structured-logs-host-checks-and-optional-opentelemetry.md
[adr-0047]: ../adr/0047-secrets-and-the-installation-key.md
[adr-0048]: ../adr/0048-documentation-on-docs7-at-docs-northmes-dev.md
[adr-0049]: ../adr/0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md
[adr-0050]: ../adr/0050-github-organization-rulesets-ci-runners-and-supply-chain.md
[adr-0051]: ../adr/0051-regulated-readiness-no-regret-rules.md
[adr-0053]: ../adr/0053-translation-english-first-general-translation-later.md
[adr-0054]: ../adr/0054-file-storage-port-with-a-postgres-driver.md
[adr-0055]: ../adr/0055-release-1-scope-under-option-b-and-the-scope-rule.md
[adr-0056]: ../adr/0056-mit-sdk-packages-the-extension-exception-and-the-trademark-policy.md
[adr-0057]: ../adr/0057-scheduling-domain-as-a-pure-package-in-the-planning-module.md
[adr-0058]: ../adr/0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md
[adr-0059]: ../adr/0059-time-series-storage-port-with-an-open-default-backend.md
[adr-0060]: ../adr/0060-configuration-with-nestjs-config-one-zod-environment-schema-and-secret-files.md
[adr-0062]: ../adr/0062-web-form-contracts-url-view-state-and-module-link-manifests.md
[adr-0064]: ../adr/0064-rest-routes-under-api-v1-and-openapi-from-zod-contracts.md
[adr-0065]: ../adr/0065-coderabbit-check-run-and-a-required-approval-on-main.md
[adr-0066]: ../adr/0066-companies-created-by-the-cli-plant-slugs-unique-per-installation-admin-pages-at-admin-and-an-onboarding-wizard-before-a-plant-opens.md
[adr-0067]: ../adr/0067-plant-switcher-across-companies-nav-icons-by-lucide-name-and-a-top-bar-slot.md
[adr-0068]: ../adr/0068-extension-points-declared-by-their-owners-contributions-as-manifest-data-with-code-by-id-and-a-plugin-inventory.md
