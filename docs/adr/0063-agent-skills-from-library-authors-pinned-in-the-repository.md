---
status: "accepted"
date: 2026-10-05
decision-makers: Krister Johansson
consulted: Krister Johansson and internal research notes 28 and 31
informed: contributors and coding agents
release: "1"
needs-confirmation: ""
---

# Agent skills from library authors, pinned in the repository

## Context and problem statement

[ADR 0049](0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md) installs ten skills from `mattpocock/skills` at commit `24fe0ef` in `.claude/skills`, and its skills test expects exactly those ten. They cover process (test first, module design, planning interviews) and none of the libraries NorthMES builds on. Agents' training data is behind the majors in use: they write Apollo Client 3 imports, put pnpm settings in `.npmrc`, miss Vitest 5's configuration inheritance and know TanStack Table v8. A handoff run agent reads only the files git tracks in its worktree and the skills its graph node names from handoff's library group `northmes`, which is imported from this repository.

On 2026-10-05 a license and fit review checked skills for the stack against the ADRs, and eight skills were added to `.claude/skills` the same day. Many of the reviewed skills contradict an ADR in their core advice, carry no license, or pre-approve `npm` and `npx` in their `allowed-tools` front matter, while `AGENTS.md` runs every command as `pnpm` or `git`.

This ADR records which third-party skills the repository vendors, how they are pinned and licensed, how agents use them next to the ADRs, which handoff nodes name which skills, and which reviewed skills were left out. It covers `.claude/skills`, `skills-lock.json`, `.claude/skills/THIRD_PARTY_LICENSE.md`, `.claude/settings.json`, `CLAUDE.md` and the `library` keys in `docs/agents/handoff/graphs/`. It changes two parts of ADR 0049, which is accepted; ADR 0049's text stays as it was.

## Decision drivers

* Agents' training data lags Apollo Client 4, Vitest 5, pnpm 12 and TanStack Table v9 ([ADR 0020](0020-frontend-libraries-tanstack-router-apollo-client-4-shadcn-ui-and-forms.md) names the Table v9 risk).
* Run agents see only tracked files and the library skills their node names, so a skill that runs need is committed and imported into the library.
* The ADRs hold over every other source. A skill whose core advice contradicts an ADR pulls agents away from the decision.
* The repository is public, so every vendored skill is redistributed and needs a license that allows it, reproduced next to the files.
* A skill can pre-approve tools in `allowed-tools`, run a command when it loads, or link to unpinned remote files.
* A skill whose description matches most tasks loads on most tasks, so its size counts against every run.

## Considered options

* Vendor eight reviewed skills, pinned by commit, with their licenses, `npm` and `npx` denied and the ADRs ahead of skill examples
* Keep the ten skills of ADR 0049 and rely on Context7 and the ADRs
* Vendor every skill the review found useful in part, each with an override note
* Install skills as plugins or at user level, at their latest version

## Decision outcome

Chosen option: "Vendor eight reviewed skills, pinned by commit, with their licenses, `npm` and `npx` denied and the ADRs ahead of skill examples", because it gives agents the library authors' guidance for the majors in use and two review checks the blocking rules lack, keeps every vendored file at a commit a review has read, and leaves the ADRs in charge where a skill's example differs.

### Vendored skills

The table shortens the pins to seven characters; `skills-lock.json` holds the full commits.

