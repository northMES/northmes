---
status: "proposed"
date: 2026-10-05
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: internal research notes 17, 19, 20, 25, 28, 30, 31 and 32
informed: contributors and coding agents
release: "1"
needs-confirmation: ""
---

# Developer environment: source exports, one stack script and one gate command

## Context and problem statement

One developer builds NorthMES with coding agents that run in fresh git worktrees through handoff ([ADR 0049](0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md)). The handoff coder may run only `git`, `pnpm`, `npm` and `npx`. Any other command becomes a permission prompt that the operating session brings to Krister; it waits up to 30 minutes and then fails.

A review of the planned setup found four gaps:

* Every module and `@northmes/sdk` exported only `dist`, and the worktree setup ran only `pnpm install`. In a fresh worktree, importing a manifest under Vitest 5.0.3 failed with "Cannot find package '@northmes/module-core/manifest'" (reproduced). Once a build existed, every edit ran stale code.
* The server refuses to boot with pending migrations, yet nothing ran migrations in dev. The role bootstrap existed only in the Testcontainers global setup, and no environment defaults or seed existed. Ports were fixed: the shell on 5173 with `strictPort`, remotes from 5174, the shell proxy on 3412 and the server default on 3000, which is handoff's dashboard port. The agent notes described a shared `compose.yaml` stack while also telling agents never to run `docker compose`.
* Three gates existed: lint, typecheck and test locally, `pnpm test:handoff` in handoff, and `ci / gate` in CI. A change that passed one failed another, and each mismatch cost a coder round through the pull request.
* The month-1 list for the walking skeleton summed to about 27 to 38 days against about 20 working days.

This ADR decides package exports for tests and dev, the script that brings up a working stack, the gate command, the rule for commands, the agent rule files and the skeleton timebox. Node and TypeScript pins are in [ADR 0004](0004-monorepo-tooling-pnpm-turborepo-node-and-typescript-versions.md); the Vitest projects and the Testcontainers harness are in [ADR 0041](0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md), and the `types` project for `*.test-d.ts` is in [ADR 0062](0062-web-form-contracts-url-view-state-and-module-link-manifests.md). This ADR is the "dev environment" item on the list of ADRs the E02 foundation epic needs, which must be accepted by M0 (2026-10-30).

## Decision drivers

* A fresh worktree runs tests right after `pnpm install --frozen-lockfile`, with no build step.
* Tests and dev run the code being edited; production runs compiled `dist` only.
* Dev, the end-to-end setup and the handoff demo reach a migrated, seeded database through the same steps.
* Two runs on one machine never share a database or a port.
* Every command an agent needs is a `pnpm` or `git` command from the repository root.
* What passes the local gate passes handoff's Tester and CI.
* Month 1 has about 20 working days.

## Considered options

* A source exports condition, one stack script, one gate command with root scripts only, and a timeboxed skeleton
* Build every package before tests and keep dist-only exports
* A shared Compose stack with fixed ports for dev and the demo
* A gate per tool: a local gate, a handoff gate and the CI gate
* The full month-1 list as the skeleton exit

## Decision outcome

Chosen option: "A source exports condition, one stack script, one gate command with root scripts only, and a timeboxed skeleton", because it makes a fresh worktree usable with one install, gives agents one command to pass, and keeps the skeleton inside the month it has.

### Source exports

* Every workspace package lists an `exports` condition `"@northmes/source"` that points at its `.ts` entry, placed before `"default"`, which points under `dist/`.
* The root `vitest.config.ts` sets `resolve.conditions` and `ssr.resolve.conditions` to `["@northmes/source"]`. With that setting the reproduced manifest import passed from source, decorator metadata included.
* The base tsconfig sets `compilerOptions.customConditions` to `["@northmes/source"]`, so `pnpm typecheck` resolves types from source in a fresh worktree.
* Production (`node dist/main.js` in the image) never sets the condition.
* `pnpm dev` runs `tsc -b --watch` over the backend project references and restarts the server after each completed build.

### One stack script

One script serves `pnpm dev`, the end-to-end global setup and handoff's `handoff-demo`. Its shared steps:

1. Write `.northmes/dev.env` (with `NODE_ENV=development`) and the dev secret files under `.northmes/secrets/` (mode 0600) with random values when they are missing; the `_FILE` keys in `dev.env` point at the files ([ADR 0060](0060-configuration-with-nestjs-config-one-zod-environment-schema-and-secret-files.md)). The dev secrets carry a marker, and the config loader throws a named error when it finds the marker with `NODE_ENV=production`.
2. Start Postgres through Testcontainers from the image pinned in `infra/pg-image.json` ([ADR 0005](0005-postgres-18-official-image-with-pgbackrest-timescaledb-deferred.md)). `.withReuse()` is used only on a laptop behind an opt-in variable, never in CI, because a reused container outlives the run.
3. Bootstrap the database roles as the container superuser, with the role passwords from those files.
4. Run `northmes migrate`.
5. Run an idempotent seed: one company, one plant, a planner and an operator. Their dev-only credentials live in the seed package.
6. Take ports by binding `127.0.0.1:0` and pass them through the environment to the server, the shell proxy and the remotes. The server's default port is not 3000, and an `EADDRINUSE` error names `PORT`.

| Entry point | What runs after the shared steps |
|---|---|
| `pnpm dev` | Nest rebuilt by `tsc -b --watch`, the shell's Vite dev server and one Vite dev server per remote; a changed migration file triggers `northmes migrate` again |
| End-to-end global setup | Playwright workers clone their databases from the migrated template and start a built server each ([ADR 0041](0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md)) |
| `handoff-demo` in `.claude/launch.json` | The production build of role `all` on `$PORT` with fictional demo data, so each demo has one origin and one port |

`scripts/handoff/setup.sh`, which handoff runs once per worktree outside the coder's tool list, runs `pnpm install --frozen-lockfile`, pulls the pinned database image (about 363 MB compressed) and installs Playwright Chromium. Nothing in it needs a database. The agent notes drop the sentence about a shared `compose.yaml` stack, and agents never run `docker` or `docker compose`.

### One gate command and root scripts only

| Script | Runs | Used by |
|---|---|---|
| `pnpm check` | the Node major assertion ([ADR 0004](0004-monorepo-tooling-pnpm-turborepo-node-and-typescript-versions.md)), turbo `lint` and `typecheck`, `pnpm gen --check` ([ADR 0015](0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md)), then `vitest run` over the `unit`, `integration`, `web` and `types` projects | handoff's Tester, a developer before pushing, `ci / gate` |
| `pnpm check:full` | `pnpm check`, the Europe/Stockholm leg and the end-to-end suite | release 1's done conditions on `main`; CI jobs run its parts |

* Every CI gate step runs a script that `pnpm check` or `pnpm check:full` contains.
* Every graph under `docs/agents/handoff/graphs/` names `pnpm check` as the Tester command and in the coder instruction ("Run pnpm check before you finish."). The root script `pnpm test:handoff` stays as an alias that runs `pnpm check`, so a graph version that handoff imported before this rule still runs the same gate.
* Every command is a root pnpm script, such as `pnpm northmes <args>`, `pnpm plugin:build <id>`, `pnpm plugin:check <id>`, `pnpm db:migrate` and `pnpm gen:migration <module> <slug>`, or uses `pnpm --filter` or `pnpm -C` instead of `cd`. Docs never show a bare `northmes` or `node build.mjs` command.
* `AGENTS.md` is the single, tool-neutral rule file, and it states once that every command runs as `pnpm` or `git` from the repository root. `CLAUDE.md` starts with `@AGENTS.md` and adds only a short note on the installed skills. Neither file mentions handoff; the run rules live in handoff's project agent notes and in the graph node instructions.
* "Issue first" applies to people and interactive sessions. Run agents put follow-ups in the pull request description.

### Timeboxed walking skeleton

Month 1 ports the integration spike, kept as code in `docs/sources/`, test-first. The skeleton exit is the backend validator plugin, one web remote and `e2e/skeleton.spec.ts`: Playwright on the built `all` process with Testcontainers Postgres. The frontend widget plugin, `plugin check` and building a remote from outside the workspace move to M2 (2027-01-22) ([ADR 0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md)).

| Date | Condition | Action |
|---|---|---|
| 2026-11-13 | the skeleton is not green | hardening freezes |
| 2026-11-20 (M1) | none | `e2e/skeleton.spec.ts` and the resolve-hook test become required in `ci / gate` |
| 2026-11-27 | the skeleton is still red | the remotes take the tested Rsbuild exit, which stays inside [ADR 0019](0019-web-shell-with-react-module-federation-remotes.md) |

### Consequences

* Good, because a fresh worktree runs every test after one install, and edits take effect without a build.
* Good, because one gate gives the same verdict locally, in the Tester and in CI.
* Good, because dev, demos and end-to-end runs start the same way, and parallel runs get their own database and ports.
* Bad, because tests run sources while production runs `dist`; only the end-to-end suite on the built `all` process and the image smoke test see a difference between them.
* Bad, because `pnpm check` starts a Postgres container, so every machine that runs the gate needs Docker.
* Bad, because the widget plugin and `plugin check` stay unproven until M2.
* Neutral, because a laptop with reuse on keeps a Postgres container running between runs.

