# Test quality rules

A test earns its place when it can go red for the regression its name describes. The tdd skill names the general anti-patterns (tautology, implementation coupling, horizontal slicing); this file holds the forms they take in this repository, each with its tell and its fix. It applies to every test file: unit, web, integration, meta, Playwright.

## The expected value comes from outside the code under test

Tell: the test imports the formatter, scale, layout or counting helper the component uses and builds the expected string with it; a constant from `src` is the expected lifetime or cost; the test lists the folder the runner reads to predict what the runner applies; a field of the answer is copied into the expected object; the answer is sorted and compared with itself; the file the setup read is read a second time and compared with the first read. Each agrees with the code by construction.

Fix: write the literal. Besides the sources the tdd skill names, this repository has two more: a row of an oracle fixture such as `modules/planning/domain/fixtures/gantt/g1.expected.json`, and a value the test itself wrote as a fixture. When the full value is long, pin one representative literal and the count. An exported constant, enum or returned argument is pinned to a literal from the spec, never to the value that defines it. `modules/planning/domain/test/workload.test.ts` compares a week's workload with the GT5 row of that oracle, and `apps/backend/test/graphql/limits.test.ts` pins the operation cost as the literal 20301 in the error message.

## A negative waits for a positive signal

Tell: a test asserts that a button, section, menu item or row is absent after a fixed sleep, a wall-clock bound, or no wait at all. Under load the assertion runs before the gated element renders, and a regression that shows it passes.

Fix: wait for an element the same answer renders (the Edit link, the viewer's note, the table rows), then assert the absence. `apps/web/test/modules/core/user-access.test.tsx` shows the shape: Remove shows once the reader's permissions arrived, so Add role would show by then too. In a Playwright spec, an action that "does nothing" is proven by the value that would have changed (`scrollLeft`, the URL), never by waiting.

## Assert what the user sees or does

Tell: a Tailwind class name is the observable (`className` contains `focus-visible:ring-2`, `min-h-(--nm-target-min)` or `bg-shift-1`). A utility rename breaks the test with no change for the user, and a token that changes colour passes it.

Fix: assert role, accessible name, text, aria state, URL, announcement, focus, inline style or computed style. Where happy-dom exposes nothing (a focus ring, target size, a colour, a rule line), the rule belongs in a Playwright spec that reads computed style or `boundingBox()`, and the unit test keeps the roles, names and states. A unit test that must pin a visual rule reads one data attribute or computed property the component owns, and its name says which design rule it guards. `apps/web/test/modules/planning/gantt-run.test.tsx` reads the run's border style through `getComputedStyle`, and `apps/web/test/ui/components/data-table.test.tsx` asserts the table through roles, `aria-sort` and focus.

## Every control gets its refusal beside its allowed path

Tell: a field that documents "Needs <permission>", or a route family, is tested only through `signInAt`, a user with every permission, or through one representative route.

Fix: in the same file as the allowed path, a user without the permission gets `core.forbidden`; when the field takes a company id, another company's id gets `core.forbidden` too. A route family loops the credential and permission refusals over its table of routes, as `apps/backend/test/rest/v1-articles.int.test.ts` does for 401. A masked error test asserts both halves: the code and the correlation id present, the internal text absent from the whole JSON answer.

## Read the outcome through the interface

Tell: a test of a command, a CLI command or an operation reads its result with `queryAsCore` or a raw query on `db.ownerUrl` where the API, the CLI's `--json` output or `db.command` with the row's scopes shows the same fact; or it asserts wiring through Nest's `ModulesContainer`, a spy on a framework factory or a hook's arguments echoed back, where the app's answer shows the same fact.

Fix: read through the interface. The tdd skill calls a database read a bypass; here `db.command` with the row's scopes is the sanctioned seam ([plan 11](../plan/11-quality-and-testing.md) rules 3 and 8, and the db-test skill, step 5), and raw reads as the owner are for rows no interface exposes (migrate, bootstrap, `auth.member`), with the helper's comment naming which row. `ModulesContainer` is for enumerating a surface no interface lists, as `apps/backend/test/rest/v1-articles.int.test.ts` does for the public controllers, never for a value the app answers (the config in effect, the masked error, the refusal).

## A meta test checks a property or cross-checks two artifacts

Tell: a test in `test/meta` or `scripts` restates a config value, a job list or a sentence of prose as a literal copy. A reword fails it, and a wrong value passes when the copy is updated in the same commit.

Fix: assert the property (the pin is exact, the entry comes from the catalog, the file after `node` is tracked, step A runs before step B) or check one artifact against another (the ruleset's required checks exist as workflow jobs). The reviewed security boundaries in `test/meta/agent-sandbox.test.ts` and `test/meta/agent-files.test.ts` (the sandbox block, the agent hooks) are the exception. A guard for a one-time doc change is deleted once the change has merged.

## Shape

- The name lists what the body asserts. A body that pins a whole list says so in its name; a name that lists cases lists all of them.
- One behaviour per test. A test that walks ten behaviours hides nine on the first failure.
- A test that proves two things are isolated holds both in one test, so its outcome never depends on which file ran first, as `packages/testing/test/db-command.int.test.ts` does for a row at plant A that plant B cannot see.
- A test of the harness lives in the harness's test folder (`apps/backend/test/testing/create-test-app.int.test.ts`, `packages/testing/test`), not among the behaviour tests.
- A test name starts with its plan case id or story id, such as `E02-S02` in `packages/testing/test/db-command.int.test.ts` ([ADR 0041](../adr/0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md)).
- A mock that no test consumes is removed from the mock list.