| Skill | Source, license, pin | What it adds | Where an ADR wins |
|---|---|---|---|
| `apollo-client` | `apollographql/skills`, MIT, `222dfc0` | Apollo Client 4 with React 19: imports from `@apollo/client/react`, `dataState`, data masking, `preloadQuery.toPromise` in loaders | The session cookie of ADR 0011 wins over the bearer token from `localStorage` in `integration-client.md`; `ApolloProvider` is imported from `@apollo/client/react`, not `@apollo/client`. Its `allowed-tools` pre-approve `npm`, `npx`, `node`, Write and Edit |
| `vitest` | `antfu/skills`, MIT, `e53a142` | Vitest 5.0.1, generated from the Vitest docs on 2026-09-25: inline projects that inherit the root config, the fixture builder | Tests use no `.env` file (ADR 0041, ADR 0060); Biome fails on `.only` and `.skip`; the web project uses happy-dom, not jsdom |
| `pnpm` | `antfu/skills`, MIT, `e53a142` | pnpm 12: settings in `pnpm-workspace.yaml`, catalogs, `allowBuilds` in place of `onlyBuiltDependencies` | Its CI examples (actions pinned by tag, `ubuntu-latest`, an install script piped from `curl`) yield to ADR 0050, and its Docker examples to ADR 0004 |
| `turborepo` | `vercel/turborepo`, MIT, `129acf0` | A 1.2 KB entry that sends the agent to the docs in `node_modules/turbo`, which the turbo package ships from 2.11.5 on, so the docs match the installed version | Turborepo caches only `build`, `typecheck` and `lint`, and tests run outside it (ADR 0004, ADR 0041); no ADR adopts the remote cache its docs describe |
| `playwright-cli` | `microsoft/playwright-cli`, Apache-2.0, `b85c7a7` | Browser automation from the Playwright authors: checking a built UI, attaching to a paused end-to-end test, role-based locators | Playwright runs as `pnpm exec playwright` and nothing is installed globally, where the skill uses `npx` and `npm install -g`. Its `allowed-tools` pre-approve `npx playwright` |
| `wrdn-authz` | `getsentry/warden-skills`, MIT, `daf01f9` | Authorization defects: IDOR, missing tenant scoping, role checks that fail open, NestJS guards and GraphQL resolvers | It does not know row-level security; `CLAUDE.md` says that row-level security with transaction-local scopes (ADR 0008) counts as tenant scoping. Its `allowed-tools` pre-approve unrestricted Bash |
| `secret-serialization` | `getsentry/skills`, Apache-2.0, `d18b7aa` | Secrets that reach pino logs, `util.inspect`, span attributes, error reports or serialized config objects | No conflict. It treats logger redaction as defence in depth, which matches ADR 0060: secret values never pass through `process.env`, logs or error messages |
| `diagnosing-bugs` | `mattpocock/skills`, MIT, `24fe0ef` | A diagnosis step before the fix: a fast, deterministic loop that can go red, then hypotheses, a regression test at the right seam and cleanup | No conflict. It writes the regression test before the fix, as `AGENTS.md` asks |

With the ten skills of ADR 0049, `.claude/skills` holds eighteen skills from seven sources.

### Pins, licenses and tool rules

* `skills-lock.json` records each skill's source, commit (`ref`), path and hash, and `.claude/skills` holds exactly the skills it lists. The lock file is the list of installed skills.
* `.claude/skills/THIRD_PARTY_LICENSE.md` has one section per source with the license name, the skills taken from that source, the repository URL, the pinned commit and the full license text. NorthMES's own license does not apply to these files. Five sources are MIT (`mattpocock/skills`, `apollographql/skills`, `antfu/skills`, `getsentry/warden-skills`, `vercel/turborepo`) and two are Apache-2.0 (`getsentry/skills`, `microsoft/playwright-cli`).
* A source is vendored only when its repository has a license file with a license from the list [ADR 0040](0040-dependency-license-policy-ci-gate-and-sbom.md) allows for the MIT packages. A source with no license file, or under a share-alike license such as CC-BY-SA-4.0, is not vendored.
* `.claude/settings.json` denies `Bash(npm *)` and `Bash(npx *)`. In Claude Code, deny rules override a skill's `allowed-tools`, so the `npm` and `npx` grants in `apollo-client` and `playwright-cli` do not run.
* `CLAUDE.md` names the use of each skill and says that where a skill's example differs from an ADR, the agent follows the ADR. It also says to run every tool through pnpm from the repository root, Playwright as `pnpm exec playwright`, and to install nothing globally.
* A pin moves only after reading the skills' changelog between the two commits, reviewing the diff under `.claude/skills` and running the `skill-scanner` skill over the changed folders. This extends ADR 0049's rule that the pin moves only after reading the changelog.

