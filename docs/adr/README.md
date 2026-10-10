# Architecture decision records

This folder holds the architecture decisions of NorthMES, an open source, developer-first manufacturing execution system whose first module is production planning. Each decision is one file in MADR 4 format with NorthMES front matter, as [ADR 0001](0001-record-architecture-decisions-in-madr.md) decides. The plan that these decisions serve is in [docs/plan](../plan/README.md), and the terms follow [GLOSSARY.md](../../GLOSSARY.md). When a plan document and an ADR disagree, the ADR holds and the plan document gets fixed.

Every ADR is public and self-contained. It states the names, versions, measured numbers, error codes and test names its decision needs, so a reader or a coding agent with only `docs/plan` and `docs/adr` can act on it. Research behind a decision is cited as "internal research note NN" without a path; those notes are private, and no ADR links to them. No ADR names a customer: the plan says "the pilot customer". ADRs hold no legal strategy, commercial terms or private cost figures.

## Decisions by area

| Area | ADRs |
|---|---|
| Release 1 scope | 0055 |
| Repository, tooling, releases and delivery | 0001, 0004, 0038, 0048, 0049, 0050, 0058, 0063, 0065, 0069 |
| Architecture, modules and plugins | 0002, 0003, 0022, 0037, 0057, 0064, 0068, 0070 |
| Data and platform | 0005, 0006, 0007, 0008, 0009, 0010, 0011, 0012, 0013, 0014, 0017, 0023, 0024, 0054, 0059, 0060, 0066, 0071 |
| GraphQL, realtime and MCP | 0015, 0016, 0018, 0034, 0070 |
| Web | 0019, 0020, 0021, 0053, 0061, 0062, 0067, 0070 |
| Production planning | 0025, 0026, 0027, 0028, 0029, 0030 |
| ERP integration and the Pyramid connector | 0031, 0032 |
| Operator station | 0033 |
| AI | 0035, 0036 |
| Testing | 0041, 0042 |
| Operations | 0043, 0044, 0045, 0046, 0047, 0052 |
| Licensing | 0039, 0040, 0056 |
| Regulated readiness | 0051 |

## Adding an ADR

### When to write one

- Every decision that the plan in `docs/plan` lists has an ADR.
- A session also offers an ADR when a decision is hard to reverse, surprising without context and a real trade-off.
- A changed decision gets a new ADR. The old ADR's status becomes `superseded by ADR-NNNN`, and its text stays as it was.
- A new ADR that changes only part of an accepted ADR leaves that ADR accepted and its text unchanged. The new ADR names the parts it replaces in a section headed "Changes to ADR NNNN", and the rest of the old ADR stands. The old ADR is superseded only when the new one replaces its whole decision.

### Steps

1. Take the number from `pnpm adr:next` (`scripts/adr/next-number.mjs`), which prints the number after the highest row in the index. Raise the "Next free number" line under the index by one in the same change. Nobody takes a number by scanning this folder: two parallel sessions would take the same number, which is how an earlier attempt at this product ended up with two ADRs numbered 016.
2. Copy [template.md](template.md) to `docs/adr/NNNN-kebab-title.md`. The title names the problem and the chosen solution, and the file name is that title in kebab case.
3. Fill in the front matter as the table below describes. A new ADR has status `proposed`.
4. Write the sections in the template's order: context and problem statement, decision drivers, considered options, decision outcome (with consequences and confirmation), pros and cons of the options, and more information.
5. Give every Confirmation item a test, lint rule or CI check that a task can carry. The planning session copies each item into a task's Tests first lines or acceptance criteria.
6. Link related ADRs and plan documents with relative links, for example `0012-commands-as-the-single-write-path.md` or `../plan/07-production-planning.md`. Cite research as "internal research note NN", never as a path or link.
7. Add a row to the index in number order. Copy the first heading into the Title cell and the `status`, `release` and `needs-confirmation` values into their cells exactly.
8. In the maintainer's planning workflow, commit the ADR in the epic's docs pull request, which adds the shaping file and the epic's ADRs and closes the task "docs: record the Enn plan and ADRs" ([13-delivery-and-github.md](../plan/13-delivery-and-github.md#plan-identifiers-and-files)).

### Front matter

