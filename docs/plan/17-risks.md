# Risks

This is the risk register for release 1 and the pilot. Each risk has an id (R-01 upward), a likelihood, an impact, the mitigations already decided, the early warning signals to watch, an owner and the ADRs that carry the mitigation. Many mitigations are tests or CI checks, and the register names them so a task can carry them. Krister reviews the register with the weekly velocity row in [README.md](README.md) and at every checkpoint in [14-roadmap.md](14-roadmap.md). When a signal fires, the owner records the date in the risk's entry and takes the listed response. Scope cuts follow the cut order in [01-product-and-scope.md](01-product-and-scope.md#the-cut-order-when-velocity-is-low).

## Scales and owners

| Field | Values |
|---|---|
| Likelihood | High: expected during release 1 unless the mitigation works, or already seen in a spike or upstream. Medium: plausible, or found by the internal stress test of the design. Low: unlikely once the mitigation is in place. |
| Impact | High: moves the pilot date by weeks or more, loses or leaks customer data, or stops the pilot. Medium: costs days, or degrades a feature the pilot uses. Low: costs hours. |
| Owner | Krister (maintainer and only developer), the product owner, pilot IT (the pilot customer's IT and its Pyramid administrator), or a lawyer. The owner watches the signals and acts on them. |

## Summary

| Id | Risk | Likelihood | Impact | Owner |
|---|---|---|---|---|
| [R-01](#r-01-release-1-takes-longer-than-the-forecast) | Release 1 takes longer than the forecast | High | High | Krister |
| [R-02](#r-02-federation-and-module-federation-churn) | Federation and Module Federation churn | High | Medium | Krister |
| [R-03](#r-03-the-pyramid-write-back-method-is-unknown-or-late) | The Pyramid write-back method is unknown or late | High | High | Krister, pilot IT, product owner |
| [R-04](#r-04-the-board-is-too-slow-on-planner-hardware) | The board is too slow on planner hardware | Medium | High | Krister, pilot IT, product owner |
| [R-05](#r-05-better-auth-churn-and-security-advisories) | Better Auth churn and security advisories | High | High | Krister |
| [R-06](#r-06-one-developer-and-gate-time) | One developer and gate time | High | High | Krister |
| [R-07](#r-07-ai-features-leak-customer-data) | AI features leak customer data | Medium | High | Krister |
| [R-08](#r-08-on-prem-operations-fail-at-the-pilot) | On-prem operations fail at the pilot | Medium | High | Krister, pilot IT |
| [R-09](#r-09-the-accessibility-target-is-missed) | The accessibility target is missed | Medium | Medium | Krister, product owner |
| [R-10](#r-10-license-problems) | License problems | Low | High | Krister, lawyer |
| [R-11](#r-11-product-owner-and-pilot-it-answers-arrive-late) | Product owner and pilot IT answers arrive late | High | Medium | Krister, product owner, pilot IT |
| [R-12](#r-12-plant-isolation-or-credential-gaps) | Plant isolation or credential gaps | Medium | High | Krister |
| [R-13](#r-13-customer-data-reaches-the-public-repository-or-support-channels) | Customer data reaches the public repository or support channels | Low | High | Krister |
| [R-14](#r-14-time-zone-and-daylight-saving-defects) | Time zone and daylight saving defects | Medium | Medium | Krister |

## Risk entries

### R-01 Release 1 takes longer than the forecast

Under option B the full release 1 scope stays and the pilot moves later ([ADR 0055](../adr/0055-release-1-scope-under-option-b-and-the-scope-rule.md)). The internal stress test of the design (internal research note 32) found that release 1 needs 2.3 to 4 times the original six-month window. It sized the ledger at 301 to 423 raw developer days, or 331 to 486 with 10 to 15 percent stabilization, against about 115 working days between 2026-10-15 and 2027-04-15 after sickness and administration. ADR 0055 adds or re-sizes items on top of that ledger: the shared building blocks and the unit catalog, draft storage and locks, the station slice, accessibility work and agent proposals. The stress test put the option B pilot window at 2027-08-24 to 2028-01-20 on its 2x line. The estimates already assume coding agents, so the forecast uses the 1x line, and on that line the window falls later.

| Likelihood | Impact | Owner | ADRs |
|---|---|---|---|
| High | High | Krister | [0055](../adr/0055-release-1-scope-under-option-b-and-the-scope-rule.md), [0049](../adr/0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md), [0058](../adr/0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md) |

Mitigations:

- [README.md](README.md) carries one weekly row: merged tasks, the ledger days they earn as shares of their epics' estimates, the cumulative total against the 1x line and, once handoff runs start, median gate minutes per task and merged tasks per day. Stories and tasks carry no size.
- At each checkpoint, the remaining ledger (each epic's estimate times the share of its tasks not yet merged) plus the stabilization reserve, divided by the measured rate of ledger days earned per working day, gives the earliest install date. The pilot test starts at least 4 weeks after the install. No forecast tooling is built.
- Checkpoints: M1 (2026-11-20) opens the weekly rows. M2 (2027-01-22) is velocity checkpoint 1, with at least eight weekly rows, and gives a provisional pilot window. M3 (2027-02-26) is checkpoint 2: it narrows the window and reviews the cut order, and from then on 10 percent of capacity is held as a stabilization reserve. At M4 (proposed for 2027-04-30) Krister fixes the install and pilot test dates from the three forecasts and applies cuts if the forecast misses.
- The walking skeleton is timeboxed. If it is not green on 2026-11-13, hardening freezes. If it is still red on 2026-11-27, the web remotes take the tested Rsbuild exit ([ADR 0058](../adr/0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md)).
- The plan orders the epics so that external waits start early. The board spike does not wait for the planning orders epic. The Pyramid parser, mapper, file mode and fake PWS server start inside M2. Compose on a pilot-like VM with a timed restore is done by 2027-02-26.
- The cut order in [01-product-and-scope.md](01-product-and-scope.md#the-cut-order-when-velocity-is-low) is fixed in advance, so a cut takes a decision and no new planning.

Early warning signals:

- The cumulative ledger days earned in the weekly row fall below the 1x line.
- The skeleton spec `e2e/skeleton.spec.ts` is still red on 2026-11-13.
- The M2 forecast puts the install after 2028-01-20, the end of the stress test's window.
- Tasks wait in Shaping because a linked ADR is still proposed or has an open needs-confirmation (see R-11).

Response: cuts 1 and 2 change no decided scope and can be taken at once. For cuts 3 to 7 Krister decides at the next checkpoint.

### R-02 Federation and Module Federation churn

Each module and plugin is its own GraphQL Federation subgraph, composed in one process by an embedded Hive Gateway, and each module ships its own web remote loaded at run time ([ADR 0015](../adr/0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md), [ADR 0019](../adr/0019-web-shell-with-react-module-federation-remotes.md)). The upstream packages move fast. Internal research note 19 counted 64 singleton issues in two months on `@module-federation/vite`, with most commits from one maintainer. Internal research note 18 counted 153 stable releases of `@graphql-hive/gateway-runtime` since October 2024, 58 of them in 2026. `@nestjs/graphql` 14 links Federation v2.14 by default while the composition library knows v2.0 to v2.9, and the in-process subgraph driver relies on an internal Nest option. The platform under release 1 is estimated at 35 to 51 developer days before planning features (internal research note 20).

| Likelihood | Impact | Owner | ADRs |
|---|---|---|---|
| High | Medium | Krister | [0015](../adr/0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md), [0019](../adr/0019-web-shell-with-react-module-federation-remotes.md), [0038](../adr/0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md), [0050](../adr/0050-github-organization-rulesets-ci-runners-and-supply-chain.md), [0058](../adr/0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md) |

Mitigations:

- `@nestjs/graphql`, `@apollo/subgraph`, `@theguild/federation-composition`, `@graphql-hive/gateway-runtime`, `@graphql-mesh/transport-common` and `graphql` 16 are pinned exactly and upgraded together, one pull request at a time. The federation link is pinned at v2.9. `@apollo/gateway` and `@graphql-yoga/nestjs-federation` are never installed.
- `@module-federation/vite` is pinned exactly through `defineRemoteConfig` in `@northmes/web-build`. Renovate applies a strict `minimumReleaseAge` to the Module Federation packages.
- Shared singletons use `import: false`, so the version negotiation code paths stay short. A shared web package adds no new federation share key.
- Composition runs at boot with the NorthMES rules, and a composition error exits the process. CI composes the in-repo modules, the example plugins and the plugin corpus.
- A committed N-1 build of the widget example loads in Playwright on every pull request that touches the singleton list or the federation packages.
- The spikes' tests stay as contract suites: the isolation boot check, the four host-provided boot tests, the resolve-hook test, and `runtime.test.ts`, which asserts that `module.registerHooks` is a function.
- The Rsbuild exit for the remotes is tested and stays inside the Module Federation decision.
- Stale browser tabs after an upgrade get a blocking reload dialog, and the client refuses mutations from an outdated build ([ADR 0018](../adr/0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md)).

Early warning signals:

- A Renovate pull request for one of the pinned packages fails a contract suite.
- `e2e/skeleton.spec.ts` or the N-1 widget test turns red.
- A composition error appears after an upgrade.
- An upstream issue reports a singleton or shared-module bug in the pinned version.

Response: hold the upgrade and keep the pin. If the skeleton is still red on 2026-11-27, take the Rsbuild exit.

### R-03 The Pyramid write-back method is unknown or late

Release 1 writes planned start, planned end, IsLocked, ProductionStatusId and Priority back to Pyramid per operation row ([ADR 0032](../adr/0032-pyramid-connector-polling-file-mode-and-shadow-write-back.md)). The method is not known yet. Open points include the WSDL, whether the write methods are a reseller customization and who maintains them, a test company endpoint, the firewall path from the NorthMES host, whether Pyramid stores written planned times verbatim, and how it treats an end before its start. Field ownership against the product owner's "NorthMES is master" answer is also open, and live write-back cannot be selected until it is answered ([ADR 0031](../adr/0031-erp-integration-connector-modules-field-ownership-and-pending-changes.md)). This is the largest external unknown in release 1.

| Likelihood | Impact | Owner | ADRs |
|---|---|---|---|
| High | High | Krister; pilot IT for the method and endpoint; the product owner for the fallback and double entry | [0031](../adr/0031-erp-integration-connector-modules-field-ownership-and-pending-changes.md), [0032](../adr/0032-pyramid-connector-polling-file-mode-and-shadow-write-back.md) |

Mitigations:

- Write-back runs in shadow mode until a write method is verified. Shadow sends write `shadow_payload` and `shadow_at`, never update the last sent value, and the planner gets a daily write-back report.
- The build order is file-mode import first, then shadow write-back whose body matches recorded request and response pairs, then the live transport. The first step needs neither the write method nor plant network access, and the second needs only recorded pairs.
- A written request goes to the pilot's Pyramid administrator and the Pyramid reseller on day 1 (2026-10-15), with dates: method names by 2026-11-13, a test endpoint or recorded pairs by 2026-12-18, live write-back verified by 2027-01-22 as the target.
- If no write path exists by 2027-02-26, the product owner picks one of three: a file export that Pyramid imports, a third-party REST bridge, or a pilot without ERP write-back.
- Going live is an audited settings command. It enqueues a one-time reconcile of all open orders and shows the admin the count and a sample before anything is sent.
- Echo detection compares exact wire strings. In shadow mode every polled planned time that differs from the last sent text is logged, so the pilot shows whether Pyramid echoes values unchanged.
- Tests use a fake PWS server and synthetic fixtures. `write-back.contract.test.ts` compares canonicalized XML with the synthetic fixture. An opt-in live test runs only against the test company with `NORTHMES_PYRAMID_LIVE=1`, never on pull requests.
- Cut 4 in the cut order runs the pilot in shadow mode if the product owner accepts double entry for a set period.

Early warning signals:

- Method names have not arrived by 2026-11-13.
- No test endpoint and no recorded pairs by 2026-12-18.
- Live write-back is not verified by 2027-01-22.
- Shadow logs show Pyramid normalizing written values or rejecting an end before its start.
- Field ownership is still unanswered at M0 (2026-10-30).

Response: at 2027-02-26 without a write path, the product owner chooses the fallback. The pilot acceptance criterion PA-4 then uses the daily write-back report.

### R-04 The board is too slow on planner hardware

The planning board is built in house: a headless TypeScript core, DOM rendering, TanStack Virtual for rows and custom pointer events ([ADR 0030](../adr/0030-a-planning-board-built-in-house.md)). Every spike number so far comes from an Apple M4, not from the Windows PCs planners use. The product owner has not yet given the weekly job order volume that sets the spike size.

| Likelihood | Impact | Owner | ADRs |
|---|---|---|---|
| Medium | High | Krister; pilot IT for the planner PC model and browser; the product owner for weekly volumes | [0030](../adr/0030-a-planning-board-built-in-house.md), [0018](../adr/0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md), [0028](../adr/0028-autoplan-as-a-pure-deterministic-function.md) |

Mitigations:

- Spike SP3 measures max(2 x weekly job orders x 8 weeks, 5 000) blocks on 60 rows, fed through Apollo from a mocked schema or a stub resolver, on a PC of the pilot's planner class. It also runs once with the Temporal polyfill forced in Chromium. It passes at 60 fps while scrolling at day zoom, a p95 frame time of at most 33 ms while dragging at week zoom, no long task over 50 ms, and a keyboard move mode that steps one snap and one machine.
- The verdict is due on 2026-11-06. On a fail, one more week limits the rendered range: day zoom up to 2 weeks, week zoom aggregated per shift. On a second fail by 2026-11-20, planning runs on the job order table view with the shared Move dialog plus a read-only timeline.
- Realtime volume is bounded. One `planning.plan.revised` event per apply carries at most 200 changed job order ids, or null to mean "refetch the range". The client debounces for 250 ms and refetches only when the changed ids intersect its loaded range. The board range resolver limits days and rows.
- Autoplan has a budget at pilot scale (40 machines, 500 orders, about 1 600 job orders, 8 weeks, 4 vCPU): `plan()` at most 1 s, and request to board refetch at most 5 s at p95.
- `e2e/board-perf.spec.ts` samples frame times nightly on a fixed runner as a regression check. The verdict itself comes from planner hardware.
- System health shows event-loop delay p99 and heap used.

Early warning signals:

- SP3 fails on 2026-11-06.
- The product owner's weekly volumes give a block count above the spike size.
- The nightly board performance spec regresses.
- The forced-polyfill run is clearly slower than the native run.
- Event-loop delay p99 rises on System health during autoplan.

Response: follow the spike exit above. The fallback is item 8 of the cut order.

### R-05 Better Auth churn and security advisories

NorthMES uses Better Auth for identity and sessions ([ADR 0010](../adr/0010-identity-with-better-auth-roles-and-permissions-in-core-tables.md)). Internal research note 01 counted 80 stable Better Auth releases in the twelve months to 2026-10-04 and 32 published security advisories in the same period: 3 critical, 20 high, 6 medium and 3 low. Most sat in plugins NorthMES does not enable (single sign-on, the OAuth and OIDC provider including MCP, SCIM, the OAuth proxy, magic links). Minor versions break things: 1.7.0 removed `oidcProvider`, moved MCP into its own package, renamed a table and changed the API key adapter contract. In 1.7.7 the `BETTER_AUTH_TELEMETRY` environment variable turns telemetry on even when the option says off. On-prem customers depend on NorthMES to ship each fix.

| Likelihood | Impact | Owner | ADRs |
|---|---|---|---|
| High | High | Krister | [0010](../adr/0010-identity-with-better-auth-roles-and-permissions-in-core-tables.md), [0011](../adr/0011-principals-credentials-and-same-origin-rules.md), [0034](../adr/0034-mcp-surface-one-endpoint-a-read-mostly-planning-toolset.md), [0038](../adr/0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md) |

Mitigations:

- `better-auth` 1.7.x is pinned exactly. Each upgrade is a planned migration: read the release notes, regenerate Better Auth's SQL into core migrations, and pass the Testcontainers drift test.
- The plugin set is minimal: username, organization, admin (server-side `auth.api` calls only) and api-key. Every `/admin/*` HTTP path is disabled. Dynamic access control and teams are off. Any other plugin is reviewed against its advisory history before it is enabled.
- Roles, role assignments and permissions live in NorthMES core tables, so a Better Auth change cannot widen a permission.
- Boot refuses `BETTER_AUTH_TELEMETRY`, asserts that `enableSessionForAPIKeys` is false and that `disabledPaths` holds the api-key client endpoints and `/token`. The `testUtils` entry point stays out of the production image.
- MCP sign-in starts with personal access tokens. The Better Auth MCP and OAuth provider plugins, which had the most advisories, wait.
- A patch release class is image-only with no migrations, with a 72-hour target from fix to customer bundle ([ADR 0038](../adr/0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md)). `SECURITY.md` states that only the latest minor gets fixes before 1.0.
- Renovate proposes upgrades and Dependabot alerts report advisories.

Early warning signals:

- A new advisory affects `better-auth` core or an enabled plugin.
- A Renovate pull request proposes a Better Auth minor version.
- The drift test or a boot assertion fails after an upgrade.

Response: ship an image-only patch release for an advisory that affects an enabled plugin. Plan a minor upgrade as its own task.

### R-06 One developer and gate time

One developer builds NorthMES with coding agents ([ADR 0049](../adr/0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md)). On the guided graph every task passes Krister at the plan gate, the code gate, Try it, thread resolution and the merge request, and on every graph Krister answers each question, permission request, failed run and merge decision the operating session brings to them. At 180 to 240 tasks and 15 to 25 minutes per task, the gates alone take 6 to 12 days. The internal stress test found that the share of work agents do not speed up (board feel, screen-reader passes, Pyramid access, design approval, gates and the pilot itself) came to 172 to 243 days on its own. handoff runs and interactive sessions share the same Claude subscription limits. When Krister is away, work stops.

| Likelihood | Impact | Owner | ADRs |
|---|---|---|---|
| High | High | Krister | [0049](../adr/0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md), [0058](../adr/0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md), [0022](../adr/0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md) |

Mitigations:

- Gate minutes per task and merged tasks per day go into the weekly row from the first handoff runs. Gates are batched twice a day.
- The project climbs from `northmes-guided` to `northmes-standard` (plan gate only) and `northmes-lean` (no human gates) when the measurable switch criteria in [docs/agents/handoff/README.md](../agents/handoff/README.md#switching-graphs) hold. The operating session picks the graph per run, so foundation-sensitive tasks stay guided after a switch.
- Tasks are thin vertical slices inside the plan budget of 15 files and 12 steps, with a body under about 3 500 characters and 3 to 8 acceptance criteria.
- handoff's Tester runs `pnpm check`, and every CI gate step runs a script that `pnpm check` or `pnpm check:full` contains.
- Each extension point ships with a recipe, so a coding agent needs fewer questions.
- The plan and the ADRs are self-contained and public, so another developer or agent can continue from the repository alone.
- handoff's scheduler is not used. Runs start by hand from the operating session: one active run at first, two after two runs finish without a collision on owned paths ([ADR 0049](../adr/0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md)). Merges are manual at first.
- The 10 percent stabilization reserve from M3 and the cut order absorb lost weeks (see R-01).

Early warning signals:

- Median gate minutes per task go above 25, the top of the estimate.
- Merged tasks per day fall across consecutive weekly rows.
- Tasks sit in review waiting for Krister while no run is active.
- Subscription limits stop runs.

Response: batch gates further, and move routine tasks to the standard or lean graph once the switch criteria hold. If the rate still falls, apply the cut order (R-01).

### R-07 AI features leak customer data

AI features send plan data to a model provider that the customer configures with its own credentials ([ADR 0035](../adr/0035-ai-provider-port-with-customer-configured-providers.md)). Internal research note 23 and the stress test found leak paths in library defaults. The AI SDK's `ai:telemetry` diagnostics channel received prompts with no integration registered, and the default `onError` wrote the whole prompt to stderr. Other paths: a string model id silently routed through a hosted gateway, credential and base-URL fallbacks from environment variables, `store: true` on hosted response storage, redirects to other hosts, image URLs in rendered Markdown, and prompt injection through ERP free text such as CustomData. The default provider, OpenRouter, sends requests through a US intermediary before the model provider. AI SDK majors arrive about every six months.

| Likelihood | Impact | Owner | ADRs |
|---|---|---|---|
| Medium | High | Krister; the customer's admin chooses the provider and its terms | [0035](../adr/0035-ai-provider-port-with-customer-configured-providers.md), [0036](../adr/0036-agent-proposals-as-planning-records-a-person-commits.md), [0034](../adr/0034-mcp-surface-one-endpoint-a-read-mostly-planning-toolset.md), [0047](../adr/0047-secrets-and-the-installation-key.md), [0042](../adr/0042-ai-in-tests-mocked-by-default-opt-in-live-runs.md) |

Mitigations:

- `modules/ai/server/model-call.ts` is the only caller of `streamText`, `generateText` and `embed`. A lint rule forbids importing them anywhere else. Every call passes `telemetry: { isEnabled: false }` and an `onError` that logs only provider kind, status code, error code, `isRetryable` and the correlation id. A pino serializer drops request and response bodies from AI SDK errors.
- A default-provider guard, set when `model-call.ts` loads and in the Vitest setup files, refuses string model ids, a hosted gateway default, and credential or base-URL fallbacks from the environment.
- The egress fetch compares scheme, host and port with the configured base URL and sets `redirect: 'error'`. `experimental_download` throws. Responses storage is off (`store: false`).
- Stored secrets are bound to the endpoint host. Changing an AI base URL without re-entering the secret fails with `core.secret_reentry_required`, so Test connection never sends a stored key to a new host. Private and link-local targets need an entry in the installation setting `outbound.allowedHosts`, set with `northmes installation set` on the host. 169.254.0.0/16 and the database host are always blocked.
- OpenRouter requests default to `provider: { data_collection: 'deny', zdr: true }`, and only the customer can loosen that.
- `ai.ai_call` rows hold token counts, cost and tool names, never prompt or completion text. Chat history stays in the browser for the session.
- Tool results to the model are capped at 50 rows and 20 000 characters. The personal-field redactor runs on every tool output. ERP text is wrapped as `{ untrusted: true, text }` and capped at 500 characters per value.
- The chat renderer prints links as plain text with the full URL. The page CSP keeps `img-src` and `connect-src` to the same origin.
- AI writes only proposals, and a person commits them. Each AI feature is off until a company admin enables it, and `/mcp` is off by default per installation.
- Tests mock the provider. The opt-in live suite has an injection fixture: an order whose CustomData holds an instruction, which must not lead to a propose call.
- The license gate scans installed packages for `ee/` folders and "Enterprise" license files, which the SPDX field misses ([ADR 0040](../adr/0040-dependency-license-policy-ci-gate-and-sbom.md)).

Early warning signals:

- The lint rule fails on a direct import of `streamText`, `generateText`, `embed` or `registerTelemetry`.
- A test finds prompt text in a log line or an error object.
- An egress test sees a request to a host other than the configured base URL.
- The live injection fixture produces a propose call.
- A new AI SDK major changes a default that a guard relies on.

Response: block the release until the leak path has a guard and a test. Ship an image-only patch if an installed version is affected.

### R-08 On-prem operations fail at the pilot

The pilot runs on one Linux host operated by the customer's IT, possibly without internet access ([ADR 0044](../adr/0044-on-prem-deployment-with-docker-compose-and-mandatory-tls.md)). The host is the single point of failure. In the internal stress test, the pilot go-live scenario produced the most design changes, among them one of the two blockers: restore drills on the pilot host wrote into the production WAL archive. The database image, the superuser bootstrap, the disk layout, the offline escrow and host alerts were undefined at that point. They are now decided in ADRs 0005, 0045, 0046 and 0047, but none has run on a pilot-like machine yet.

| Likelihood | Impact | Owner | ADRs |
|---|---|---|---|
| Medium | High | Krister with pilot IT | [0005](../adr/0005-postgres-18-official-image-with-pgbackrest-timescaledb-deferred.md), [0043](../adr/0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md), [0044](../adr/0044-on-prem-deployment-with-docker-compose-and-mandatory-tls.md), [0045](../adr/0045-backups-restore-drills-upgrades-and-rollback.md), [0046](../adr/0046-observability-structured-logs-host-checks-and-optional-opentelemetry.md), [0047](../adr/0047-secrets-and-the-installation-key.md), [0050](../adr/0050-github-organization-rulesets-ci-runners-and-supply-chain.md) |

Mitigations:

- pgBackRest archives WAL to a local repository on the backup disk and an encrypted offsite repository. The proposed targets are an RPO of 1 minute and an RTO of 2 hours. A nightly `pg_dump` keeps a second copy.
- The database image needs pgBackRest 2.59.3 or later, and PGDG carried 2.59.2 at most on 2026-10-05. The Dockerfile pins the newest PGDG package that passes the image test; until PGDG publishes 2.59.3, the image builds 2.59.3 from the upstream release tag, and a tracking issue moves it back to the PGDG package ([ADR 0005](../adr/0005-postgres-18-official-image-with-pgbackrest-timescaledb-deferred.md)).
- Restore drills never write into the production archive and never talk to integrations. They run with archive mode off, a read-only repository mount, an internal network without egress, integration crons skipped and Pyramid shadow mode forced.
- Each quarter, a restore from the offsite repository alone, using only the escrowed material, records the measured RTO.
- `upgrade.sh` runs `migrate --check` before any downtime, stops the app, takes an incremental backup and records its label. `rollback.sh` restores that exact backup. A schema compatibility number lets the previous image run against a database the new image migrated.
- The offline image bundle is built for amd64 and verified through GitHub artifact attestations. A release CI job loads it with `--network none` and checks `/health/ready`.
- `hostcheck` runs every 5 minutes and reports disk space, backup state, the last drill, NTP sync, certificate expiry and image digests. Before go-live, either the customer's monitoring polls `/health/ready` or hostcheck mails state changes through the customer's SMTP relay.
- Nightly ops tests cover install, the restore drill, a WAL archive outage, and an upgrade from N-1 to N with a failing migration and a rollback.
- Compose on a pilot-like VM with pgBackRest and a timed restore is done by 2027-02-26. An upgrade rehearsal from N to N+1 with a rollback runs before the pilot install.
- Upgrades run between shifts, with paper reporting meanwhile. Nobody installs or upgrades in the week of a daylight saving change.

Early warning signals:

- A nightly ops test fails.
- The pilot-like VM is not running by 2027-02-26.
- The timed restore exceeds the proposed RTO.
- Pilot IT has not answered the disk layout, offsite target, TLS option, bind address, escrow location, or monitoring tool or SMTP relay questions when the install date is set at M4.
- `/health/ready` lists degraded items: a backup older than 26 hours, a PITR gap, audit partitions less than 3 months ahead, a certificate expiring within 30 days, or clock skew.
- PGDG still lacks pgBackRest 2.59.3 when the database image task starts.

Response: no pilot install until the go-live checklist in [01-product-and-scope.md](01-product-and-scope.md#what-done-means-for-release-1) is complete.

### R-09 The accessibility target is missed

The web app targets WCAG 2.2 AA plus EN 301 549 clauses 9.7 and 12.3 ([ADR 0021](../adr/0021-accessibility-target-wcag-2-2-aa.md)). The board is the hard part: moving without dragging (2.5.7), full keyboard operation (2.1.1), the soft-lock expiry as a time limit (2.2.1), contrast with user-picked order colors (1.4.3 and 1.4.11) and target size (2.5.8). The streaming chat panel adds its own live-region problems. Internal research note 21 estimated about 25 developer days, and the stress test added about 5 to 7 days offset by about 2 days of cuts. Screen-reader passes need a Windows PC of the planner class running NVDA.

| Likelihood | Impact | Owner | ADRs |
|---|---|---|---|
| Medium | Medium | Krister; the product owner decides whether "Pause live updates" is wanted | [0021](../adr/0021-accessibility-target-wcag-2-2-aa.md), [0020](../adr/0020-frontend-libraries-tanstack-router-apollo-client-4-shadcn-ui-and-forms.md), [0030](../adr/0030-a-planning-board-built-in-house.md), [0049](../adr/0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md) |

Mitigations:

- A token contrast test runs before the first component. Block text is black or white per fill through `textColorFor`, every block has a foreground-colored border, and no state maps to a hue alone.
- Moving without dragging ships in the same increment as dragging, through the detail panel and the block menu's Move dialog. The board is an ARIA grid with roving tabindex and a keyboard move mode.
- The board warns before a soft lock expires and offers a one-action extension.
- Gates: the Biome accessibility lint; component tests with axe in a Vitest browser-mode project; axe in Playwright per route and state with the tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa`; keyboard-only flows; a per-remote harness that fails on a leaf route without a title; and a required `ci / a11y` job over the board states from the first board pull request.
- Designs are approved per task with keyboard and focus frames, the listed widths including a 320 px reflow, light and dark themes, and build notes naming the WCAG criteria.
- One NVDA pass runs on the board core and a second before the pilot install. A planner-class PC is requested in week 1.

Early warning signals:

- `ci / a11y` or the axe route suite fails.
- An NVDA pass finds a blocking issue.
- A design reaches approval without keyboard or focus frames.
- Accessibility tasks get pushed behind feature tasks under schedule pressure.
- The planner-class PC is not in hand by the board spike.

Response: an accessibility failure blocks the merge like any other test. The NVDA findings become tasks before the next board increment.

### R-10 License problems

Core is licensed AGPL-3.0-or-later, and contributions come under a contributor license agreement ([ADR 0039](../adr/0039-license-agpl-3-0-or-later-core-and-a-contributor-license-agreement.md)). The SDK and contracts packages are proposed as MIT with an extension exception for plugins ([ADR 0056](../adr/0056-mit-sdk-packages-the-extension-exception-and-the-trademark-policy.md)). The risks are a dependency whose license conflicts with that model, an MIT package that imports AGPL code, a contribution without a signed CLA, and a package that ships source-available code while its SPDX field says otherwise. ADRs 0039, 0040 and 0056 each record what still needs legal review.

| Likelihood | Impact | Owner | ADRs |
|---|---|---|---|
| Low | High | Krister; a lawyer for the reviews the ADRs list | [0039](../adr/0039-license-agpl-3-0-or-later-core-and-a-contributor-license-agreement.md), [0040](../adr/0040-dependency-license-policy-ci-gate-and-sbom.md), [0056](../adr/0056-mit-sdk-packages-the-extension-exception-and-the-trademark-policy.md) |

Mitigations:

- `LICENSE`, `NOTICE` and SPDX headers ship from the first commit, and every workspace package sets its `license` field.
- A license gate per package runs from the first commit. It denies third-party GPL-3.0, AGPL and LGPL in core pending the legal view, and it also scans installed packages for `ee/` folders and "Enterprise" license files.
- An SBOM is produced per package and per image.
- A CI check fails when an MIT package imports an AGPL one. Plugins import only MIT packages.
- A never-install list keeps known problem packages out: `@apollo/gateway`, `@graphql-yoga/nestjs-federation`, exceljs, npm `xlsx`, `@sentry/node` in the server, and Mastra. Commercial board libraries are excluded from core.
- Socket checks new dependencies on pull requests.
- A self-hosted CLA check runs before the first outside pull request.
- An About page shows the version, the license and a source link for that exact version.

Early warning signals:

- The license gate fails.
- Socket flags a new dependency.
- A Renovate pull request changes a dependency's license field.
- An outside pull request arrives before the CLA check exists.
- A plugin needs an import from an AGPL package.

Response: the failing dependency does not merge. A replacement, or a legal review, becomes its own task.

### R-11 Product owner and pilot IT answers arrive late

Many ADRs carry needs-confirmation items for the product owner or pilot IT. Examples: the duration divisor, shift and break times, the production day start, field ownership, the lock level, whether operators report in NorthMES or Pyramid, the planner PC, station networks, TLS and the disk layout. A task moves to Ready only when every linked ADR is accepted with no open needs-confirmation ([ADR 0001](../adr/0001-record-architecture-decisions-in-madr.md)), so a late answer blocks work directly.

| Likelihood | Impact | Owner | ADRs |
|---|---|---|---|
| High | Medium | Krister; the product owner; pilot IT | [0001](../adr/0001-record-architecture-decisions-in-madr.md), [0027](../adr/0027-planned-duration-formula-and-override-precedence.md), [0055](../adr/0055-release-1-scope-under-option-b-and-the-scope-rule.md) |

Mitigations:

- The product owner session takes place in week 1. Written requests go to pilot IT and the Pyramid administrator on day 1.
- Any product owner answer still missing on 2026-10-30 becomes a plant or connector setting whose default an ADR records, for example the duration divisor, the lead time basis and the deadline time of day ([ADR 0027](../adr/0027-planned-duration-formula-and-override-precedence.md)).
- [16-open-questions.md](16-open-questions.md) lists every question with its owner and the working default that applies until the answer arrives.

Early warning signals:

- Questions are still open at M0 (2026-10-30).
- Tasks stay in Shaping because of an open needs-confirmation.
- Whether operators report in NorthMES or Pyramid is unanswered on 2026-10-30. That answer decides whether the station stays in release 1.

Response: turn the open question into a setting with an ADR default and move on. Answers that need code, not a setting, go to the next checkpoint.

### R-12 Plant isolation or credential gaps

The internal stress test found design gaps that would have let one plant's data or one credential reach places it should not. A row-level security policy written `FOR ALL` was OR-ed into SELECT and leaked rows across plants on Postgres 18.4. Cookie-authenticated routes accepted cross-origin requests, and the WebSocket upgrade had no Origin check. Better Auth's admin endpoints were reachable. The app container held the database owner password. The decided design closes each one, and the risk is a regression in code that is not written yet.

| Likelihood | Impact | Owner | ADRs |
|---|---|---|---|
| Medium | High | Krister | [0008](../adr/0008-row-level-security-with-transaction-local-scopes.md), [0010](../adr/0010-identity-with-better-auth-roles-and-permissions-in-core-tables.md), [0011](../adr/0011-principals-credentials-and-same-origin-rules.md), [0047](../adr/0047-secrets-and-the-installation-key.md) |

Mitigations:

- The migration template generates `FOR SELECT` on `read_scopes` and separate INSERT, UPDATE and DELETE policies on `write_scopes`. The catalog lint fails on any policy with `cmd = 'ALL'` in module and plugin schemas, and on any table without row-level security and at least one policy.
- Row-level security on a partitioned parent does not carry over to its partitions, and a query that names a partition applies only that partition's own policies. Every partition, the audit partitions included, gets row-level security and its parent's policies and no grants to `nm_app`, and the catalog lint checks partitions ([ADR 0008](../adr/0008-row-level-security-with-transaction-local-scopes.md)).
- A lint bans `sql.raw`, `sql.lit`, and `sql.ref` or `sql.id` with non-literal input.
- A global middleware and the WebSocket upgrade listener reject unsafe requests from a foreign origin and write a security event. The WebSocket principal comes only from the handshake cookie.
- Credentials are bound to surfaces. The GraphQL guard rejects MCP tokens, so an agent that holds an MCP token cannot call the commit mutation.
- Every Better Auth `/admin/*` path is disabled. User management runs as NorthMES commands.
- Each Compose service gets only its own secrets. A contract test parses `docker compose config` and a nightly job asserts that the app container has no database owner password.
- A test lists every REST route and fails on one that neither uses the shared principal resolver nor is marked `@Public`. Boot exits when a resolver field has neither permission nor `@Public` metadata.

Early warning signals:

- The catalog lint, the route list test or the boot permission check fails.
- Security events show requests from a foreign origin, or a station key used from a new source IP.

Response: a failure in any of these checks blocks the merge. A finding on an installed version gets an image-only patch release.

### R-13 Customer data reaches the public repository or support channels

The repository is public, and handoff run agents read only tracked files. Pilot export files and recorded Pyramid requests and responses are customer data. Demo screenshots from handoff runs land on a public branch.

| Likelihood | Impact | Owner | ADRs |
|---|---|---|---|
| Low | High | Krister | [0001](../adr/0001-record-architecture-decisions-in-madr.md), [0032](../adr/0032-pyramid-connector-polling-file-mode-and-shadow-write-back.md), [0046](../adr/0046-observability-structured-logs-host-checks-and-optional-opentelemetry.md) |

Mitigations:

- Files the product owner or the customer share, recorded Pyramid pairs included, are never committed to any repository, the private companion repository included. Tests use synthetic fixtures and a fake PWS server.
- A data processing agreement with the pilot customer is in place before the first real file or recorded pair reaches development.
- A repository lint fails on the organisation number pattern `\d{6}-\d{4}` in any tracked file, and on a deny-list of real customer names under `fixtures/` and `docs/sources/`, read as hashes from a CI secret.
- The demo seed for handoff runs uses fictional data only.
- Support receives logs only, with secret headers redacted. No database dump leaves the site, and every support ticket has a deletion date.
- The connector imports only customer number and name, never organisation numbers, addresses or phone numbers.

Early warning signals:

- The repository lint hits.
- A fixture or screenshot shows names that are not from the fictional seed.

Response: remove the data and the commit that added it, then add the name or pattern to the deny-list.

### R-14 Time zone and daylight saving defects

Facts are UTC instants, while shifts, breaks, deviations and ERP times are plant wall-clock values ([ADR 0024](../adr/0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md)). Pyramid sends and receives local time strings. The spring night has a gap and the autumn night repeats an hour. A defect here shifts planned times silently.

| Likelihood | Impact | Owner | ADRs |
|---|---|---|---|
| Medium | Medium | Krister | [0024](../adr/0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md), [0025](../adr/0025-plant-calendars-shift-patterns-and-the-production-day.md), [0032](../adr/0032-pyramid-connector-polling-file-mode-and-shadow-write-back.md), [0041](../adr/0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md) |

Mitigations:

- One resolver, `resolveWallClock`, applies the clamp rule in TypeScript only. A time in the spring gap resolves to the first instant after the gap, and a repeated autumn time resolves to its first occurrence. SQL never converts local time to instants.
- Boot throws unless `resolveWallClock('Europe/Stockholm', 2027-03-28, 02:30)` gives 01:00Z.
- A Kysely plugin throws on `Date` parameters, and `pnpm db:types --verify` fails on any generated `Date` type. Every database role pins its session zone to UTC.
- The time zone matrix runs Node and Postgres under UTC and Europe/Stockholm, plus a hostile leg under Pacific/Chatham. Native-Temporal and forced-polyfill projects run in Vitest, and a Chromium Playwright project deletes `globalThis.Temporal`. Daylight saving and Helsinki fixtures exist from the first calendar test.
- A lint fails on `Intl.DateTimeFormat`, `Intl.NumberFormat`, `Intl.DurationFormat` and `toLocale*String` calls outside `packages/contracts/src/format/` ([ADR 0061](../adr/0061-presentation-settings-for-dates-clocks-and-numbers-with-one-pinned-locale.md)). The production day start is validated against the zone's transitions for 10 years.
- Nobody installs or upgrades in a daylight saving week (2027-10-31 and 2028-03-26). If the pilot window covers the night of 2027-10-31, that night runs on the installed system with the daylight saving suites green.

Early warning signals:

- A time zone leg fails.
- System health shows different tzdata versions for Node and Postgres.
- Shadow logs show Pyramid planned times that differ around a daylight saving night.

Response: a failing leg blocks the merge. A defect found on the pilot gets a fixture with that exact night before the fix.