### Scanning skills before a pin moves

`skill-scanner` (`getsentry/skills`, Apache-2.0) is installed in the maintainer's `~/.claude/skills`, not in the repository. It checks a skill folder for broad `allowed-tools`, hooks in the front matter, `!` command lines, symlinks, bundled test files and npm lifecycle scripts. Its scanner runs through `uv run` with Python 3.9 or later, outside the pnpm-only rule, which is acceptable for a maintainer tool that never touches the build. Run agents never need it, so neither the repository nor the graphs carry it.

### TanStack Table v9 from node_modules

`@tanstack/table-core` and `@tanstack/react-table` ship their own skills, written for 9.2.6. Agents read them in `node_modules/@tanstack/table-core/skills/` and `node_modules/@tanstack/react-table/skills/`, and the repository does not vendor them, for two reasons: both packages ship skills with the same names (`table-state`, `migrate-v8-to-v9`), which collide in one `.claude/skills` folder, and the installed copy always matches the installed version.

* `with-tanstack-query.md` yields to ADR 0020, which does not use TanStack Query, and the `pageIndex` pagination examples yield to the Relay cursor connections of [ADR 0016](0016-graphql-list-conventions-connections-relations-filter-sort-search-and-group-by.md).
* The skills tell the agent to run `intent load`, a TanStack Intent CLI the stack does not have. The `npx` deny stops an unpinned `npx @tanstack/intent`.

### Handoff nodes and skills

The three graph files (`northmes-guided`, `northmes-standard`, `northmes-lean`) name the same skills per node under `library`:

| Node | Skills | MCP servers |
|---|---|---|
| Planner | `tdd`, `codebase-design` | `context7` |
| Plan reviewer | none | `context7` |
| Coder | `tdd`, `codebase-design`, `vitest`, `pnpm`, `turborepo`, `apollo-client`, `playwright-cli` | `context7` |
| Code review | `wrdn-authz`, `secret-serialization` | none |

* The repository's skills are imported into handoff's library group `northmes`. A node that names a skill the library lacks fails, so a new skill is imported first, and the graphs are imported again afterwards with `northmes-guided` last.
* No node names `diagnosing-bugs`. It serves interactive sessions on bug reports and performance regressions, and on the coder it is meant only for a bug-fix task.
* No node names the other eight `mattpocock/skills` skills either. They serve interactive sessions as ADR 0049 decides, and the run configuration denies `grilling` and `domain-modeling`.

### Changes to ADR 0049

ADR 0049 is accepted, so its text stays as it was. This ADR replaces two parts of it, and the rest of ADR 0049 stands.

| ADR 0049 | Replaced by |
|---|---|
| Skills and personas: "Ten skills are installed in `.claude/skills` at commit `24fe0ef`, recorded in `skills-lock.json`, with the MIT notice", followed by the list of ten | Eighteen skills are installed: the ten of ADR 0049 from `mattpocock/skills` at `24fe0ef` and the eight in the table above, each pinned by commit in `skills-lock.json`, with every source's license in `.claude/skills/THIRD_PARTY_LICENSE.md` |
| Confirmation: "Skills test: `.claude/skills` holds exactly the ten skills in `skills-lock.json`, pinned at `24fe0ef`." | Skills test: `.claude/skills` holds exactly the skills in `skills-lock.json`, each at its pinned commit, and `THIRD_PARTY_LICENSE.md` names every source |

### Reviewed and left out

Each skill below has one reason class:

* ADR conflict: the skill's core advice or setup contradicts an ADR.
* License: no license file, or a share-alike license.
* Packaging: the skill runs or fetches unpinned code, depends on files outside its folder, or needs tools NorthMES agents do not have.
* Duplicate: the ADRs, Context7, an installed skill or a built-in review already cover it.
* Workflow clash: the skill replaces a handoff step or a Claude Code built-in.
* Out of date: the skill targets an older major or API than the one in use.
* Later: useful once, or after a part of the system exists, and not for every session.

| Skill | Source | Reason class | Detail |
|---|---|---|---|
| `supabase-postgres-best-practices` | `supabase/agent-skills` | ADR conflict | Its row-level security rule uses a `FOR ALL` policy, `FORCE ROW LEVEL SECURITY` and a session-level `SET` (ADR 0008); its primary key, advisory lock and enum rules contradict ADR 0006 and ADR 0014 |
| `postgresql-table-design` | `wshobson/agents` | ADR conflict | `bigint` identity keys against the `uuidv7()` keys of ADR 0006; `LOWER(col)` indexes, which ADR 0008 and ADR 0009 avoid under row-level security |
| `postgres` | `planetscale/database-skills` | Packaging | Tells agents to recommend PlanetScale hosting, links every reference to the unpinned `main` branch, and prefers `bigint` keys against ADR 0006 |
| `postgres-database-migration` | `timescale/pg-aiguide` | ADR conflict | `CREATE INDEX CONCURRENTLY`, which fails inside the per-file migration transaction of ADR 0006; an invalid Postgres 18 `NOT NULL` example |
| `kysely-postgres` | `qwexs/kysely-postgres-skill` | ADR conflict | Migrations through Kysely's TypeScript migrator with `bigint` keys (ADR 0006), and `timestamptz` mapped to `Date` where ADR 0024 uses Temporal; one maintainer, and a license holder who is not the author |
| `tl-pg-boss` | `toddlevy/tl-agent-skills` | Out of date | Written against pg-boss 10 limits and option names, where ADR 0014 pins 12.36.0; lets `start()` create the schema, against `migrate: false` |
| `zod` | `anivar/zod-skill` | ADR conflict | Marks `z.lazy()` as removed, which Zod 4 still exports; pushes `z.discriminatedUnion`, which `inputFromZod` rejects in command inputs (ADR 0017) |
| `nestjs-architecture-principles`, `nestjs-features-performance` | `amirtaherkhani/nestjs-skills` | Duplicate | Restate decisions the ADRs already make and add nothing for NestJS 12; a stop-and-ask guard can stall a headless run |
| Better Auth skills | `better-auth/skills` | License | No license file |
| Row-level security skills | `troykelly/claude-skills` and others | License | No license |
| `graphql-schema` | `apollographql/skills` | ADR conflict | Union result types for errors, which ADR 0012 rules out; written schema-first, while NorthMES generates its SDL; pre-approves `npm` and `npx` |
| `graphql-operations` | `apollographql/skills` | ADR conflict | `@graphql-eslint` with ESLint, where ADR 0004 uses Biome; generated `typescript-react-apollo` hooks, which ADR 0020 rules out |
| `apollo-federation` | `apollographql/skills` | ADR conflict | Value types shared with `@shareable` and a non-null field added to another subgraph's entity, both against ADR 0015; examples link Federation v2.12, where ADR 0015 pins v2.9 |
| `mf` | `module-federation/agent-skills` | License | No license file |
| `router-core`, `react-router` | `TanStack/router` | ADR conflict | Every setup example and checklist assumes file routes and the router plugin; ADR 0020 uses code-based routes, and ADR 0019 builds remote routes at run time |
| `tanstack-router` | `tanstack-skills/tanstack-skills` | Out of date | Unofficial, last changed 2026-01-29; teaches file routes and TanStack Query |
| `shadcn` | `shadcn-ui/ui` | Packaging | Runs `npx shadcn@latest info --json` each time it loads and pre-approves write-capable CLI commands; prefers the Base UI toast, where ADR 0020 and ADR 0021 use sonner |
| `react-hook-form` | `pproenca/dot-skills` | ADR conflict | `zodResolver` throughout, where ADR 0020 uses the Standard Schema resolver behind `useZodForm`; its shadcn rules target the older Radix form wrappers |
| `accessibility` | `addyosmani/web-quality-skills` | ADR conflict | Hand-rolled live regions and focus traps, where ADR 0021 uses the shell's `announce()`; its contrast table measures large text in px instead of pt |
| `a11y-debugging` | `ChromeDevTools/chrome-devtools-mcp` | Packaging | Needs the Chrome DevTools MCP server, which agents do not have; 48 px targets against the 24 px of ADR 0021 |
| `vite` | `antfu/skills` | Duplicate | Correct for Vite 8, but Context7 serves the Vite docs and the Vite configuration lives in one package |
| `playwright-best-practices` | `currents-dev/playwright-best-practices-skill` | ADR conflict | `webServer` with `reuseExistingServer` and Prisma seeding, against the fixture design of ADR 0041 and against ADR 0006 |
| `docker-compose-patterns`, `docker-build-strategies` | `docker/skills` | ADR conflict | Image tags instead of digests and `compose.override.yaml` for development (ADR 0044); Alpine runtime images and npm (ADR 0004); bundled scripts run `docker`, which agents never run (ADR 0058) |
| `docker-destructive-guardrails` | `docker/skills` | Duplicate | Agents never run `docker`, and Claude Code already asks before destructive commands |
| `github-actions-hardening` | `github/awesome-copilot` | ADR conflict | Dependabot for action pins and tag-pinned first-party actions rated low, against Renovate and full SHA pins in ADR 0050; the workflows meta test covers the rest |
| `javascript-testing-expert` | `dubzzz/fast-check` | ADR conflict | `.spec.ts` files and test names that start with "should", against ADR 0041; loads next to `tdd` on every testing task |
| `property-based-testing` and the other `trailofbits/skills` skills | `trailofbits/skills` | License | CC-BY-SA-4.0 |
| `security-review` | `getsentry/skills` | License | Its references derive from the OWASP Cheat Sheet Series under CC-BY-SA-4.0 |
| `ai-sdk` | `vercel/ai` | ADR conflict | Its AI Gateway section sets `AI_GATEWAY_API_KEY` and plain model ids, which ADR 0035 guards against |
| `typescript-mcp-server-generator` | `github/awesome-copilot` | Out of date | Behind MCP TypeScript SDK 2.3, and scaffolds a standalone server where ADR 0034 has one `/mcp` controller in the api role |
| `mcp-server-review` | `OWASP/secure-agent-playbook` | Packaging | Points to files outside its folder and calls the OpenCRE API; ADR 0034 already decides most of its checklist |
| `otel-instrumentation` | `dash0hq/agent-skills` | Later | npm installs and vendor setup; OpenTelemetry is optional and off by default in release 1 (ADR 0046) |
| `typescript-temporal` | `laurigates/claude-plugins` | ADR conflict | Uses bun and teaches seams that call `Temporal.Now` or `Date.now()`, which ADR 0024 bans in domain code |
| `threat-model` | `anthropics/defending-code-reference-harness` | Later | One interactive interview rather than a skill for every session; depends on a script outside its folder |
| `security-threat-model` | `openai/skills` | Later | One interactive session after the walking skeleton and one before the pilot install; it pauses for answers, so it cannot run in a handoff run |
| `gha-security-review` | `getsentry/skills` | Later | Worth an interactive review when the CI workflows land; its pin policy accepts tag-pinned first-party actions, against ADR 0050 |
| `verification-before-completion` | `obra/superpowers` | ADR conflict | Demands a fresh verification before any claim of success, where ADR 0049's node instructions never ask an agent to verify again |
| `receiving-code-review` | `obra/superpowers` | Workflow clash | Replies in review threads with `gh api`, which the coder does not have |
| `code-review` | `mattpocock/skills` | Workflow clash | Same name as Claude Code's built-in `code-review`, which handoff's code review node calls |
| `to-tickets` | `mattpocock/skills` | Workflow clash | Publishes issues outside handoff's tools, labels and Project |
| `find-bugs` | `getsentry/skills` | Duplicate | A generic checklist that the built-in `/security-review` and `/code-review` and CodeRabbit cover; it runs `gh repo view` |
| `performance-optimization` | `addyosmani/agent-skills` | ADR conflict | ORM examples and offset pagination, against ADR 0006 and ADR 0016 |
| `autofix` | `coderabbitai/skills` | Duplicate | Asks for approval per change, and handoff already sends CodeRabbit findings to the coder |