| Field | Allowed values |
|---|---|
| `status` | `proposed`, `accepted`, `rejected`, `deprecated` or `superseded by ADR-NNNN` |
| `date` | the day the decision was last updated, `YYYY-MM-DD` |
| `decision-makers` | `Krister Johansson` for an accepted ADR; `proposed by the planning session, to be confirmed by Krister Johansson` for a proposed one |
| `consulted` | people, and internal research notes by number only |
| `informed` | the people and groups who must know the decision |
| `release` | `1`, `later` or `vision` |
| `needs-confirmation` | empty, or who must still confirm which part: maintainer, product owner, pilot IT, lawyer |

### Statuses

| Status | Meaning |
|---|---|
| `proposed` | A planning session drafted the decision. It waits for Krister Johansson to accept or change it. |
| `accepted` | Krister Johansson made the decision. Details inside it that were adopted from research are named as such in its body. |
| `rejected` | Krister Johansson turned the proposal down. The file stays and keeps its number, because numbers run from 0001 without gaps. |
| `deprecated` | The decision no longer applies, and no ADR replaces it. |
| `superseded by ADR-NNNN` | A newer ADR replaces the decision. The old file stays, and its status names the new ADR. |

Only Krister Johansson sets `accepted`. Status changes on existing ADRs go into the docs task at the end of each epic, which runs alone, because shared files cause merge conflict loops between parallel runs.

### Needs confirmation

The `needs-confirmation` field names who must still confirm which part of a decision, in the form `owner (part; part)`, with several owners joined by `; `. An empty value means that nobody still has to confirm anything.

| Owner | Who it is |
|---|---|
| `maintainer` | Krister Johansson, the maintainer |
| `product owner` | the pilot customer's product owner |
| `pilot IT` | the pilot customer's IT, together with its Pyramid administrator |
| `lawyer` | legal review |

- An accepted ADR can still carry entries: the decision stands, and the named parts wait.
- Each maintainer, product owner and pilot IT entry has a question in [16-open-questions.md](../plan/16-open-questions.md) with an id (`M-nn`, `PO-nn`, `IT-nn`) and the working default that the plan and the code use until the answer arrives. Legal questions are not tracked in the public plan.
- When an answer arrives, the planning session updates the ADR (its text and this field), the index row and the question's row.
- A task moves to Ready only when every ADR it links is on `main` with status `accepted` and an empty `needs-confirmation`. Until then the task stays in Shaping, or it carries the `human` label, so it runs only on the guided handoff graph, where Krister approves the plan and the code, or a person works it in a session.

### Checks

Epic E00 adds the checks that keep this folder in step ([14-roadmap.md](../plan/14-roadmap.md), story E00-S05):

- `test/meta/adr.test.ts`: every `docs/adr/NNNN-*.md` file has the seven front matter fields with allowed values; numbers are unique and run from 0001 without gaps; every file appears in this index with the same title, status, release and needs-confirmation; the index lists no file that does not exist; an accepted ADR has `decision-makers: Krister Johansson`; the "Next free number" line equals the number `pnpm adr:next` prints.
- `test/meta/doc-links.test.ts`: every relative link in `docs/plan`, `docs/adr`, `docs/agents` and `GLOSSARY.md` resolves to a tracked file, and no link points into the gitignored `docs/research` folder.
- The plan review checklist: the ADRs and plan text of a planning pull request name no customer and contain no legal strategy, commercial terms or private cost figures.

## Index

On 2026-10-09 the index holds 71 ADRs: 48 accepted and 23 proposed, 68 for release 1 and 3 for a later release. 26 of the accepted ADRs have an empty needs-confirmation: 0001, 0002, 0003, 0006, 0008, 0012, 0014, 0015, 0016, 0017, 0018, 0022, 0036, 0041, 0042, 0043, 0050, 0052, 0053, 0058, 0060, 0061, 0062, 0063, 0064 and 0069.

