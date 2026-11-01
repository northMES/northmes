---
status: "proposed"
date: 2026-10-31
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: Krister Johansson (People and Users list the same people and two entries for them are confusing, one page asked for, 2026-10-31, from the settings navigation; answers to M-105, M-106 and M-107 and user administration kept at the company, 2026-10-31)
informed: contributors and coding agents
release: "1"
needs-confirmation: ""
---

# One Users page for the company and its plants, read at the plant by a plant reader

## Context and problem statement

Core's settings have two pages for the same accounts. People in plant settings, `/plant-a/settings/people`, lists who holds a role at the plant, one row per role, with Add role and a person's page. Users in the company's settings, `/plant-a/settings/users`, lists the company's users, one row per user with their roles as chips, with New user, Reset password, Block user and a user's page whose Access tab adds and removes roles. Every person who signs in is a user ([ADR 0010][adr-0010]), so both pages list the same people. Krister Johansson found the two entries in the settings navigation confusing on 2026-10-31 and asked for one page.

The two pages read at different scopes. The shell knows a company settings page by its path, renders it in the Apollo client without `x-northmes-plant`, and shows its navigation entry only to a holder of the entry's permission at the company (`apps/web/src/shell`, [ADR 0066][adr-0066]: "Requests from the company's settings pages carry no `x-northmes-plant`"). So Users' `coreUsers` query names the company and needs `core.user:read` there. People sends `x-northmes-plant` and needs `core.user:read` at the plant only. A Plant admin holds `core.user:read` at its plant and not at the company, so Users refuses it and its entry stays hidden.

`coreUsers` and `coreUser` already read at a plant: with `x-northmes-plant` they need `core.user:read` at that plant and return the users of the plant's company. Row-level security does not narrow role assignments: the select policy on `core.role_assignment` for `nm_app` is `using (true)`, because an assignment names a user, a scope and a role and no permission. The services narrow them. At a plant, `RoleAssignmentService` reads the assignments at the plant and its company only, and `UserService.list` filters a role's holders the same way. One page can therefore serve both readers without a new permission, as long as every new read narrows in its service as these do.

This ADR covers core's settings screens in `apps/web/src/modules/core`, the shell's choice of Apollo client and shell state for Users and the gating of its navigation entry in `apps/web/src/shell`, `coreViewer`, the arguments of `coreUsers`, and the settings section of `coreLinks`. Roles, Warehouses and the commands that give, remove, block and reset stay as they are.

## Decision drivers

* One place to find a person and what they can do, for every reader.
* A Plant admin keeps managing access at its plant without any company-level permission.
* No new permission and no read wider than today's (least privilege, [ADR 0076][adr-0076]).
* The access design core-304 already puts Add role and Remove on the user's Access tab, with a place picker.
* An old URL leads nowhere and shows not found; no URL redirects (Krister Johansson, 2026-10-31, in [ADR 0066][adr-0066]).

## Considered options

* One Users page that reads at the company or at the plant by the reader's permissions
* One People page in plant settings that also holds the company's user actions
* Two pages as today, renamed and linked to each other

## Decision outcome

Chosen option: "One Users page that reads at the company or at the plant by the reader's permissions", because it keeps one list and one page per person, follows the user page that core-304 approved, and needs no new permission: `coreUsers` already answers a plant reader.

Pages and links:

* Users at `/$plant/settings/users` is the one list of people, and `/$plant/settings/users/$userId` is a person's one page. People, its Add role and the person's page at `/$plant/settings/people/...` go. The links that lead there today, a plant in the Where column of a user's Access tab and Add role at a plant, lead to the user's page and its Add role instead.

Read mode:

* The page reads in company mode, as Users does today, when the reader holds `core.user:read` at the company: without `x-northmes-plant`, with the company's id. Otherwise it reads in plant mode: with `x-northmes-plant` for the URL's plant and without a company id, so `CoreUsers` declares `$companyId` optional (`requestScope` refuses an empty id that does not match the plant's company). A reader who holds `core.user:read` at neither gets "No access to Users", which names the plant and the company.
* The mode comes from `coreViewer`, so the list and the user's page wait for it, and a failed viewer read shows the page's error state with Try again. The shell picks the Apollo client and the shell state for Users by the mode. For Users this replaces ADR 0066's rule that requests from the company's settings pages carry no plant.
* In company mode `coreViewer` also answers the reader's permissions at each plant of the company (field name proposed). Add role and Remove at a plant then follow the reader's rights at that plant. A Plant admin of Plant A who also holds `core.user:read` at the company through another role keeps Add role and Remove at Plant A, as People gives them today.

The list:

* One row per user, with the roles as chips that name their place. In plant mode the chips cover the URL's plant and the company only, as the services return them. A user without a role there shows "No role at Plant A" (wording proposed) rather than "No role", since roles at other plants are not read.
* A Place filter joins Role and Status. Place set to a plant keeps the users who hold an assignment at that plant or at the company, because a company role applies at every plant: the list answers who has access there. A holder of a company role shows its company chip, with no Remove at the plant. Place set to the company keeps the holders of a company role only. With Role and Place both set, one assignment matches both, so in company mode a user who holds Planner at Plant B and Viewer at Plant A is not listed for Planner at Plant A. In plant mode the Role filter reads the company's roles at the plant (`core.role:read` there).
* Place offers Anywhere, the company, and the plants the read covers: every plant of the company in company mode, the URL's plant in plant mode. The URL holds `place=anywhere`, `place=company`, `place=plant` for the URL's plant, or another plant's slug in company mode (names proposed), so switching plants keeps "this plant". The default is Anywhere in company mode and the URL's plant in plant mode, so a Plant admin opens the page on the people of its plant, as People showed them.
* `coreUsers` gains a `placeId` argument (name proposed), a scope id. The service narrows it to the request's read: the plant or its company in plant mode, the company or one of its plants in company mode. Any other id answers no users, and the read never reaches an assignment outside the request's scope.

The user's page:

* The Access tab lists the roles at the company and at the plants the read covers, has Add role with the place picker of core-304, which offers the places where the reader holds `core.roleAssignment:manage`, and Remove where the grant rule allows it ([ADR 0010][adr-0010]). What the user can do shows at the company in company mode and at the plant in plant mode.
* A user belongs to the company. A Plant admin ties a user to its plant only by giving a role there, and user administration stays at the company (Krister Johansson, 2026-10-31): no home plant, and no plant-level create, block or reset.
* New user, Reset password and Block user show to a reader who holds `core.user:create`, `core.user:resetPassword` or `core.user:block` at the company, in either mode, because the API checks them at the request's company (`requestCompany`). A reader who holds `core.user:block` at the company and `core.user:read` only at a plant therefore blocks a user from the plant read, as the API allows today.

Navigation and reserved segments:

* The settings navigation has one Users entry, in the company's group, shown to a reader who holds `core.user:read` at the company or at the URL's plant. Plant settings lose the People entry.
* The onboarding wizard's People step links to Users with `place=plant`.
* `people` leaves core's reserved segments at the settings root, which [ADR 0074][adr-0074] derives from core's routes and `coreLinks`. `/$plant/settings/people/...` shows the plant's not found page while no module takes the id `people`.

### Consequences

* Good, because a person has one page, and a reader no longer chooses between two lists of the same people.
* Good, because no permission, role or row-level security policy changes; the plant read and the grant rule are the ones People uses today.
* Good, because the Access tab of core-304 is the one place to give and remove roles, at the company and at a plant.
* Bad, because the page has two read modes, and the shell chooses its client for this page by the reader's permissions instead of by the path alone.
* Bad, because `coreViewer` answers more in company mode: the reader's own permissions at each plant, which the reader can already learn plant by plant.
* Bad, because a Plant admin with Place set to Anywhere sees every user of the company with status and company roles. `coreUsers` answers a plant reader with the same fields today, so no new field reaches the reader.
* Bad, because `placeId` is a new filter on a table whose row-level security reads every row, so its narrowing lives only in the service and its tests.
* Bad, because a reader who holds `core.user:read` only at a plant finds Users in the company's group, where it manages nothing else. Krister Johansson chose the company's group for every reader on 2026-10-31 (M-105), because the accounts belong to the company.

### Confirmation

* `apps/backend/test/modules/core/users.int.test.ts` gains: a plant reader who names another plant as `placeId`, where a holder exists, gets no users; `placeId` of its plant returns the holders at the plant and the holders of a company role, and not a holder only at another plant; `placeId` of the company returns the holders of a company role only; Role and Place match on one assignment; a company reader who names a plant of another company gets no users.
* `apps/backend/test/modules/core/viewer.int.test.ts` gains: in company mode `coreViewer` answers the reader's permissions at each plant, and a Plant admin of Plant A gets `core.roleAssignment:manage` at Plant A and not at Plant B.
* `apps/backend/test/modules/core/admin-roles.int.test.ts` gains the refusal of Reset password to a Plant admin beside its create and block refusals.
* `apps/web/test/modules/core/users.test.tsx`: a plant reader opens Users in plant mode with `place=plant`, chips at Plant A and the company only, and no New user or row menu; a company reader opens it with Anywhere and a chip at Plant B; a reader with `core.user:block` at the company and `core.user:read` only at the plant sees Block user; "No access to Users" names the plant; a failed viewer read shows Try again.
* `apps/web/test/modules/core/user-access.test.tsx`: in company mode a reader with `core.roleAssignment:manage` only at Plant A gets Add role and Remove at Plant A and not at Plant B, and a plant in the Where column links to the user's page.
* `apps/web/test/shell-nav-groups.test.tsx`: a plant reader sees Users and no People.
* `apps/web/test/settings-mount.test.tsx`: `/plant-a/settings/people` shows the plant's not found page, and Users in plant mode sends `x-northmes-plant`.
* `apps/web/test/plant-switcher.test.tsx`: a switch from Plant A to Plant B keeps `place=plant`.
* `modules/core/contracts/test/links.test.ts`: `coreLinks.settings` has no `people` entry.
* `apps/backend/test/catalog.test.ts`: `people` is no longer reserved at the settings root.
* `e2e/users.spec.ts` (new): a Plant admin gives a role at its plant from a user's Access tab and removes it, with `checkA11y` on the list's loading, empty and filtered states, the user's Access tab in plant mode and "No access to Users" ([ADR 0021][adr-0021]).

## Pros and cons of the options

### One Users page that reads at the company or at the plant by the reader's permissions

* Good, because it is one list and one page per person.
* Good, because it reuses the queries, commands and Access tab that exist.
* Neutral, because `coreUsers` gains an argument and `coreViewer` a field, and neither reads wider than today.
* Bad, because the page decides its read scope from the reader's permissions, which People and Users each fix today.

### One People page in plant settings that also holds the company's user actions

* Good, because a plant admin finds it where it looks today.
* Bad, because creating, blocking and resetting a user are company actions, and a page in plant settings that does them hides that they reach every plant.
* Bad, because a company admin has to pick a plant to manage users who may hold no role at any plant.

### Two pages as today, renamed and linked to each other

* Good, because nothing in the code changes but names and links.
* Bad, because the same person still has two pages, and the reader still chooses between them.

## More information

* Design: [#957][issue-957] draws the list for both readers, the user's page, the navigation and the page states on the core-304 artifact ([ADR 0079][adr-0079]). The build waits for its approval.
* Krister Johansson answered M-105, M-106 and M-107 in [16 open questions](../plan/16-open-questions.md) on 2026-10-31.
* When the build lands, the user guide changes with it ([ADR 0088][adr-0088]): `apps/docs/use/users-and-roles.mdx` loses its section "People at a plant", its line that a plant's people live under People, and "Read users and People" in its permission table; `apps/docs/use/companies-and-plants.mdx` no longer names People among the plant's pages, and no longer says that the company's pages show the whole company for every reader.
* Related ADRs: [0008][adr-0008] (row-level security), [0010][adr-0010] (roles, the grant rule), [0021][adr-0021] (accessibility), [0062][adr-0062] (link manifests, URL view state), [0066][adr-0066] (company and plant settings, core's admin roles), [0074][adr-0074] (core's pages and reserved segments), [0076][adr-0076] (least privilege), [0079][adr-0079] (design pages), [0088][adr-0088] (docs per pull request).
* Revisit when areas or lines join the scope tree below plants: Place and the read mode then need a level below the plant.

[adr-0008]: 0008-row-level-security-with-transaction-local-scopes.md
[adr-0010]: 0010-identity-with-better-auth-roles-and-permissions-in-core-tables.md
[adr-0021]: 0021-accessibility-target-wcag-2-2-aa.md
[adr-0062]: 0062-web-form-contracts-url-view-state-and-module-link-manifests.md
[adr-0066]: 0066-companies-created-by-the-cli-plant-slugs-unique-per-installation-company-settings-at-settings-and-an-onboarding-wizard-before-a-plant-opens.md
[adr-0074]: 0074-core-pages-at-the-plant-root-and-the-company-settings-root.md
[adr-0076]: 0076-secure-development-lifecycle-with-a-security-note-per-change-a-controls-index-and-an-internal-audit-each-release.md
[adr-0079]: 0079-design-pages-as-artifacts-on-the-northmes-design-system-with-the-approved-source-in-the-repository.md
[adr-0088]: 0088-developer-documentation-kept-current-with-a-docs-section-per-pull-request-generated-references-and-executable-examples.md
[issue-957]: https://github.com/northMES/northmes/issues/957