ADR 0049 already leaves out these `mattpocock/skills` skills: `handoff` (a name clash with the plugin), `to-spec`, `implement`, `implement-spec`, `wayfinder`, `triage` and `setup-matt-pocock-skills`, which create issues or run work outside handoff's Project and runs.

The review found no usable skill for NestJS GraphQL code-first, Hive Gateway and federation composition, graphql-ws, pg-boss 12, Zod usage from its authors, `@nestjs/config`, Base UI, Tailwind CSS v4, React 19 and the React Compiler for consumers, TanStack Virtual, GraphQL Code Generator, Biome 2.5, Testcontainers for Node, TypeScript 6, Renovate, release-please, Caddy, pgBackRest, the MCP TypeScript SDK v2 and pino. The ADRs, Context7 and the project skills that the E02 tasks write (`db-test`, `vertical-slice`, `graphql-subgraph`, `web-remote`, `dst-test`) cover these areas.

### Consequences

* Good, because agents get the authors' guidance for Apollo Client 4, Vitest 5, pnpm 12, the installed Turborepo and TanStack Table v9, where their training data is behind.
* Good, because the code review node checks authorization defects and secret leaks with skills built for those defect classes.
* Good, because `skills-lock.json` is the list, so adding or removing a skill changes the lock file and the license file, not a count in an ADR.
* Neutral, because `turborepo` and the TanStack Table skills read files from `node_modules`, which the pnpm lockfile pins, not `skills-lock.json`.
* Bad, because the vendored skills keep examples that contradict ADRs, and agents depend on the `CLAUDE.md` rule to follow the ADR.
* Bad, because `vitest` and `pnpm` match most tasks and load often, and `wrdn-authz` is about 5 000 tokens when it triggers.
* Bad, because the deny rule also blocks `npm` and `npx` in the maintainer's interactive sessions in this repository.
* Bad, because the vendored skills are tracked and so sit in every worktree, and `diagnosing-bugs` matches words such as "failing" and "slow"; its loop template reads from stdin, which a headless run cannot answer.
* Bad, because pins move by hand, so the skills lag their sources until someone reviews a newer commit.

