---
status: "proposed"
date: 2026-10-08
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: Krister Johansson
informed: contributors, coding agents, pilot IT, hosting partners
release: "1"
needs-confirmation: "maintainer (the company admin role holding every installed permission)"
---

# Companies created by the CLI, plant slugs unique per installation, company settings at /settings and an onboarding wizard before a plant opens

## Context and problem statement

One installation serves one customer, which may hold several companies ([ADR 0007][adr-0007]). The scope tree has the company as its root, so a role is held at a company or at a plant, and no permission can grant the right to create a company. [ADR 0011][adr-0011] creates the first admin with `northmes admin create` but does not say which role that user holds. No document says how a new company or a new plant gets the values planners need before they start: a time zone and production day start without a default ([ADR 0025][adr-0025]), a calendar, machines and planning rules.

While reviewing design task D2 (the shell, navigation and station frame, issue northMES/northmes#190) on 2026-10-05, Krister Johansson decided, in two rounds:

1. A user gets roles only, never permissions directly. Direct permission grants are added later if a need appears.
2. The people who install and run NorthMES create companies with the command line tool on the host. No role exists above the company, so a company cannot create a company. There is no installation level of roles and no admin page that creates companies.
3. The same tool sets up each new company's first company admin, and it is the recovery path when a company has lost every company admin.
4. The tool also serves hosting partners, the consultants and providers who install and run NorthMES for customers: it is scriptable, so a partner sets up a customer's companies and first admins without the UI. One installation still serves one customer.
5. Company admins create the company's plants on admin pages.
6. On the first sign-in to a new company, and when a new plant is created, the admin goes through an onboarding wizard, so that everything the system needs is in place before people use the plant.
7. The admin pages and the onboarding wizard are part of release 1.
8. A plant slug is unique per installation instead of per company, so planner URLs stay `/$plant` when one user has plants in several companies.
9. The shell's plant switcher lists the user's plants grouped by company, so the shell needs the user's companies and plants from the server. Today `/api/v1/web/modules` returns only the current plant (question Q4 of the D2 spec page).
10. Admin pages need a route outside `/$plant`, because a new company has no plant yet.

On 2026-10-06 Krister Johansson answered two questions this ADR raised: the admin mount's path is `/admin`, with `admin` a reserved plant slug (M-59), and `northmes installation set` on the host sets the installation-wide settings (M-60). He also named the wizard onboarding, because the [glossary](../../GLOSSARY.md) uses setup for the first part of a job order. On the same day he decided to wait with the onboarding wizard until production planning is built, so that its steps follow what planning needs. The wizard stays in release 1.

On 2026-10-08 he decided that one Settings area holds the administration, in place of the `/admin` mount and of the Administration section at the foot of the plant sidebar that design task D2 drew. In the variations round of design task #313 ([record](../design/shell/shell-313-settings-variations.md)) he chose option C, settings in the page: a Settings button in the top bar; separate company settings and plant settings, each with its own settings navigation inside `main` beside the page; company settings at `/settings/$companyId/...`; plant settings under their module paths in `/$plant`. He added that the main sidebar collapses on its own on a page with a settings navigation, so the page gets more space. The admin mount of this ADR becomes the company settings mount, under [The settings area](#the-settings-area).

This ADR decides the CLI commands that create companies and company admins, what becomes of `northmes admin create`, the command that creates plants, the slug rule, the onboarding wizard and the gate that keeps a plant closed until its onboarding is complete, when the wizard and the gate are built, the fields that list a user's companies and plants, and the settings area. It covers core's tenancy and onboarding tables, the plant check in the principal resolver, the CLI in the one-off migrate container, `/api/v1/web/modules`, the shell's mount points and layout, the remote contract, the manifest's `onboarding` key, core's link manifest and core's plant slug schema. User management inside a company stays as [ADR 0010][adr-0010] and [ADR 0011][adr-0011] decide it. The shell's switcher, crumbs and nav icons are in [ADR 0067][adr-0067].

It changes parts of the accepted ADRs 0007, 0010, 0013, 0019, 0021, 0022, 0033, 0034, 0051, 0055, 0060, 0061, 0062 and 0064, listed under [Parts of accepted ADRs this decision changes](#parts-of-accepted-adrs-this-decision-changes). Those files keep their text, as the [ADR rules](README.md) require.

## Decision drivers

* Krister Johansson's decisions of 2026-10-05, his answers and decision of 2026-10-06, and his choice of 2026-10-08 of the settings area, listed above.
* The wizard's steps follow what production planning needs, so they are built once planning reads the plant, its calendar and its machines.
* Nothing granted inside NorthMES reaches above a company: no role, permission or page lets one company create or enter another.
* Creating a company and recovering its admins needs shell access to the host, which the customer's IT or the hosting partner already holds for the first admin ([ADR 0011][adr-0011]).
* A hosting partner scripts a customer's setup: commands never prompt, print JSON on request, use exit codes, and can run twice without creating anything twice.
* Every write is a command with an audit row, CLI writes included ([ADR 0013][adr-0013]).
* Row-level security computes its write set from roles in the tree ([ADR 0008][adr-0008]), and one `can()` answers every permission question ([ADR 0010][adr-0010]).
* A plant opens to planners, operators, stations, MCP clients and the assistant only when the values without a default exist: the zone, the production day start, shift times and a plannable machine ([ADR 0025][adr-0025]).
* Onboarding state lives on the server, so a second admin or a second browser resumes it.
* The wizard is a form flow that meets WCAG 2.2 AA like every screen ([ADR 0021][adr-0021]).
* A user with plants in two companies keeps short plant URLs and can keep two plants open in two tabs ([ADR 0007][adr-0007]).
* The scope rule: a manifest key ships in the same task as the code that reads it ([ADR 0055][adr-0055], [ADR 0022][adr-0022]).

## Considered options

For creating companies and their first company admins:

* CLI commands on the host, run in the one-off migrate container
* Installation roles outside the scope tree, with a companies page for installation admins
* An installation node above the companies in `core.scope`
* Better Auth's admin plugin role (`user.role` set to `admin`) as the flag for who may create companies
* A list of usernames in the configuration

The slug rule, the endpoint, the settings routes, the gate and the other smaller choices are under [Smaller choices](#smaller-choices).

## Decision outcome

Chosen option: "CLI commands on the host, run in the one-off migrate container", because Krister Johansson decided that only the people who install and run NorthMES create companies. No role, table or `can()` target then exists above the company, so the tree, the ancestor walk, the plant check's role rule and the write set stay as they are. The same commands give a hosting partner a scriptable setup and give every company a recovery path for its admins.

### Roles only

A user gets permissions only through roles assigned at a scope node ([ADR 0010][adr-0010]). Direct permission grants to a user are not built in release 1, and nothing is prepared for them; they are added when a need appears.

### The company commands

```text
docker compose run --rm migrate northmes company create \
  --name <text> --admin-username <username> \
  [--id <uuidv7>] [--admin-name <text>] [--admin-email <address>] \
  --reason <text> [--json]

docker compose run --rm migrate northmes company add-admin \
  --company <company id> --username <username> \
  [--name <text>] [--email <address>] \
  --reason <text> [--json]

docker compose run --rm migrate northmes company list [--json]

docker compose run --rm migrate northmes admin reset-password \
  --username <username> --reason <text> [--json]
```

* The commands run in the one-off migrate container with the migrate configuration ([ADR 0060][adr-0060]), which receives `auth_secret` when Better Auth needs it to create a user (M-53). Only a person who can run `docker compose` on the host runs them. The app has no route, GraphQL field or page that creates a company.
* Better Auth's organization plugin is used only through server-side `auth.api` calls, as its admin plugin is ([ADR 0010][adr-0010]). Every `/organization/*` path under `/api/v1/auth` is in `disabledPaths` and answers 404, because the plugin otherwise lets any signed-in user create an organization (`allowUserToCreateOrganization` defaults to true) and lets an owner member delete one or change its members. `disabledPaths` does not affect `auth.api` calls on the server, so the CLI still creates organizations.
* `company create` writes in one command: the Better Auth organization, created on the server through `auth.api.createOrganization` with the company id as its slug and the first admin as its owner member; the company node in `core.scope`; the company's `core.onboarding` row; and the assignment of core's company admin role to the first admin at the company node.
* `--admin-username` names an existing user or a new one. A new user is created through the same core user creation that the user management commands use ([ADR 0011][adr-0011]): the CLI prints a temporary password once, the user must change it at the first sign-in ([ADR 0051][adr-0051] rule 13), and a missing `--admin-email` gives a placeholder address under `.invalid` ([ADR 0010][adr-0010]). An existing user, such as a consultant who admins several companies, gets the role and no new password.
* `company add-admin` assigns core's company admin role at an existing company to an existing or a new user, and adds the user to the company's organization as a member when the user is not one. It is the recovery path when a company has lost every company admin (M-58), and the way to create the second admin account the go-live checklist asks for. It writes the membership through Better Auth first and core's command second, as `company create` does, so a run that fails between the two leaves a member without the role, and running the same command again assigns the role. A user who already holds the role and is a member makes it a no-op with exit code 0. A banned user is refused with exit code 3, and recovery then names a new user.
* `company list` reads only and writes no command row. It prints each company's id, name, onboarding state, plant count and the usernames of its company admins, so a script can check the state before it acts.
* `admin reset-password` keeps its role from [ADR 0011][adr-0011]: it gives any user a temporary password and prints it once.
* `northmes admin create` is removed. A user who holds no role at a company could do nothing, and `company create` creates the first admin together with the company.
* `--id` takes a uuidv7 and makes a script idempotent ([04 data and platform](../plan/04-data-and-platform.md#keys-versions-archive-and-provenance)). Without it, the CLI creates one and prints it. A second run with the same id and the same input exits 0 with `"replayed": true`, creates nothing and prints no password; a lost password is reset with `admin reset-password`. The same id with different input exits 3. Better Auth writes through its own pool, so a run that fails between Better Auth's write and core's command is completed by running the same command again. `"replayed": true` means that core's command for the id has committed. Until then a rerun finds the organization by its slug, the company id, and the user by username, creates only what is missing, runs core's command and exits 0 with `"replayed": false`. When the failed run created the user, the rerun prints no password, as for an existing user, and `admin reset-password` gives the user one.
* Output is plain text, or one JSON object with `--json`, for example `{ "companyId": "0199b8f2-4c1e-7a3b-9d2e-5f6a7b8c9d0e", "adminUserId": "0199b8f2-4c1f-7c4d-8e5f-6a7b8c9d0e1f", "adminUsername": "alex.lund", "newUser": true, "temporaryPassword": "<printed once>", "replayed": false }`, where `temporaryPassword` appears only for a new user. Exit codes: 0 done, 1 unexpected error, 2 usage error, 3 refused (id conflict, retired username, banned user), 4 company not found. No command prompts, and no command takes a password as a flag, so no password reaches the shell history or the process list.
* A temporary password appears only on standard output, never in a command row, a security event, a log line or `company list`. A script that runs the commands with `--json` treats the output as a secret and keeps it out of its own logs. The password is temporary and must be changed at the first sign-in ([ADR 0051][adr-0051] rule 13).
* The commands have no rate limit of their own, because nobody reaches them over the network. The first admin's sign-in goes through Better Auth's limiter like every sign-in.
* The onboarding wizard is not a web setup route in the sense of [ADR 0011][adr-0011]: it needs a signed-in user who holds `core.onboarding:manage`, which a company first gets from `company create`. A database without companies still serves no route that creates a user, a company or a role assignment.
* Each write is a command with principal type `system`, the system principal `core.cli` that a migration seeds, surface `cli`, the company node as its scope and `--reason` as its reason. `--reason` is required. Each write also records one security event, `cli.company_created`, `cli.company_admin_added` or `cli.password_reset` (names proposed), whose `detail` holds ids and never a password.
* The app drops its permission cache only for role writes in its own process, so an assignment from the CLI takes effect within the cache's 30-second TTL ([ADR 0010][adr-0010]).

### Core's company admin role

* Core's manifest ships the company admin role. The permission sync in `northmes migrate` gives it every installed permission, those of plugins included, so its holder can assign any default or custom role under the rule of [ADR 0010][adr-0010] that the assigner holds every permission of the role, and can do every onboarding step. This waits for Krister Johansson's confirmation (M-61).
* The CLI assigns it on the host as `core.cli`, outside `can()`. This is the only way a role is assigned without the assigner holding it, and no GraphQL field does it.

### Plants

* `core.createPlant({ id, companyId, name, slug, timeZone, productionDayStart })` needs `core.plant:create` at the company node, which core's company admin role holds. It creates the plant node with its span from the next plant number ([ADR 0007][adr-0007]), the `core.plant` row and the plant's `core.onboarding` row. A company role reaches the new plant through the ancestor walk, so the command adds no assignment.
* The zone and the production day start have no default ([ADR 0025][adr-0025]). They can be changed during onboarding until the plant's first calendar version exists, because calendar versions and imported order times are read in the plant's zone. A later change waits for the product owner's answer on the day start ([ADR 0025][adr-0025]).
* `core.updateCompany` renames a company and needs `core.company:update` at the company node, which core's company admin role holds. The company's name is its Better Auth organization's name, so the command changes it through `auth.api` on the server.
* Archiving companies and plants is not in release 1.

### Plant slugs

* A plant slug is unique per installation: `core.plant` carries `unique (slug)` in place of a uniqueness per company. Core's plant slug schema also refuses `settings` and `admin` (see [The settings area](#the-settings-area)).
* A slug clash returns `fieldErrors` on `slug` with the code `core.plant_slug_taken` (its spelling follows M-35). The unique check bypasses row-level security, so a company admin learns that some plant uses the slug without learning which company holds it, as with codes ([ADR 0009][adr-0009]).
* The URL carries no company, and the server never reads Better Auth's active organization on the session. The plant check reads `x-northmes-plant` against the role assignments with the ancestor walk ([ADR 0007][adr-0007]). Two tabs on plants of two companies work as two tabs on two plants of one company do.
* Whether a slug can be renamed stays open for E05-S03 ([ADR 0064][adr-0064]). The wizard's plant step says that the slug appears in every URL.

### The onboarding wizard

The wizard has two parts. The company wizard runs in company settings at `/settings/$companyId/core/onboarding` on core's plant-free fields, because a new company has no plant. The plant wizard runs at `/$plant/core/onboarding`.

Company wizard:

| Step | Owner | Required | Holds |
|---|---|---|---|
| Company | core | no | The name from the CLI, with a rename |
| Formats | core | no | The company's presentation settings with a live sample of a date, a clock time and a number ([ADR 0061][adr-0061]); the defaults apply |
| First plant | core | yes | Name, slug, IANA zone from the server's list and production day start through `core.createPlant`; on success the admin moves to that plant's wizard |

Plant wizard, in this order:

| Step | Owner | Level | Required to open | Holds |
|---|---|---|---|---|
| Plant | core | plant | yes: confirmed by the admin | The name, the zone and the production day start, reviewed |
| Formats | core | plant | no | Inherit the company values or override them per field |
| Calendar | core | plant | yes: a version with at least one shift | The first calendar version with shifts and breaks, a week preview from the availability windows and plant holidays as non-working deviations. The step says that a version freezes on its effective date, and a start on another day than Monday asks for confirmation ([ADR 0025][adr-0025], rules 3 and 4) |
| ERP connection | pyramid-connector | company | no | Polling, file mode or not used; the endpoint and credentials; the mapping settings without a default (`cycleTimeBasis`, `fieldTimeUnits`) and `operatorReportingSystem`; the warehouse rules and the default plant. Write-back stays in shadow mode ([ADR 0032][adr-0032]) |
| Machines | core | plant | yes: one plannable machine | Equipment groups and equipment entered by hand, or the machines that a first import (upload or sync now) from the ERP connection step creates. It follows the calendar step, because `equipment.calendar_id` defaults to the plant calendar |
| Planning rules | planning | company, plant override | yes while a planning setting has no recorded default | Each default shown with the ADR that records it; a setting without a default must be filled ([16 open questions](../plan/16-open-questions.md#how-answers-are-recorded)) |
| AI assistant | ai | company | no | A provider, alias bindings, Test connection, the privacy acknowledgement, a budget and the features ([ADR 0035][adr-0035]); skipping leaves AI off |
| Stations | production-start | plant | no; shown only when `operatorReportingSystem` is `northmes` | Station records; pairing happens later at each station PC ([ADR 0033][adr-0033]) |
| People | core | company and plant | no | Users and their company and plant role assignments |
| Review and open | core | plant | | Every step as done, skipped (by whom, with an optional reason) or defaults in use; "Open plant" runs `core.completeOnboarding` |

* A module declares its steps in its manifest under `onboarding: [{ key, level, order, required, permission, link }]` (key name proposed) and registers a server check `isComplete(scopeId)` through its API module. The manifest key ships in the task that builds the code reading it. In release 1 only the modules in the NorthMES repository declare steps, and the catalog check refuses the key in a plugin's manifest.
* Core's wizard frame lists the steps with their state. A step of another module opens that module's own screen at `link`, a path the module builds from its own link manifest and the wizard query returns as data, so core imports nothing from the module ([ADR 0062][adr-0062]). That screen links back to the wizard.
* A step with level `company` edits company values. It appears as a step in the first plant's wizard, and later plants show it as done with a link to edit it. Company steps of other modules run on a plant route because only core declares plant-free fields, and their settings commands need a request plant.
* Each step needs the owning module's permission (`core.settings:manage`, `planning.settings:manage`, `pyramidConnector.settings:manage`, `ai.provider:manage` and the like) besides `core.onboarding:manage`. A required step whose permission the admin lacks shows the missing permission.
* Data steps are complete when the data exists, for example "the plant calendar has a version with a shift". Steps that only confirm defaults, and skips, are recorded as `core.onboarding_step` rows.
* The scrap reason register joins the stations step once M-33 names its owner. Operators and badges join the people step once a story builds badge enrolment.

### The wizard as a form flow

The wizard meets WCAG 2.2 AA like every screen ([ADR 0021][adr-0021]), and its step forms are ordinary command forms ([ADR 0062][adr-0062]).

* Each step is a route built with `screenRoute`, so it has its own title ("Calendar · Onboarding · Plant A · NorthMES") and `h1`, and focus moves to that heading when the step changes.
* The step list is a list of links in the fixed step order (WCAG 3.2.3). The current step carries `aria-current="step"`. Each step's state is written as text ("Done", "Skipped", "Required", "Needs permission planning.settings:manage"), never shown by color or icon alone (1.3.1, 1.4.1).
* Each step saves through `useCommandForm`, so server `fieldErrors` land on their fields and in the error summary, and the typed values stay after an error (3.3.1, 3.3.3). No step has a time limit (2.2.1).
* A value entered earlier in the flow is shown again instead of asked for again: the plant step shows the name, zone and day start from the first plant step (3.3.7).
* "Open plant" cannot be undone, so the review step lists every step's state and the plant's zone and production day start before the button, which meets 3.3.4 by review. The button's label names the plant.
* A step of another module links back to the wizard from its own screen, and the wizard's step list shows the new state on return.

### The plant gate

* A plant is open when its `core.onboarding` row has `completed_at`. The plant check in `PrincipalResolver`, which serves the gateway, subscriptions, REST routes, the chat route and `/mcp` ([ADR 0011][adr-0011]), admits a principal at a plant when it holds a role there through the ancestor walk, or, for a station, when the plant is the one its credential is scoped to ([ADR 0033][adr-0033]). The check gains one rule: at a plant that is not open, a principal passes only when it holds `core.onboarding:manage` at the plant through the ancestor walk. Any other principal that the check admits there gets `FORBIDDEN` with `core.plant_not_ready` (spelling follows M-35) and no `permission.denied` event, because it is authorized and the plant is not open yet. A principal that the check does not admit there still gets `core.plant_forbidden`. The module list is the one exception to the rule: after the plant check has admitted the principal at the plant, `GET /api/v1/web/modules?plant=...` answers a principal without `core.onboarding:manage` with 200, the `plant` object, no modules and no permissions, so the shell or the station frame can show that the plant is not open yet ([The user's companies and plants in the module list](#the-users-companies-and-plants-in-the-module-list)). A principal that the check does not admit there gets `core.plant_forbidden` from the module list too.
* A station principal holds no role, so the check admits it only at the plant of its credential. At a plant that is not open, every station request other than the module list fails with `core.plant_not_ready`, `core.stationOperatorSignIn` included, while an admin can create stations and approve their pairing. The module list answers the station with 200, the `plant` object with `onboardingState` `inProgress`, no modules, no permissions, an empty `companies` list and `admin: false`, so the station frame shows that the plant is not open yet. A station never gets `core.plant_forbidden` at the plant of its credential, because that code means an unauthorized plant and writes a `permission.denied` security event.
* Connector jobs and `northmes migrate` run outside `PrincipalResolver`, so an import during onboarding works; planners see the imported orders once the plant opens.
* A holder of `core.onboarding:manage` uses a plant in onboarding as usual, and the shell shows the banner with the plant's name, for example "Plant D is in onboarding. Until onboarding is complete, only people who manage its onboarding can open it.", with the link "Continue onboarding" to the wizard.
* The plant check caches whether a plant is open, and `core.completeOnboarding` drops that cache entry as a role change does.
* An open plant never closes again. Later gaps, such as every machine archived, show as warnings on System health.
* The plant fixtures in `@northmes/testing`, the end-to-end worker plants and the demo seed create plants whose onboarding is complete, unless a test asks for a plant in onboarding, so the gate breaks no test written before it.

### Onboarding state, resume and audit

* `core.onboarding (scope_id primary key, kind company or plant, started_at, started_by, completed_at, completed_by, version)` is a record-class table with row-level security on `scope_id`. `company create` writes the company's row, and `core.createPlant` writes the plant's row.
* `core.onboarding_step (scope_id, step_key, status done or skipped, recorded_by, recorded_at, reason, version)` is unique on `(scope_id, step_key)`.
* `core.recordOnboardingStep({ scopeId, stepKey, status, reason? })` confirms or skips a step, and `core.completeOnboarding({ scopeId })` opens a plant. Both need `core.onboarding:manage` at the node. `core.completeOnboarding` runs every required check again in its own transaction and fails with `core.onboarding_incomplete`, whose `details.steps` lists the open required steps. For a company's first plant it also completes the company's row. It emits `core.onboarding.completed { scopeId, kind }` (name proposed), so open shells fetch the module list again. It locks the plant's `core.onboarding` row before its checks, so two admins who press "Open plant" at the same time open the plant once: the second call finds the plant open and succeeds without a change or an event. A required value that another command removes after the checks pass, such as the last plannable machine archived, is a later gap of an open plant ([The plant gate](#the-plant-gate)).
* The wizard reads one query that returns each step as todo, done, skipped or blocked (with the reason) and opens the first todo step. The state is on the server, so another browser or another admin resumes it, and `version` gives two admins optimistic concurrency. Input that a step has not saved yet stays in component state, as in every form ([ADR 0062][adr-0062]), so a resume starts from the saved steps.
* Data a step writes goes through that module's ordinary commands (calendar, equipment, settings) with their change rows. The onboarding commands show in the plant's History tab and in the admin audit list, so a reviewer sees which defaults were confirmed and who skipped a step.
* `core.onboarding` and `core.onboarding_step` join the tables whose statement triggers bump `core.config_revision`, because opening a plant changes behaviour ([ADR 0051][adr-0051]).

### When the wizard is built

Krister Johansson decided on 2026-10-06 to wait with the onboarding wizard until production planning is built, so that its steps follow what planning needs. The wizard stays in release 1. The wizard's design task, the plant gate and the five module steps (formats, planning rules, ERP connection, AI assistant and stations) are built with it, in E06-S14.

* Production planning is epics E07 (orders, drafts and autoplan) and E08 (the board and the table view) of the [roadmap](../plan/14-roadmap.md). The wizard's story, E06-S14, waits for two of their stories. E07-S08 holds the planning rules per plant that the planning rules step shows. E08-S10 wires the board to live plan data and is the last planning story that reads what the plant, calendar and machines steps collect: it follows E08-S01, which draws the board in the plant's zone and production day with machines grouped by equipment group and non-working time from the availability windows, and E07-S09, which serves the board range and the late-order facts and follows the autoplan of E07-S07 over those windows.
* The five module steps arrive with E06-S14 instead of with the stories that build each module's settings and records (E06-S13, E07-S08, E09-S06, E11-S01 and E13-S03), because the manifest's `onboarding` key ships in the task that builds the code reading it. E06-S14 therefore also waits for those stories, and none of them waits for E06-S14.
* Until E06-S14 is built, a new plant is usable as soon as `core.createPlant` creates it (E05-S15): the plant check has no onboarding rule yet, and `/` sends no user to a wizard.
* The data migration that ships the gate in E06-S14 sets `completed_at` on the `core.onboarding` row of every plant that exists when it runs, and on the row of every company with a plant, in the audit context that `northmes migrate` opens ([ADR 0006][adr-0006]). Those plants were usable before the gate and an open plant never closes, so nobody loses access when the gate arrives. A company without a plant keeps its row open, and its admin lands in the company wizard. Every company and plant gets its row from the command that creates it, and the plant check treats a plant without a row as not open, so a missing row fails closed.

### Where a signed-in user starts

`/` decides where a signed-in user goes, from the fields below. The shell never picks a default plant ([ADR 0007][adr-0007]).

* A user who holds `core.onboarding:manage` at a company in onboarding goes to that company's wizard at `/settings/$companyId/core/onboarding`. With several such companies, the user stays on `/`, which lists them with their state and links to each company's settings (proposed; question 4 of the #313 variations round). After `company create`, this is the first admin's path: sign in, change the temporary password ([ADR 0010][adr-0010]), land in the company wizard.
* A user with exactly one open plant and `admin` false goes to that plant.
* A user with no open plant and `admin` true goes to the company landing `/settings/$companyId` when one company holds an admin page for the user, and stays on `/` when several do (proposed, as above).
* A user with no open plant and `admin` false sees the page "Your company is not open yet" ("Its onboarding is not complete. You can open its plants once an admin completes onboarding.") when every plant where the user holds a role is in onboarding, or reads that no plant is assigned yet.
* Every other user sees a page at `/` that lists their plants grouped by company, with a link to each company's settings where the user holds an admin permission.
* A direct link to a plant that is not open shows the page with the plant's name, for example "Plant D is not open yet" ("Its onboarding is not complete. You can open it once an admin completes onboarding."), to anyone who holds a role there without `core.onboarding:manage`.

### The user's companies and plants in the module list

`GET /api/v1/web/modules` gains these fields on every call from a user session:

| Field | Meaning |
|---|---|
| `companies` | `[{ id, name, onboardingState, plants: [{ id, slug, name, onboardingState }] }]`: every plant the user can open, grouped under its company, with `onboardingState` `inProgress` or `open`. A plant that is not open is listed only for a holder of `core.onboarding:manage` there. A company where the user holds a company role but which has no plant yet appears with an empty `plants` list. Companies and plants are sorted by name. |
| `admin` | `true` when company settings hold a page for the user: the user holds an admin permission at a company node, in release 1 `core.company:update`, `core.plant:create` or `core.onboarding:manage`. Later company settings pages add their permissions to this rule. |

* Called with `plant`, the response keeps every field it has today, adds the two above, and adds `plant.onboardingState`. For a plant in onboarding, a user who holds a role there without `core.onboarding:manage` gets 200 with the `plant` object, no modules and no permissions, so the shell renders the page with the plant's name, for example "Plant D is not open yet", instead of an error.
* Called by a user session without `plant`, it answers 200 with `plant: null`, `companies`, `admin`, no presentation values, and the permissions the user holds at each company node, keyed by company id, which company settings use. A user who is a company admin in one company and a planner in another sees the plant form only for the first. When `admin` is true, the module list holds the modules with company settings routes, which in release 1 is core alone; otherwise the list is empty.
* A station principal gets an empty `companies` list and `admin: false`. Its station response does not change at an open plant ([ADR 0033][adr-0033]); at a plant in onboarding it gets 200 with the `plant` object and no modules ([The plant gate](#the-plant-gate)).
* The shell reads both fields at boot, after every plant switch and after `core.onboarding.completed`, so a new plant or a new role shows after the next switch or reload.

### The settings area

Krister Johansson confirmed the path `/admin` on 2026-10-06 (M-59). On 2026-10-08 he replaced the `/admin` mount and D2's Administration section with option C of the #313 variations round, settings in the page ([record](../design/shell/shell-313-settings-variations.md)).

* Settings come in two areas, company settings and plant settings. Each has its own settings navigation, a `nav` landmark named apart from Main, inside `main` beside the page content, in one fixed order (WCAG 3.2.3).
* A Settings button in the top bar, before Help, opens the settings of the plant on screen. It is shell chrome with the lucide Settings icon, not a contribution to `core/top-bar/items/v1`, and Help keeps its fixed place (WCAG 3.2.6). A user with no settings entry sees no Settings button and keeps Profile in the user menu (proposed).
* When a page with a settings navigation opens, the main sidebar collapses on its own to the 64 px rail of D2, so the page gets more space: the table of a settings page keeps about 920 px at 1280 instead of about 730 px beside the expanded sidebar. Proposed with it: leaving settings returns the main sidebar to the user's own choice; a user who expands it on a settings page keeps it expanded for that visit; the collapse is announced to no one and moves no focus. At 320 the main sidebar is the navigation sheet, so nothing changes there.
* The skip link passes the settings navigation as well as the main navigation (WCAG 2.4.1).
* Company settings: `/settings/$companyId` is a shell mount beside `/$plant` and `/station/$stationId`. It renders the company settings layout without a plant and without the main sidebar, and its requests carry no `x-northmes-plant`. `$companyId` is the company id, because companies have no slug. The shell renders the company landing at `/settings/$companyId` from the company settings navigation, because its entries come from several modules; at 320 the landing lists the entries and each entry drills in, with a link back to the landing above its `h1`. Each module owns `/settings/$companyId/<id>/*`: a remote returns that subtree from `settingsRoutes?(settingsRoute)` in `defineWebModule` (name proposed), and the shell checks that the returned route's path equals the module id. In release 1 only core implements it.
* Core's company settings pages in release 1: General renames the company with `core.updateCompany`; `/settings/$companyId/core/plants` lists the company's plants and creates one, and a new plant goes straight to its wizard; `/settings/$companyId/core/onboarding` is the company wizard. The variations round also draws Formats, Users, Roles, Integrations, Audit log and the module settings Planning rules, AI assistant and Pyramid connector in company settings; each arrives with its own story. Paths come from core's link manifest, whose `settings` section builds `/settings/$companyId/<id>/...` from a company id and no plant ([ADR 0062][adr-0062]).
* Plant settings keep their module paths under `/$plant`, for example `/plant-a/core/machines` and `/plant-a/planning/settings`. A route's nav entry declares that it belongs in the plant settings navigation (`nav: { area: "settings", ... }`, name proposed), and the shell then draws the settings layout around that route and leaves the entry out of the main sidebar. The plant check, the per-plant Apollo client, `PresentationProvider`, the Assistant and the plant crumb work there as on every plant page. A company admin's plant settings navigation holds Plant, Machines, Equipment groups, Calendars, Stations and System health, then module and plugin settings, and at its foot a link to the company's settings, which a user without a permission at the company does not see.
* The plant sidebar loses its Administration section. Machines, Equipment groups and Calendars move from Core > Master data to plant settings; Articles, Routings, Customers and Production orders stay in the main sidebar. Tools, Warehouses, the import inbox and AI usage stay where D2 drew them while questions 6 and 9 of the variations round are open.
* A move between company settings and plant settings may load another module set and then is a full navigation ([06 web and UX](../plan/06-web-and-ux.md#shell-routes-and-mount-points)). Company settings pages link back to the plant the user came from, "Back to Plant A", or to `/` when the shell does not know it, and never pick a default plant.
* `settings` joins the reserved plant slugs, because a plant slug is the first segment of an SPA path. `admin` stays reserved while question 3 of the variations round, whether it stays reserved once `/admin` is gone, is open.
* Company settings pages have no plant, so their titles put the company name where the plant goes, for example "Users · Acme AB · NorthMES" and "Company settings · Acme AB · NorthMES", and their trail reads "Settings > Acme AB > Users". Plant settings pages keep the plant pattern, "Machines · Plant A · NorthMES", and their trail adds a Settings crumb after the plant: "Acme AB > Plant A > Settings > Machines". Every other rule of [ADR 0021][adr-0021] for titles, headings and focus holds.
* Requests from company settings carry no `x-northmes-plant`. The company settings layout renders one Apollo client created without a plant, and the shell fills `PresentationProvider` with `DEFAULT_PRESENTATION`; the formats step previews the values being edited.
* Core declares its company settings root fields plant-free (names proposed): `coreAdminCompanies`, `coreUpdateCompany`, `coreAdminPlants`, `coreCreatePlant`, `coreOnboarding` and `coreRecordOnboardingStep` at a company node, and core's settings fields for `core.presentation` at a company node. Each takes a company id, or returns only companies where `can()` passes, checks `can()` at the company node, and runs with read scopes that hold only the company nodes where that check passed and their plants, and with the write set of [ADR 0008][adr-0008] inside them.
* The gateway serves an operation without `x-northmes-plant` only when every root field in it is plant-free. Any other operation without the header fails as a request for an unknown plant does, with `FORBIDDEN` and `core.plant_forbidden`. Only core declares plant-free fields in release 1.
* The principal resolver and the plant check read `core.plant`, `core.scope`, `core.role_assignment` and `core.onboarding` before a request has scopes. The task that builds these tables records how row-level security covers each one (policies on the node id, or an allowlist entry with a reason) under [ADR 0008][adr-0008], and the catalog lint holds it.

### Installation settings

No role sits above a company, so the installation-wide settings get the same owner as companies: the CLI on the host. Krister Johansson confirmed this on 2026-10-06 (M-60).

```text
docker compose run --rm migrate northmes installation show [--json]
docker compose run --rm migrate northmes installation set <key> <value> --reason <text> [--json]
```

* Each key arrives in the task that builds the code reading it. Release 1 has three keys (names proposed):
  * `outbound.allowedHosts`: the hosts and ranges that the outbound URL rule admits on a private network, needed by a Pyramid endpoint or a model server on the plant LAN ([ADR 0047][adr-0047]).
  * `mcp.enabled`: the `/mcp` switch, off by default ([ADR 0034][adr-0034]).
  * `audit.securityEventRetentionDays`: the period after which security event partitions are dropped (E05-S13, [ADR 0013][adr-0013]). A monthly partition holds the events of every company, so the period cannot differ per company.
* The event log retention (`events.retentionDays`) also spans every company and becomes a key with the task that builds its cron, which no release 1 story does. `set` refuses an unknown key with exit code 2. The compliance profile keeps its own one-way CLI command ([ADR 0051][adr-0051]).
* The values live in `core.installation_setting (key, value, version)`, which only these commands write and which every request reads through a row-level security allowlist entry with a reason. The table carries the audit capture trigger, so each change also writes a change row, and its statement trigger bumps `core.config_revision`.
* `show` reads only and writes no command row and no security event, like `company list`. `set` writes a command with the same principal, surface, required reason, exit codes and `--json` as the company commands, plus one security event `cli.installation_setting_changed` (name proposed). Its command row carries no scope node.

### Hosting partners

A hosting partner runs `install.sh` and then a script of `company create` calls with fixed `--id` values and `--json`. The partner then either names the customer's admin as first admin and passes the temporary password on out of band, so that the customer's admin runs the wizards; or names one of its own consultants (one user across companies), runs the wizards for the customer, adds the customer's admin with `company add-admin` or on the people step, and later removes the consultant's role in the UI. In both cases the partner keeps `company add-admin` for recovery. One installation still serves one customer ([ADR 0007][adr-0007], [ADR 0051][adr-0051] rule 23).

### Parts of accepted ADRs this decision changes

The files below keep their text. Once this ADR is accepted, it holds over the parts listed here, and the rest of each ADR stands.

#### Changes to ADR 0007

[ADR 0007][adr-0007], tenancy:

| Section | Before | After |
|---|---|---|
| Companies, plants and the scope tree | "each plant has a slug that is unique per company" | each plant has a slug that is unique per installation |
| One plant per request | "In release 1 every request carries exactly one plant" | Requests from company settings at `/settings/$companyId` carry no plant and may select only core's plant-free fields; every other request carries exactly one plant |
| One plant per request | "The gateway checks `x-northmes-plant` against `core.role_assignment` with the ancestor walk." | Unchanged, and at a plant whose onboarding is not complete only a holder of `core.onboarding:manage` passes; any other principal with a role there gets `FORBIDDEN` with `core.plant_not_ready` and no security event ([The plant gate](#the-plant-gate)) |
| One plant per request | "Before one installation holds two companies, either the company joins the URL or the server rejects a slug outside the session's organization." | Slugs are unique per installation, so the URL carries no company, and the server never reads the session's active organization; the plant check decides |

#### Changes to ADR 0010

[ADR 0010][adr-0010], identity, roles and permissions:

| Section | Before | After |
|---|---|---|
| Better Auth configuration | "admin (used only through server-side `auth.api` calls from NorthMES commands; its HTTP paths are disabled" | Unchanged for the admin plugin. The organization plugin is used the same way: only through server-side `auth.api` calls, with every `/organization/*` HTTP path in `disabledPaths` |
| Roles and permissions | "Modules ship default roles in their manifests; company admins create custom roles from module permissions." | Unchanged, and core's manifest ships the company admin role, which the permission sync gives every installed permission. A user gets permissions only through roles |
| Roles and permissions | "Assigning a role at scope S needs the assignment permission plus every permission of that role at S." | Unchanged in the app. `northmes company create` and `northmes company add-admin` assign core's company admin role on the host as the system principal `core.cli`, without that check |
| Roles and permissions | "The gateway's principal plugin validates `x-northmes-plant` against `core.role_assignment` with the ancestor walk." | Unchanged, plus the onboarding rule of [The plant gate](#the-plant-gate) |

#### Changes to ADR 0013

[ADR 0013][adr-0013], audit trail:

| Section | Before | After |
|---|---|---|
| Decision outcome (Principals) | "`core.system_principal(id, module_id, key, display_name)` is seeded by migration per connector and per system job." | Also one row, `core.cli`, for the CLI commands of this ADR. Their command rows carry principal type `system`, surface `cli`, the company node as scope (none for an installation setting) and the required `--reason` |
| Decision outcome (Retention and personal data) | "security event partitions are dropped after a default period held in an audited settings row" | The period is the installation setting `audit.securityEventRetentionDays`, which `northmes installation set` changes on the host ([Installation settings](#installation-settings)) |

#### Changes to ADR 0019

[ADR 0019][adr-0019], web shell; the paths are the ones [ADR 0064][adr-0064] moved under `/api/v1`:

| Section | Before | After |
|---|---|---|
| Shell and boot | "At boot it fetches `GET /api/web/modules?plant=<slug>`" | On a plant route it fetches `GET /api/v1/web/modules?plant=<slug>`; on `/` and in company settings it fetches it without `plant` |
| Shell and boot | "Mount points: `/$plant` and `/station/$stationId`." | Mount points: `/$plant`, `/station/$stationId` and `/settings/$companyId`. A route under `/$plant` whose nav entry sits in the settings area renders with the plant settings navigation in `main` and the main sidebar collapsed to the rail |
| Remote contract | "`defineWebModule({ id, version, northmesRange, permissions, routes(plantRoute), stationRoutes?, nav, widgets, typePolicies? })`" | The members as [ADR 0062][adr-0062] changes them, plus `settingsRoutes?(settingsRoute)`, the subtree under `/settings/$companyId/<id>` (name proposed) |
| Serving | "`/api/web/modules` lists only enabled, permitted and compatible remotes" | It also returns `companies`, `admin` and `plant.onboardingState`; without `plant` it lists the modules with company settings routes for a user whose `admin` is true, and at a plant in onboarding it lists no modules for a user without `core.onboarding:manage` |

#### Changes to ADR 0021

[ADR 0021][adr-0021], accessibility:

| Section | Before | After |
|---|---|---|
| Shell services | "Page titles in the form "Planning board · Plant A · NorthMES"." | Unchanged on plant routes, plant settings included. Company settings pages under `/settings/$companyId` have no plant, so their titles put the company name in its place, for example "Plants · Acme AB · NorthMES" |

#### Changes to ADR 0022

[ADR 0022][adr-0022], shared building blocks:

| Section | Before | After |
|---|---|---|
| Settings and configuration | "Switches that look like infrastructure but change behaviour, such as enabling `/mcp` or a connector's shadow or live write-back mode, are audited settings commands." | Unchanged for a connector's write-back mode. Enabling `/mcp` and the other installation-wide values are audited commands of `northmes installation set` on the host, stored in `core.installation_setting` and not declared with `defineSettings`, because no role sits above a company ([Installation settings](#installation-settings)) |
| Settings and configuration | "Statement triggers on the settings, role, role assignment, retention and installed-module tables bump `core.config_revision`" | `core.onboarding`, `core.onboarding_step` and `core.installation_setting` bump it too |
| Confirmation | "enabling `/mcp` writes one audited command row" | Unchanged; the row comes from `northmes installation set mcp.enabled true` |

#### Changes to ADR 0033

[ADR 0033][adr-0033], operator station:

| Section | Before | After |
|---|---|---|
| Station identity and operator sessions | "Sign-in and sign-out are the commands `core.stationOperatorSignIn` and `core.stationOperatorSignOut`" | Unchanged at an open plant. At a plant whose onboarding is not complete, every station request other than the module list fails with `core.plant_not_ready`, `core.stationOperatorSignIn` included, while an admin can create and pair the station |

#### Changes to ADR 0034

[ADR 0034][adr-0034], MCP surface:

| Section | Before | After |
|---|---|---|
| Endpoint | "The endpoint is disabled per installation by default and enabled through an audited settings command" | Unchanged; the command is `northmes installation set mcp.enabled true`, run on the host ([Installation settings](#installation-settings)) |
| The release 1 toolset | `core_list_plants`: "the plants the user can reach" | the open plants the user can reach, and plants in onboarding for a holder of `core.onboarding:manage`; a call that names a plant in onboarding fails with `core.plant_not_ready` for anyone else |
| Confirmation | `mcp.disabled.int.test.ts`: "enabling it writes one audited settings command" | Enabling it with `northmes installation set mcp.enabled true` writes one command row and one security event |

#### Changes to ADR 0051

[ADR 0051][adr-0051], regulated readiness:

| Section | Before | After |
|---|---|---|
| Details that make the rules concrete (configuration revision) | "Statement triggers on settings, role, assignment, retention and installed-module tables bump `core.config_revision`." | `core.onboarding`, `core.onboarding_step` and `core.installation_setting` bump it too |

#### Changes to ADR 0055

[ADR 0055][adr-0055], release 1 scope. Krister Johansson put the admin pages and the onboarding wizard in release 1 on 2026-10-05, and on 2026-10-06 he kept the wizard in release 1 when he decided to build it after production planning. Under the scope rule, "An item enters release 1 only by the maintainer's decision, recorded in this ADR's ledger table", so the table gains a row:

| Section | Before | After |
|---|---|---|
| Decision outcome (ledger additions) | "Additions from the stress test, which the maintainer still confirms:" and a table of seven additions | The table also holds the row "Company and plant administration and onboarding: the company and installation CLI commands, the company settings mount at `/settings/$companyId` and its plant page, the onboarding wizard and the plant gate (E05-S14, E05-S15, E06-S14 and the module steps)", which comes from Krister Johansson's decision and not from the stress test. Krister Johansson set no figure for this row, so it carries the planning session's estimate of 2026-10-06: 13 to 21.5 raw days (E05-S14 2.5 to 3.5, E05-S15 3 to 5, E06-S14 5 to 8 and the five module steps 2.5 to 5, without the onboarding wizard's design task or gate time), sized against comparable work in internal research notes 19, 20, 32 and 33. Velocity checkpoint 1 (M2) checks the part of E05-S14 and E05-S15 (5.5 to 8.5), and velocity checkpoint 3 (M4) the part of E06-S14 and the module steps (7.5 to 13), which lands at M4. M-04 stays open |

#### Changes to ADR 0060

[ADR 0060][adr-0060], configuration:

| Section | Before | After |
|---|---|---|
| Context and problem statement | "the commands `northmes migrate`, `northmes db bootstrap`, `northmes admin create`, `northmes admin reset-password` and `northmes schema print`" | `northmes company create`, `company add-admin`, `company list`, `installation show` and `installation set` replace `northmes admin create` in the list |
| Other entry points and tests | "`northmes admin create` and `northmes admin reset-password` run in the one-off migrate container" | The company and installation commands and `northmes admin reset-password` run there with `migrateEnvSchema`, and the `migrate` service receives `auth_secret` when Better Auth needs it to create a user |

#### Changes to ADR 0061

[ADR 0061][adr-0061], presentation settings:

| Section | Before | After |
|---|---|---|
| Resolution and delivery | "`GET /api/web/modules?plant=<slug>` also returns `plant { id, slug, name, timeZone, presentation }` with the resolved values." | Unchanged with `plant`, which also gains `onboardingState`. Without `plant` the response has `plant: null` and no presentation values, and the shell renders `/` and company settings with `DEFAULT_PRESENTATION` |

#### Changes to ADR 0062

[ADR 0062][adr-0062], module link manifests:

| Section | Before | After |
|---|---|---|
| Module link manifests | "`defineModuleLinks(id, entries, { station?, moved? })`" | `defineModuleLinks(id, entries, { station?, settings?, moved? })`; the builders of the `settings` section take a company id and no plant and build `/settings/$companyId/<id>/...`, and the `fullPath` and snapshot checks cover them |
| Module link manifests | "`nav` on `screenRoute` takes `{ label, order?, parent?, search? }`" | It also takes `area?: "settings"` (name proposed): the entry then shows in the plant settings navigation instead of the main sidebar, and the shell draws the settings layout around its route ([The settings area](#the-settings-area)) |

#### Changes to ADR 0064

[ADR 0064][adr-0064], REST routes:

| Section | Before | After |
|---|---|---|
| Route families (root routes row) | "the SPA paths `/`, `/$plant/...` and `/station/$stationId`" | the SPA paths `/`, `/$plant/...`, `/station/$stationId` and `/settings/$companyId/...` |
| Reserved module ids and plant slugs | "The plant slug schema in core's contracts refuses `api`, `graphql`, `mcp`, `health`, `modules`, `assets` and `station`." | The schema also refuses `settings`, the company settings mount, and `admin`, which stays reserved while question 3 of the #313 variations round is open |
| Its own list of changes to ADR 0007 | "A plant slug is unique per company and is none of `api`, `graphql`, `mcp`, `health`, `modules`, `assets` and `station`." | A plant slug is unique per installation and is none of `api`, `graphql`, `mcp`, `health`, `modules`, `assets`, `station`, `settings` and `admin`. |
| Confirmation | `plant-slug.test.ts`: "slugs api, graphql, mcp, health, modules, assets and station are refused" | "slugs api, graphql, mcp, health, modules, assets, station, settings and admin are refused" |

### Consequences

* Good, because no role reaches above a company, and the tree, the ancestor walk, the plant check's role rule and the write set stay as they are.
* Good, because a hosting partner scripts a customer's companies and first admins, and every company keeps a recovery path for its admins on the host.
* Good, because no plant opens on a guessed zone, day start or shift times, and an admin resumes onboarding from any browser.
* Good, because `/$plant` URLs stay short when a user works in plants of two companies, and the switcher's data arrives with the module list the shell already loads.
* Good, because the wizard's steps are designed and built after production planning, so they ask for what planning reads.
* Good, because plant settings keep their module paths under `/$plant`, so the plant check, the per-plant client, the Assistant and the plant crumb work there as on every plant page, and a module still owns only `/$plant/<id>/*` there.
* Bad, because creating a company and recovering its admins needs shell access to the host, so a customer without it depends on whoever runs the host.
* Bad, because the CLI assigns core's company admin role outside `can()`, so the host is the trust boundary for company admins.
* Bad, because a CLI command row records the system principal `core.cli` and a reason, not the person at the shell.
* Bad, because a script that runs `company create` or `company add-admin` with `--json` receives temporary passwords and must keep them out of its logs.
* Bad, because core's company admin role holds every installed permission, so installing a plugin widens what company admins can do.
* Bad, because the gateway accepts a second kind of request, one without a plant, so a field wrongly declared plant-free would run without a plant. Only core declares such fields in release 1, and a test lists them.
* Bad, because the plant check gains an onboarding rule, and the onboarding tables, the manifest key and each module's step check are more work before the pilot.
* Bad, because until E06-S14 is built, a new plant is usable without a calendar or a plannable machine.
* Bad, because other modules' company steps run inside the first plant's wizard, and a second plant shows them only as done with an edit link.
* Bad, because a slug clash tells a company admin that some plant in another company uses that slug.
* Bad, because `/api/v1/web/modules` now also describes the user rather than one plant, and its response differs with and without `plant`.
* Bad, because settings come in two areas that look different, company settings without the main sidebar and plant settings in the planner shell, and a move between them may be a full navigation.
* Bad, because the main sidebar changes state on its own when a settings page opens, so the shell keeps the user's own choice apart and restores it on leaving.
* Neutral, because `settings` becomes a reserved plant slug, and `admin` stays one while question 3 of the #313 variations round is open.

### Confirmation

* `apps/server/test/cli/company-create.int.test.ts`: "company create writes one command row with surface cli and principal core.cli, one security event, and prints the temporary password once"; "a replay with the same id creates nothing, exits 0 with replayed true and prints no password"; "with the organization written and no core command, a rerun creates the company once, exits 0 with replayed false and prints no password"; "the same id with another name exits 3"; "an existing username gets the company admin role and no new password"; "--json prints one object with companyId and adminUserId"; "a missing --reason exits 2 without a prompt"; "the temporary password appears in no command row, security event or log line".
* `apps/server/test/cli/company-add-admin.int.test.ts`: "add-admin restores a company whose company admins were all removed"; "a user who already holds the role is a no-op with exit 0"; "a member without the role after a failed run gets the role on the rerun"; "a banned user exits 3".
* `apps/server/test/cli/commands.test.ts`: "admin create is not a command".
* `modules/core/test/auth/organization-paths.int.test.ts`: "POST /api/v1/auth/organization/create with a planner's session returns 404 and creates no organization"; "every HTTP path of the organization plugin answers 404"; "auth.api.createOrganization on the server still creates an organization".
* `modules/core/test/company-admin-role.int.test.ts`: "after the permission sync the company admin role holds every installed permission, a plugin's included"; "a company admin assigns planning's planner role at a plant".
* `modules/core/test/plants.int.test.ts`: "a company admin creates plant hel in their company"; "creating a plant in another company is FORBIDDEN"; "slug hel used by a plant of another company is refused with fieldErrors on slug and a message that names no company"; "the zone of a plant with a calendar version cannot change"; "a company planner reads orders at the new plant once it is open, without a new assignment".
* `modules/core/test/onboarding.int.test.ts`: "completeOnboarding without a shift fails with core.onboarding_incomplete naming the calendar step"; "completeOnboarding without a plannable machine fails naming the machines step"; "a skipped step records who skipped it and the reason"; "opening the first plant completes the company's onboarding"; "two admins recording one step with the same version give core.version_conflict"; "two completeOnboarding calls at the same time open the plant once and emit one core.onboarding.completed"; "the gate's migration opens every existing plant, completes each company with a plant and leaves a company without a plant in onboarding".
* `apps/server/test/gateway/plant-gate.int.test.ts`: "a planner at a plant in onboarding gets FORBIDDEN core.plant_not_ready and no security event"; "a holder of core.onboarding:manage reads the plant in onboarding"; "an MCP tool call naming a plant in onboarding fails with core.plant_not_ready"; "operator sign-in at a station of a plant in onboarding fails with core.plant_not_ready"; "after completeOnboarding the planner reads the plant on the next request"; "a station request at a plant in onboarding fails with core.plant_not_ready"; "a plant without a core.onboarding row admits only holders of core.onboarding:manage".
* `apps/server/test/catalog.test.ts` gains: "a plugin manifest with an onboarding key exits 1 naming the plugin".
* `modules/core/contracts/test/plant-slug.test.ts`: "slugs api, graphql, mcp, health, modules, assets, station, settings and admin are refused".
* `apps/server/test/rest/web-modules.int.test.ts` gains: "a user with plants in two companies gets both companies with their plants sorted by name"; "a company role with no plant yet gives a company with an empty plants list"; "without plant a company admin gets plant null, admin true and the core module"; "without plant a user with one plant role gets admin false and no modules"; "a plant in onboarding is listed for a holder of core.onboarding:manage with onboardingState inProgress and left out for a planner"; "a planner asking for a plant in onboarding gets 200 with onboardingState inProgress and no modules"; "a user without a role at a plant in onboarding gets 403 with core.plant_forbidden"; "a station cookie gets empty companies and admin false"; "a station cookie at a plant in onboarding gets 200 with onboardingState inProgress and no modules"; "without plant a company admin of one company who is a planner in another gets core.plant:create only under the first company id".
* `apps/server/test/gateway/plant-free.int.test.ts`: "coreAdminPlants without x-northmes-plant succeeds for a company admin"; "an operation without the header that selects a planning field fails with core.plant_forbidden"; "an operation that mixes a plant-free field and a planning field without the header fails"; "the plant-free root fields equal the release 1 list".
* `apps/web/test/onboarding-wizard.test.tsx`: "the step list marks the current step with aria-current step and writes each state as text"; "moving to the next step focuses its h1"; "a server fieldError on the slug keeps the typed values"; "the review step lists the zone and the production day start before Open plant".
* `e2e/a11y/onboarding-wizard.spec.ts`: "every core step of the company and plant wizards passes axe".
* `packages/testing/test/plant-fixture.int.test.ts`: "a plant from the fixture is open unless the test asks for one in onboarding".
* `apps/web/test/settings-mount.test.tsx`: "the core remote's settingsRoutes mount under /settings/$companyId/core"; "a remote whose settings route path differs from its id is rejected"; "every company settings leaf route has a title with the company name in place of the plant".
* `apps/web/test/settings-layout.test.tsx`: "a plant route whose nav entry is in the settings area renders the plant settings navigation in main and leaves the entry out of the main sidebar"; "opening a settings page collapses the main sidebar to the rail and keeps focus where it was"; "leaving settings returns the main sidebar to the user's own state"; "the skip link lands after the settings navigation".
* `apps/web/test/landing.test.tsx`: "a company admin of a company in onboarding goes from / to its company wizard"; "a company admin of two companies in onboarding sees both companies at /"; "one open plant and admin false redirects / to /hel"; "no open plant and admin true in one company redirects / to /settings/<company id>"; "a planner whose plants are all in onboarding sees Your company is not open yet"; "two plants show the plant list at /".
* `packages/contracts/test/define-module-links.test.ts` gains: "a settings section builder builds /settings/<company id>/core/plants without a plant".
* `apps/server/test/cli/installation-settings.int.test.ts`: "installation set mcp.enabled true writes one command row and one security event, and POST /mcp answers afterwards"; "a private endpoint host is refused until outbound.allowedHosts lists it"; "an unknown key exits 2".
* `modules/audit/test/retention.int.test.ts`: "a partition older than the installation setting audit.securityEventRetentionDays is dropped and the drop recorded".
* `e2e/company-onboarding.spec.ts`: "after company create, the first admin signs in, changes the password, lands in the company wizard, creates plant hel, adds a calendar and one machine, opens the plant, and a planner then opens /hel".

## Pros and cons of the options

### CLI commands on the host

* Good, because no role, table or `can()` target sits above a company.
* Good, because a hosting partner can script it, and it is the recovery path for a company without admins.
* Good, because it extends the first admin by CLI that [ADR 0011][adr-0011] already chose.
* Bad, because it needs shell access to the host, and the person at the shell appears only as `core.cli` with a reason.

### Installation roles outside the scope tree, with a companies page

* Good, because the tree, the walk and the write set need no new case, and customer IT could create companies in the UI without shell access.
* Bad, because Krister Johansson left it out: a company cannot create a company, and an installation level of roles adds a second kind of `can()` target, a level on roles, a second assignment table and an exception to the no-escalation rule for the first company admin, for a task that the people who run the host do a few times per installation.

### An installation node above the companies in core.scope

* Good, because `can()` keeps one kind of target, and the ancestor walk reaches the installation without new code.
* Bad, because `core.scope.company_id` becomes nullable and the company stops being the root, which changes the text of ADR 0007 and ADR 0010 in several places.
* Bad, because an installation assignment would apply to every company and plant through the walk: the plant check would pass everywhere, and a writing permission would put every company and plant into the write set of [ADR 0008][adr-0008].
* Bad, because no Better Auth organization matches the node.

### Better Auth's admin role as the flag

* Good, because the admin plugin is already enabled and `user.role` exists.
* Bad, because [ADR 0011][adr-0011] gives no user a Better Auth admin role and disables the admin plugin's HTTP paths. The flag would split authorization between Better Auth and core tables, outside `can()` and the permission catalog.

### A list in the configuration

* Good, because it needs no table and no command.
* Bad, because a change needs a restart and leaves no command row, and behaviour settings never live in environment variables ([ADR 0051][adr-0051], rule 6).

### Smaller choices

| Question | Chosen | Left out | Reason |
|---|---|---|---|
| Plant slug uniqueness | unique per installation | the company in the URL (`/$company/$plant`); unique per company with a check against the session's active organization | Krister Johansson's decision keeps URLs short. An active organization on the session would tie every tab to one company, which [ADR 0007][adr-0007] rules out for plants for the same reason |
| Where the companies and plants come from | fields in `GET /api/v1/web/modules`, which also answers without `plant` | a new first-party route such as `GET /api/v1/web/plants`; a GraphQL query | the shell already loads the module list at boot and on every plant switch, so the switcher costs no second request, and the release 1 route list of [ADR 0064][adr-0064] does not change. GraphQL requests carry a plant, which `/` and company settings lack |
| Settings routes | company settings at `/settings/$companyId/<id>/...` and plant settings under their module paths in `/$plant`, with `settings` as a reserved slug (option C of the #313 variations round) | `/admin`, with `admin` as a reserved slug (confirmed on 2026-10-06, M-59); one `/settings` tree with a scope segment (option A); `/settings/$companyId` with `/$plant/settings` (option B); `/_admin`; admin pages under `/$plant/core/admin` | Krister Johansson chose option C on 2026-10-08. A new company has no plant, so its settings need a route outside `/$plant`, and `/station` already set the precedent of a plain word reserved from slugs. Plant settings under `/$plant` keep the plant check, the per-plant client and the Assistant as they are; option A moved plant pages out of `/$plant`, and option B made `settings` a reserved module id under `/$plant` |
| First company admin | named in `company create` | a separate `add-admin` after `create` | one command leaves no company without an admin |
| `northmes admin create` | removed | kept, creating a user without a role; kept as an alias of `company add-admin` | a user without a role can do nothing, and two commands for one job invite two ways to create admins |
| Principal of CLI writes | the system principal `core.cli` with a required reason | a username given as a flag; a security event without a command row | the CLI cannot authenticate the person at the shell, so a username flag would be an unchecked claim, and [ADR 0013][adr-0013] needs a command row for every write |
| What a company admin holds | core's company admin role with every installed permission | each module's own admin role assigned by the CLI; core permissions only | the rule that an assigner holds every permission of the role would stop a core-only admin from assigning planning's roles, and one role keeps the CLI and recovery simple when a plugin is installed later |
| Plant gate | a plant stays closed until its onboarding is complete | a checklist banner only; a gate per module | Krister Johansson's decision asks that everything be in place before people use the plant, and one rule in the plant check covers every surface |
| What opening needs | the plant record, a calendar version with a shift, one plannable machine, and every planning setting without a recorded default | the plant record only; the record and a calendar | without availability autoplan places nothing, and without a plannable machine the board is empty |
| Onboarding state | `core.onboarding` and `core.onboarding_step` on the server, plus checks derived from data | browser storage; checks derived from data only | another admin or browser resumes, and a skip needs a record of who and why |
| Company steps of other modules | inside the first plant's wizard | plant-free fields for every module | only core declares plant-free fields, which keeps the gateway's plant-free list short |
| Who sets installation-wide settings | `northmes installation set` on the host | company admins in the UI; environment variables | no role sits above a company, so one company's admin would change behaviour for every company, and [ADR 0051][adr-0051] rule 6 keeps behaviour out of environment variables |

## More information

* Related ADRs: [0006][adr-0006] data migrations, [0007][adr-0007] tenancy, [0008][adr-0008] row-level security, [0009][adr-0009] codes and spans, [0010][adr-0010] roles and `can()`, [0011][adr-0011] principals, user management and the CLI, [0013][adr-0013] audit, [0019][adr-0019] shell and mount points, [0021][adr-0021] accessibility, [0022][adr-0022] settings and the scope rule, [0025][adr-0025] calendars and the production day, [0032][adr-0032] Pyramid settings, [0033][adr-0033] stations, [0034][adr-0034] MCP, [0035][adr-0035] AI providers, [0047][adr-0047] outbound URLs, [0051][adr-0051] rules 6, 13, 15 and 23, [0055][adr-0055] release 1 scope, [0060][adr-0060] the migrate configuration, [0061][adr-0061] presentation values, [0062][adr-0062] link manifests, [0064][adr-0064] reserved slugs and route families, [0067][adr-0067] the switcher, crumbs and nav icons.
* Proposed ADRs to update before they are accepted: [0003][adr-0003] (the manifest's `onboarding` key; core's company admin role, synced with every installed permission), [0008][adr-0008] (company fields without a plant run with read scopes that hold the company nodes where `can()` passed and their plants; the allowlist entry for `core.installation_setting`), [0011][adr-0011] (first admin and recovery through `company create` and `company add-admin` in place of `admin create`; the `system` principal with surface `cli`; the onboarding rule in the plant check of `PrincipalResolver`; every `/organization/*` path of Better Auth disabled, as the `/admin/*` paths are), [0047][adr-0047] (`auth_secret` for the company commands; the allowlist set by `northmes installation set`).
* Plan: [04 data and platform](../plan/04-data-and-platform.md#companies-plants-and-onboarding) (the CLI, plants, onboarding tables and slugs), [06 web and UX](../plan/06-web-and-ux.md#shell-routes-and-mount-points) (shell routes, the wizard, the module list), [12 operations and security](../plan/12-operations-and-security.md#install-and-bootstrap) (install step 7), [14 roadmap](../plan/14-roadmap.md) (E05-S03, E05-S05, E05-S13, E05-S14, E05-S15, E06-S08, E06-S14 and the module steps, E07-S08 and E08-S10), [16 open questions](../plan/16-open-questions.md#design-points-from-the-plan-documents) (M-58 to M-61).
* Design: D2 draws the admin frame and the plant list at `/`. The #313 variations round replaces the admin frame with the settings area ([record](../design/shell/shell-313-settings-variations.md)), and the settings spec page records the change to D2. The onboarding wizard is a new kind of screen, so it gets a variations round before its spec page ([06 web and UX](../plan/06-web-and-ux.md#claude-design-per-task)). Its design task runs after production planning is built, with the rest of E06-S14.
* Scope: Krister Johansson put the admin pages and the onboarding wizard in release 1 on 2026-10-05. On 2026-10-06 he decided to build the wizard after production planning and kept it in release 1 ([When the wizard is built](#when-the-wizard-is-built)). The ledger row is under [Changes to ADR 0055](#changes-to-adr-0055).
* Open from the #313 variations round: whether `$companyId` becomes a company slug (question 2), whether `admin` stays reserved (question 3), where `/` sends a company admin of several companies and whether company settings keep an overview of the companies (questions 4 and 10), and the plant-free fields that company settings pages of modules other than core need (question 13).
* Open: M-31 decides which modules ship a web remote, and the ERP connection and AI steps need one. M-33 decides who owns the scrap reason register. No story builds badge enrolment yet. Plan 07 puts warehouses at plant scope while E06-S07 puts them at company level; the ERP connection step follows the connector settings `warehousePlantRules` and `defaultPlantId` either way. Command rows of `northmes installation set` carry no scope node, and the admin audit list (E05-S11) decides who reads them.
* Not in release 1, with the trigger that brings each in: direct permission grants to a user (a need appears); installation roles and a companies page (a partner must create companies without shell access to the host); `northmes plant create` and a declarative onboarding file (a hosting partner sets up plants for several customers); copying calendar, settings and roles from another plant in the wizard (a customer creates a second plant); reopening or closing an open plant (pilot feedback); email invitations for new users (an installation with SMTP asks for them; release 1 hands out temporary passwords out of band); CSV import of users and registers as wizard steps (the first customer without an ERP); per-company wizard steps for modules enabled per organization (per-organization enablement in an installation with several companies, [ADR 0037][adr-0037]).
* Revisit when one of these triggers fires, when company mode arrives, or when areas and lines join the tree.

[adr-0003]: 0003-module-package-shape-and-the-definemodule-manifest.md
[adr-0006]: 0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md
[adr-0007]: 0007-tenancy-company-plants-and-the-scope-tree.md
[adr-0008]: 0008-row-level-security-with-transaction-local-scopes.md
[adr-0009]: 0009-code-uniqueness-per-scope-with-an-exclusion-constraint.md
[adr-0010]: 0010-identity-with-better-auth-roles-and-permissions-in-core-tables.md
[adr-0011]: 0011-principals-credentials-and-same-origin-rules.md
[adr-0013]: 0013-audit-trail-written-in-the-command-transaction.md
[adr-0019]: 0019-web-shell-with-react-module-federation-remotes.md
[adr-0021]: 0021-accessibility-target-wcag-2-2-aa.md
[adr-0022]: 0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md
[adr-0025]: 0025-plant-calendars-shift-patterns-and-the-production-day.md
[adr-0032]: 0032-pyramid-connector-polling-file-mode-and-shadow-write-back.md
[adr-0033]: 0033-online-operator-station-in-the-production-start-module.md
[adr-0034]: 0034-mcp-surface-one-endpoint-a-read-mostly-planning-toolset.md
[adr-0035]: 0035-ai-provider-port-with-customer-configured-providers.md
[adr-0037]: 0037-plugins-drop-in-packages-command-validators-and-ui-slots.md
[adr-0047]: 0047-secrets-and-the-installation-key.md
[adr-0051]: 0051-regulated-readiness-no-regret-rules.md
[adr-0055]: 0055-release-1-scope-under-option-b-and-the-scope-rule.md
[adr-0060]: 0060-configuration-with-nestjs-config-one-zod-environment-schema-and-secret-files.md
[adr-0061]: 0061-presentation-settings-for-dates-clocks-and-numbers-with-one-pinned-locale.md
[adr-0062]: 0062-web-form-contracts-url-view-state-and-module-link-manifests.md
[adr-0064]: 0064-rest-routes-under-api-v1-and-openapi-from-zod-contracts.md
[adr-0067]: 0067-plant-switcher-across-companies-nav-icons-by-lucide-name-and-a-top-bar-slot.md