| ADR | Title | Status | Release | Needs confirmation |
|---|---|---|---|---|
| 0001 | [Record architecture decisions in MADR](0001-record-architecture-decisions-in-madr.md) | accepted | 1 | |
| 0002 | [Modular monolith with module-owned schemas and process roles](0002-modular-monolith-with-module-owned-schemas-and-process-roles.md) | accepted | 1 | |
| 0003 | [Module package shape and the defineModule manifest](0003-module-package-shape-and-the-definemodule-manifest.md) | accepted | 1 | |
| 0004 | [Monorepo tooling: pnpm, Turborepo, Node and TypeScript versions](0004-monorepo-tooling-pnpm-turborepo-node-and-typescript-versions.md) | accepted | 1 | maintainer (TypeScript 6.0.x) |
| 0005 | [Postgres 18 official image with pgBackRest, TimescaleDB deferred](0005-postgres-18-official-image-with-pgbackrest-timescaledb-deferred.md) | accepted | 1 | maintainer (the pgBackRest source fallback until PGDG publishes 2.59.3) |
| 0006 | [Kysely, SQL-first migrations and the NorthMES migration runner](0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md) | accepted | 1 | |
| 0007 | [Tenancy: company, plants and the scope tree](0007-tenancy-company-plants-and-the-scope-tree.md) | accepted | 1 | product owner (customer order line scope); maintainer (one plant at a time) |
| 0008 | [Row-level security with transaction-local scopes](0008-row-level-security-with-transaction-local-scopes.md) | accepted | 1 | |
| 0009 | [Code uniqueness per scope with an exclusion constraint](0009-code-uniqueness-per-scope-with-an-exclusion-constraint.md) | proposed | 1 | product owner (case-insensitive codes, archived codes, level of operation tools) |
| 0010 | [Identity with Better Auth, roles and permissions in core tables](0010-identity-with-better-auth-roles-and-permissions-in-core-tables.md) | accepted | 1 | product owner (who edits and assigns roles); maintainer (operator placeholder email) |
| 0011 | [Principals, credentials and same-origin rules](0011-principals-credentials-and-same-origin-rules.md) | proposed | 1 | |
| 0012 | [Commands as the single write path](0012-commands-as-the-single-write-path.md) | accepted | 1 | |
| 0013 | [Audit trail written in the command transaction](0013-audit-trail-written-in-the-command-transaction.md) | accepted | 1 | maintainer (lifecycle classes; tool results as exports); lawyer (retention, erasure) |
| 0014 | [Outbox, event log and pg-boss jobs](0014-outbox-event-log-and-pg-boss-jobs.md) | accepted | 1 | |
| 0015 | [GraphQL Federation inside one process with an embedded Hive Gateway](0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md) | accepted | 1 | |
| 0016 | [GraphQL list conventions: connections, relations, filter, sort, search and group by](0016-graphql-list-conventions-connections-relations-filter-sort-search-and-group-by.md) | accepted | 1 | |
| 0017 | [Zod contracts as the single source for inputs](0017-zod-contracts-as-the-single-source-for-inputs.md) | accepted | 1 | |
| 0018 | [Realtime subscriptions over graphql-ws fed by the event tail](0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md) | accepted | 1 | |
| 0019 | [Web shell with React Module Federation remotes](0019-web-shell-with-react-module-federation-remotes.md) | accepted | 1 | pilot IT (browser versions) |
| 0020 | [Frontend libraries: TanStack Router, Apollo Client 4, shadcn/ui and forms](0020-frontend-libraries-tanstack-router-apollo-client-4-shadcn-ui-and-forms.md) | accepted | 1 | maintainer (Base UI; token base) |
| 0021 | [Accessibility target WCAG 2.2 AA](0021-accessibility-target-wcag-2-2-aa.md) | accepted | 1 | product owner (is pause live updates wanted) |
| 0022 | [Shared building blocks: packages, the master-data kit, settings and generators](0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md) | accepted | 1 | |
| 0023 | [SI units with a NorthMES unit catalog](0023-si-units-with-a-northmes-unit-catalog.md) | accepted | 1 | product owner (pieces per hour) |
| 0024 | [Time: UTC instants, plant wall clock, Temporal and the clamp resolver](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md) | proposed | 1 | |
| 0025 | [Plant calendars, shift patterns and the production day](0025-plant-calendars-shift-patterns-and-the-production-day.md) | proposed | 1 | product owner (shift and break times, week rule, deviation precedence, production day start) |
| 0026 | [Planning domain names aligned with ISA-95](0026-planning-domain-names-aligned-with-isa-95.md) | proposed | 1 | |
| 0027 | [Planned duration formula and override precedence](0027-planned-duration-formula-and-override-precedence.md) | proposed | 1 | product owner (divisor, tool override of cycleSeconds, deadline and lead-time defaults) |
| 0028 | [Autoplan as a pure deterministic function](0028-autoplan-as-a-pure-deterministic-function.md) | proposed | 1 | product owner (frozen window, overdue rows, apply path, child orders) |
| 0029 | [Per-planner drafts, soft locks and the plan revision](0029-per-planner-drafts-soft-locks-and-the-plan-revision.md) | accepted | 1 | product owner (lock level, who may break locks, save with conflicts) |
| 0030 | [A planning board built in house](0030-a-planning-board-built-in-house.md) | proposed | 1 | product owner (weekly volumes); pilot IT (planner PC); lawyer (FullCalendar fallback only) |
| 0031 | [ERP integration: connector modules, field ownership and pending changes](0031-erp-integration-connector-modules-field-ownership-and-pending-changes.md) | proposed | 1 | product owner (field ownership, spread rule) |
| 0032 | [Pyramid connector: polling, file mode and shadow write-back](0032-pyramid-connector-polling-file-mode-and-shadow-write-back.md) | proposed | 1 | pilot IT (write method, Pyramid field meanings); product owner (fallback write path, plant moves) |
| 0033 | [Online operator station in the production-start module](0033-online-operator-station-in-the-production-start-module.md) | accepted | 1 | product owner (reporting in NorthMES or Pyramid, corrections, operators per station); pilot IT (station network, hardware) |
| 0034 | [MCP surface: one endpoint, a read-mostly planning toolset](0034-mcp-surface-one-endpoint-a-read-mostly-planning-toolset.md) | accepted | 1 | maintainer (off by default per installation; personal access tokens before OAuth) |
| 0035 | [AI provider port with customer-configured providers](0035-ai-provider-port-with-customer-configured-providers.md) | accepted | 1 | lawyer (AI Act Article 50); maintainer (Google in release 1) |
| 0036 | [Agent proposals as planning records a person commits](0036-agent-proposals-as-planning-records-a-person-commits.md) | accepted | 1 | |
| 0037 | [Plugins: drop-in packages, command validators and UI slots](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md) | accepted | 1 | maintainer (no third-party plugin on the pilot; web-only plugins degrade); product owner (unpaid-invoice validator) |
| 0038 | [Versions and releases: lockstep 0.x, release-please, API reports](0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md) | accepted | 1 | maintainer (no range override in 0.x) |
| 0039 | [License: AGPL-3.0-or-later core and a contributor license agreement](0039-license-agpl-3-0-or-later-core-and-a-contributor-license-agreement.md) | accepted | 1 | lawyer (license file and CLA text) |
| 0040 | [Dependency license policy, CI gate and SBOM](0040-dependency-license-policy-ci-gate-and-sbom.md) | proposed | 1 | lawyer (GPL family policy) |
| 0041 | [Test strategy: TDD, Vitest projects, Testcontainers and Playwright](0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md) | accepted | 1 | |
| 0042 | [AI in tests: mocked by default, opt-in live runs](0042-ai-in-tests-mocked-by-default-opt-in-live-runs.md) | accepted | 1 | |
| 0043 | [Health endpoints, graceful shutdown and the System health page](0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md) | accepted | 1 | |
| 0044 | [On-prem deployment with Docker Compose and mandatory TLS](0044-on-prem-deployment-with-docker-compose-and-mandatory-tls.md) | accepted | 1 | pilot IT (TLS option, bind address) |
| 0045 | [Backups, restore drills, upgrades and rollback](0045-backups-restore-drills-upgrades-and-rollback.md) | proposed | 1 | maintainer and pilot IT (disk layout, offsite target, RPO and RTO); product owner (upgrade window) |
| 0046 | [Observability: structured logs, host checks and optional OpenTelemetry](0046-observability-structured-logs-host-checks-and-optional-opentelemetry.md) | proposed | 1 | pilot IT (monitoring tool or SMTP relay) |
| 0047 | [Secrets and the installation key](0047-secrets-and-the-installation-key.md) | proposed | 1 | pilot IT (escrow location) |
| 0048 | [Documentation on Docs7 at docs.northmes.dev](0048-documentation-on-docs7-at-docs-northmes-dev.md) | accepted | 1 | maintainer (docs content license) |
| 0049 | [Delivery workflow: handoff, thin vertical slices and Claude Design per task](0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md) | accepted | 1 | maintainer (persona list, epic order) |
| 0050 | [GitHub organization, rulesets, CI runners and supply chain](0050-github-organization-rulesets-ci-runners-and-supply-chain.md) | accepted | 1 | |
| 0051 | [Regulated readiness: no-regret rules](0051-regulated-readiness-no-regret-rules.md) | accepted | 1 | lawyer (signature path, CRA role); product owner (regulated profile switch) |
| 0052 | [Error telemetry: opt-in and deferred](0052-error-telemetry-opt-in-and-deferred.md) | accepted | later | |
| 0053 | [Translation: English first, General Translation later](0053-translation-english-first-general-translation-later.md) | accepted | 1 | |
| 0054 | [File storage port with a Postgres driver](0054-file-storage-port-with-a-postgres-driver.md) | proposed | later | |
| 0055 | [Release 1 scope under option B and the scope rule](0055-release-1-scope-under-option-b-and-the-scope-rule.md) | accepted | 1 | maintainer (ledger additions) |
| 0056 | [MIT SDK packages, the extension exception and the trademark policy](0056-mit-sdk-packages-the-extension-exception-and-the-trademark-policy.md) | accepted | 1 | lawyer |
| 0057 | [Scheduling domain as a pure package in the planning module](0057-scheduling-domain-as-a-pure-package-in-the-planning-module.md) | proposed | 1 | maintainer |
| 0058 | [Developer environment: source exports, one stack script and one gate command](0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md) | accepted | 1 | |
| 0059 | [Time-series storage port with an open default backend](0059-time-series-storage-port-with-an-open-default-backend.md) | proposed | later | maintainer (no TimescaleDB backend from the project); product owner (raw pulse retention) |
| 0060 | [Configuration with @nestjs/config, one Zod environment schema and secret files](0060-configuration-with-nestjs-config-one-zod-environment-schema-and-secret-files.md) | accepted | 1 | |
| 0061 | [Presentation settings for dates, clocks and numbers with one pinned locale](0061-presentation-settings-for-dates-clocks-and-numbers-with-one-pinned-locale.md) | accepted | 1 | |
| 0062 | [Web form contracts, URL view state and module link manifests](0062-web-form-contracts-url-view-state-and-module-link-manifests.md) | accepted | 1 | |
| 0063 | [Agent skills from library authors, pinned in the repository](0063-agent-skills-from-library-authors-pinned-in-the-repository.md) | accepted | 1 | |
| 0064 | [REST routes under /api/v1 and OpenAPI from Zod contracts](0064-rest-routes-under-api-v1-and-openapi-from-zod-contracts.md) | accepted | 1 | |
| 0065 | [CodeRabbit check run and a required approval on main](0065-coderabbit-check-run-and-a-required-approval-on-main.md) | proposed | 1 | |
| 0066 | [Companies created by the CLI, plant slugs unique per installation, company settings at /settings and an onboarding wizard before a plant opens](0066-companies-created-by-the-cli-plant-slugs-unique-per-installation-company-settings-at-settings-and-an-onboarding-wizard-before-a-plant-opens.md) | proposed | 1 | |
| 0067 | [Plant switcher across companies, nav icons by lucide name and a top bar slot](0067-plant-switcher-across-companies-nav-icons-by-lucide-name-and-a-top-bar-slot.md) | proposed | 1 | maintainer (the top bar slot id; top bar items drawn from data) |
| 0068 | [Extension points declared by their owners, contributions as manifest data with code by id, and a plugin inventory](0068-extension-points-declared-by-their-owners-contributions-as-manifest-data-with-code-by-id-and-a-plugin-inventory.md) | proposed | 1 | maintainer (the ledger rows of the nine release 1 pieces; the AI budget banner as the first banner contribution; top bar items drawn from data; roles only for plugin permissions; plant-free fields for the notifications module; the command.rejected security event and the validator record at the first regulated sale; acceptance before the skeleton's validator story) |
| 0069 | [Require each CI job as a status check on main](0069-require-each-ci-job-as-a-status-check-on-main.md) | accepted | 1 | |
| 0070 | [One NestJS backend with one GraphQL schema and one static web app](0070-one-nestjs-backend-with-one-graphql-schema-and-one-static-web-app.md) | proposed | 1 | maintainer (the cost limit that replaces Hive demandControl; the carrier for plant permissions, presentation values and the station mount); pilot IT (browser versions) |
| 0071 | [Jobs on BullMQ with Valkey and the Postgres outbox as the record](0071-jobs-on-bullmq-with-valkey-and-the-postgres-outbox-as-the-record.md) | proposed | 1 | maintainer (the decision outcome) |

Next free number: 0072. Only Krister Johansson sets a status to accepted.