### Confirmation

* Skills test, in `test/meta/agent-files.test.ts`: ".claude/skills holds exactly the skills in skills-lock.json, each at its pinned commit, and THIRD_PARTY_LICENSE.md names every source". It replaces the skills test of ADR 0049.
* License file check, in `test/meta/agent-files.test.ts`: "each source section of .claude/skills/THIRD_PARTY_LICENSE.md lists the skills skills-lock.json takes from that source and the full commit it pins, and holds a license text".
* Deny rule check, in `test/meta/agent-files.test.ts`: ".claude/settings.json denies Bash(npm *) and Bash(npx *)".

## Pros and cons of the options

### Vendor eight reviewed skills, pinned, licensed, under the ADRs

* Good, because the library authors' skills state the API changes where agents' training data is behind.
* Good, because `wrdn-authz` and `secret-serialization` add checks that the NorthMES blocking rules do not list.
* Good, because a pin and a license section trace every vendored file to a reviewed commit and a license.
* Bad, because examples that contradict ADRs stay in the vendored text.
* Bad, because two of the skills match most tasks and cost context on most runs.

### Keep the ten skills and rely on Context7 and the ADRs

* Good, because no third-party text enters agents' context, and only one source needs a license and a pin.
* Bad, because nothing prompts an agent with stale training data to look up Apollo Client 4 or pnpm 12 before it writes code, while a skill loads when its description matches the task.
* Bad, because the code review node has no MCP server, so Context7 gives the review no authorization or secret-leak checks.