### Confirmation

* `test/meta/exports.test.ts` (name proposed) fails when a workspace package with `exports` does not list `"@northmes/source"` first and a `default` under `dist/`.
* CI job `fresh-worktree` runs `git worktree add`, `pnpm install --frozen-lockfile` and `pnpm test:int` with no build step, and passes.
* The image smoke test asserts that `NODE_OPTIONS` carries no `--conditions`.
* `dev-up.int.test.ts` runs the bootstrap twice against one container: the second run applies nothing and adds no rows, the seeded planner signs in through the Better Auth API, and `/health/ready` returns 200 ([ADR 0043](0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md)). The dev secret files exist with mode 0600 and carry the dev marker; the refusal itself is tested in `@northmes/sdk/config` ([ADR 0060](0060-configuration-with-nestjs-config-one-zod-environment-schema-and-secret-files.md)). Two stack instances started together get disjoint ports and no `EADDRINUSE`.
* `test/meta/gates.test.ts` asserts that the Tester command in every graph under `docs/agents/handoff/graphs/` equals `pnpm check` and that the graph's coder instruction names `pnpm check`, that the root `test:handoff` script runs `pnpm check`, that every CI gate step runs a script that `check` or `check:full` contains, that commands in `AGENTS.md` and `CLAUDE.md` start with `pnpm` or `git`, and that the first non-heading line of `CLAUDE.md` is `@AGENTS.md`.
* `e2e/skeleton.spec.ts` and the resolve-hook test are required in `ci / gate` from M1.

## Pros and cons of the options

### Source exports, one stack script, one gate, root scripts, timeboxed skeleton

* Good, because each gap found in review has one rule and one test.
* Neutral, because every package carries two entry points in its `exports` map.
* Bad, because the stack script is one more piece of tooling to build in E02.

### Build every package before tests

* Good, because tests run the same `dist` that production runs.
* Bad, because the setup and every Tester run pay for a full build, and the build counts against the Tester's 20-minute timeout.
* Bad, because an edit runs stale code until the next build, which breaks the red, green and refactor loop.

### A shared Compose stack with fixed ports

* Good, because Compose is what the pilot runs ([ADR 0044](0044-on-prem-deployment-with-docker-compose-and-mandatory-tls.md)).
* Bad, because parallel runs share one database and one set of ports; an earlier project that used one shared test database for agent runs recorded false failures from it.
* Bad, because agents must not run `docker compose`, so a run could not migrate or reset the stack.

### A gate per tool

* Good, because each tool runs what fits its time budget.
* Bad, because a change that passes one gate fails another, and each mismatch costs a coder round through the pull request.

### The full month-1 list

* Good, because both example plugins and `plugin check` would be proven in the skeleton.
* Bad, because about 27 to 38 days of work does not fit about 20 working days, so the skeleton date would slip with no fallback.

## More information

* Related ADRs: [0004](0004-monorepo-tooling-pnpm-turborepo-node-and-typescript-versions.md), [0005](0005-postgres-18-official-image-with-pgbackrest-timescaledb-deferred.md), [0015](0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md), [0019](0019-web-shell-with-react-module-federation-remotes.md), [0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md), [0041](0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md), [0043](0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md), [0047](0047-secrets-and-the-installation-key.md), [0049](0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md), [0050](0050-github-organization-rulesets-ci-runners-and-supply-chain.md), [0057](0057-scheduling-domain-as-a-pure-package-in-the-planning-module.md), [0060](0060-configuration-with-nestjs-config-one-zod-environment-schema-and-secret-files.md) configuration and the dev secret files.
* Plan: [11-quality-and-testing.md](../plan/11-quality-and-testing.md#one-stack-script) (root scripts, the stack script, meta tests), [13-delivery-and-github.md](../plan/13-delivery-and-github.md) (handoff setup, Tester, CI jobs), [02-architecture.md](../plan/02-architecture.md#repository-layout), [06-web-and-ux.md](../plan/06-web-and-ux.md), [14-roadmap.md](../plan/14-roadmap.md), [17-risks.md](../plan/17-risks.md).
* Node package exports and conditions: https://nodejs.org/api/packages.html#conditional-exports
* Vitest `resolve.conditions` (Vite option): https://vite.dev/config/shared-options.html#resolve-conditions
* Background: internal research notes 17, 19, 20, 28 and 32.
* Revisit when the skeleton is green (the timebox rows then close), when the weekly gate-time rows show `pnpm check` near the Tester's 20-minute timeout, or when handoff lets the coder run more commands.