### Vendor every skill that is useful in part, with override notes

* Good, because agents would also get the useful rules in `shadcn`, the TanStack Router skills, `apollo-federation` and `kysely-postgres`.
* Bad, because those skills contradict ADRs in their core advice or setup (file routes, `@shareable` value types, `FOR ALL` policies), and an override note competes with the skill text in every run that loads it.
* Bad, because `shadcn` runs an unpinned `npx shadcn@latest` each time it loads.

### Install skills as plugins or at user level, at their latest version

* Good, because updates arrive without a pin move.
* Bad, because run agents see only tracked files and handoff's library group, which is imported from this repository, so user-level skills never reach runs.
* Bad, because the content changes without review; `secret-serialization` was ten days old and still changing at the time of the review.

## More information

* Changes [ADR 0049](0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md) in two places: the list of exactly ten skills and the skills test.
* Related ADRs: [0004](0004-monorepo-tooling-pnpm-turborepo-node-and-typescript-versions.md) pnpm and Turborepo, [0006](0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md) migrations, [0008](0008-row-level-security-with-transaction-local-scopes.md) row-level security, [0011](0011-principals-credentials-and-same-origin-rules.md) the session cookie, [0012](0012-commands-as-the-single-write-path.md) command errors, [0014](0014-outbox-event-log-and-pg-boss-jobs.md) pg-boss, [0015](0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md) federation, [0016](0016-graphql-list-conventions-connections-relations-filter-sort-search-and-group-by.md) connections, [0017](0017-zod-contracts-as-the-single-source-for-inputs.md) Zod contracts, [0019](0019-web-shell-with-react-module-federation-remotes.md) remote routes, [0020](0020-frontend-libraries-tanstack-router-apollo-client-4-shadcn-ui-and-forms.md) frontend libraries, [0021](0021-accessibility-target-wcag-2-2-aa.md) accessibility, [0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md) time, [0034](0034-mcp-surface-one-endpoint-a-read-mostly-planning-toolset.md) MCP, [0035](0035-ai-provider-port-with-customer-configured-providers.md) AI providers, [0040](0040-dependency-license-policy-ci-gate-and-sbom.md) license policy, [0041](0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md) tests, [0044](0044-on-prem-deployment-with-docker-compose-and-mandatory-tls.md) Compose, [0046](0046-observability-structured-logs-host-checks-and-optional-opentelemetry.md) observability, [0050](0050-github-organization-rulesets-ci-runners-and-supply-chain.md) CI and supply chain, [0058](0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md) the gate command and docker, [0060](0060-configuration-with-nestjs-config-one-zod-environment-schema-and-secret-files.md) secrets in configuration.
* Plan: [13 delivery and GitHub](../plan/13-delivery-and-github.md#agent-skills-in-the-repository) (agent skills in the repository, and [library skills](../plan/13-delivery-and-github.md#library-skills)); [docs/agents/handoff/README.md](../agents/handoff/README.md) for importing skills into the library.
* Files: [CLAUDE.md](../../CLAUDE.md), [skills-lock.json](../../skills-lock.json), [.claude/settings.json](../../.claude/settings.json), [.claude/skills/THIRD_PARTY_LICENSE.md](../../.claude/skills/THIRD_PARTY_LICENSE.md).
* Internal research note 28 covers handoff's library and node configuration; internal research note 31 covers the `mattpocock/skills` selection and the `code-review` name clash.
* Revisit when a vendored skill's library gets a new major in NorthMES, when E00 adds the CI workflows (`gha-security-review`), when the observability profile is built (`otel-instrumentation`), when a library author publishes a skill for one of the gaps above, or when a source changes its license.
