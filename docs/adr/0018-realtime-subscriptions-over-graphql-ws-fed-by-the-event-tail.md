---
status: "accepted"
date: 2026-10-05
decision-makers: Krister Johansson
consulted: internal research notes 02, 03, 05, 07, 15, 18, 19, 20, 21, 32
informed: NorthMES contributors
release: "1"
needs-confirmation: ""
---

# Realtime subscriptions over graphql-ws fed by the event tail

## Context and problem statement

Krister Johansson decided that screens show live status through GraphQL subscriptions. In release 1 that means the planning board (other planners' moves, soft locks, plan revisions, calendar changes, autoplan status), the operator station's job list and the shell's own connection state. Commands write their events to `core.event` in the command transaction, and a single sequencer assigns commit-ordered positions ([ADR 0014][adr-0014]). The gateway runs embedded in the Nest process ([ADR 0015][adr-0015]).

The stress test found five ways a naive design fails: the graphql-ws client's defaults give up after about 31 to 46 s, shorter than any upgrade; `connectionParams` are read only when a socket opens, so a plant switch inside one tab keeps the old plant; a filter on plant membership alone sent plant B's board events to a user who is a viewer at A and an operator at B; a tab opened before an upgrade keeps sending mutations under the old semantics; and one autoplan apply can change hundreds of rows at once. This ADR decides the transport, the server feed, authorization, payloads and the client behaviour. It covers the gateway module, the event tail, subscription resolvers in every module and `createNorthmesClient` in `@northmes/web-sdk`.

## Decision drivers

* The decided requirement: GraphQL subscriptions for live status.
* One process per replica and no broker in release 1; Postgres `NOTIFY` has an 8 000 byte payload limit and a global lock at commit.
* Authorization per plant at subscription start and per event, including company-scope events.
* Screens must recover by themselves after a restart or upgrade, and show that they are not live meanwhile.
* A tab running an older build must not write under a newer server.
* Board volume: one apply must not flood clients or trigger one refetch per row.

## Considered options

* Client polling on a timer, without subscriptions.
* Subscriptions whose payloads carry whole entities, fed by one `NOTIFY` per business transaction or a third-party Postgres pub/sub library.
* Subscriptions over graphql-ws with SSE on the same endpoint, ids-only payloads, fed by an event tail on `core.event`, with refetch on the client.
* Subscriptions fed by an external broker such as Valkey.

## Decision outcome

Chosen option: "Subscriptions over graphql-ws with ids-only payloads, fed by an event tail on `core.event`", because it meets the requirement with no broker, loses nothing while a process is up, and keeps authorization and refetch rules in one place.

Transport and feed:

* Subscriptions are prefixed root fields, for example `planningBoardChanged(plantId: ID!)`. graphql-ws runs on `/graphql`; SSE on the same endpoint serves a site that blocks WebSockets through a fetch-based client that can send `x-northmes-csrf`.
* Every `api` process tails `core.event` with one direct `LISTEN` connection plus a polling fallback, and hands events to an in-process `PubSub`. Only the sequencer sends `NOTIFY`, once per batch, with a position as payload. No third-party Postgres pub/sub library is used. A process starts at the current maximum position; after a listener reconnect the fallback read catches up.
* With several replicas each runs its own gateway and tail; a browser's socket stays on one replica.

Authorization:

* The WebSocket principal comes only from the handshake cookie, never from `connectionParams`. graphql-ws `onConnect` closes with 4401 without a session and 4403 on lost plant membership ([ADR 0011][adr-0011]).
* Each subscription resolves its principal and scopes from its `plantId` argument and checks membership and permission at start; `connectionParams.plantId` is not used.
* Each event passes only when `event.scope_id` is in the subscriber's read scopes (the company or the plant) and `can()` allows the subscription's permission through the permission cache. A filter on the plant alone would drop company-scope events such as article renames.
* DataLoaders are built per event, not per subscription, so a renamed article reaches the next payload.

Payloads and volume:

* Payloads carry ids and changed fields, never whole screens. The board subscription carries changed ids, and the client refetches the visible range.
* One `planning.plan.revised` event per apply carries `plantId`, `revision`, `runId` and `changedJobOrderIds` capped at 200; null means "refetch the range".
* The tail groups the events of one read per plant into one ids-only message. The client debounces 250 ms, ignores revisions it already has, and refetches only when the changed ids intersect its loaded range, by ids when there are few. The board range resolver limits days and rows (`planning.board.range_too_large`). System health shows event-loop delay p99 and heap used. The thresholds are set from the board spike's measured volumes ([ADR 0030][adr-0030]).

Client:

`createNorthmesClient({ plantId })` returns one Apollo client per plant, with the plant in its HTTP link and its own graphql-ws client. The `$plant` route renders the provider for its plant; a plant switch stops and disposes the old client and its cache ([ADR 0019][adr-0019]).

| graphql-ws option | Value |
|---|---|
| `retryAttempts` | `Infinity` |
| `retryWait` | backoff capped at 10 s, with jitter |
| `shouldRetry` | false for close codes 4400, 4401 and 4403 |
| `keepAlive` | 10 000 ms; a pong timeout closes with 4499 after 5 s |
| after a reconnect | refetch every active query; compare `/api/web/modules` versions and integrity with the boot values |

While the client reconnects, the shell shows "Live updates paused, reconnecting" in the top bar through its polite live region, the board's Pause control shares that state, and board moves are disabled. Close code 4401 routes to sign-in and 4403 shows an access message. Because unauthenticated connections end inside the protocol, the unlimited retry cannot loop on an expired session.

Stale tabs after an upgrade:

* The gateway adds `x-northmes-build: <version>+<supergraphHash>` to every `/graphql` response and to the graphql-ws `connection_ack` payload.
* `createNorthmesClient` sends `x-northmes-client-build` and compares the server value with its boot value. The gateway rejects a mutation whose client build differs with `core.client_outdated`; queries pass, and so do clients that send no header (API keys, MCP).
* A blocking reload dialog opens on a build mismatch, on `GRAPHQL_VALIDATION_FAILED`, on a failed dynamic import, and on a changed supergraph hash or manifest integrity in `/api/web/modules`. Meanwhile the link refuses mutations. Stations reload by themselves only when no form holds unsent input.
* Each web package's codegen reads its closure schema, so a screen cannot select a field from a plugin the installation lacks.

### Consequences

* Good, because realtime needs no broker and no new infrastructure on the pilot host, and one `NOTIFY` per sequencer batch avoids a commit-lock bottleneck per business transaction.
* Good, because open boards and stations recover after an upgrade without user action, and the refetch covers events committed while the socket was down (the tail itself starts at the current position).
* Good, because an operator role at one plant no longer leaks another plant's events, and a removed permission stops events without waiting for the permission cache's TTL.
* Good, because one apply reaches a subscriber as at most a couple of messages and one board query.
* Bad, because every reconnect refetches every active query on every open tab.
* Bad, because each subscription executes on its own, so one event fans out to one `_entities` call per foreign subgraph per subscriber; in process this is a function call.
* Bad, because the reload dialog blocks work until the user reloads, and a station with unsent input waits for the operator.
* Neutral, because the board thresholds are open until the board spike measures real volumes.

### Confirmation

* `create-northmes-client.test.ts`: with fake timers and a mock WebSocket, 20 failed connects then success leave the client connecting, `connected` fires once and the refetch spy runs once; a unit test asserts the graphql-ws options in the table above.
* `e2e/reconnect-after-outage.spec.ts`: connections are refused for four minutes of fake time while a second session moves an order; after they resume, the station list shows the change within 15 s of fake time and the banner is gone. The spec is red with the library defaults.
* Nightly: the server stops for 70 s; the board shows the reconnecting status meanwhile, and a block moved by a second client appears within 5 s of the restart.
* `subscriptions/board.int.test.ts`: a subscriber at plant A receives plant A and company events with `article.name` resolved and no plant B events; a viewer at A who is an operator at B gets `FORBIDDEN` subscribing at B; a renamed article reaches the next payload; after `planning.productionOrder:read` is removed, nothing arrives within 2 s.
* `subscriptions/plan-revised.int.test.ts` (proposed name): after a 500-row apply a subscriber receives at most 2 messages and issues one board query.
* `e2e/stale-tab.spec.ts`: a tab on build A shows the reload dialog after a restart as build B, sends no mutation on Release, and a direct request carrying build A gets `core.client_outdated`; booting with the example plugins and restarting without them shows the reload dialog, not the route error component.
* `gateway/same-origin.int.test.ts`: a socket that sends `connectionParams { cookie }` without a cookie header gets `UNAUTHENTICATED`.

## Pros and cons of the options

### Client polling without subscriptions

* Good, because it needs no WebSocket and no tail.
* Bad, because it fails the decided requirement and either lags or loads the server with repeated full queries.

### Whole-entity payloads with `NOTIFY` per transaction or a pub/sub library

* Good, because the normalized cache would update without a refetch.
* Bad, because `NOTIFY` per business transaction serializes commits on a global lock and caps payloads at 8 000 bytes.
* Bad, because the Postgres pub/sub libraries checked are unmaintained or depend on old `pg` and `graphql` versions.
* Bad, because large payloads after an apply multiply by subscribers.

### graphql-ws with ids-only payloads fed by the event tail

* Good, because the tail reuses the event log and its commit-ordered positions.
* Good, because authorization runs per event with the same permission cache as requests.
* Bad, because every change costs a refetch, and the refetch rules live in the client.

### An external broker

* Good, because it decouples fan-out from the database.
* Bad, because the pilot does not need it; if volume ever does, Valkey (BSD 3-Clause) is preferred over Redis for its license.

## More information

* Related ADRs: [0011][adr-0011] (same-origin rules, WebSocket close codes), [0014][adr-0014] (event log and sequencer), [0015][adr-0015] (embedded gateway), [0019][adr-0019] (plant switch, module list), [0021][adr-0021] (live regions, Pause live updates), [0029][adr-0029] (drafts and soft locks), [0030][adr-0030] (board spike), [0043][adr-0043] (shutdown order).
* Plan: [05-graphql-and-apis.md](../plan/05-graphql-and-apis.md) (realtime section), [06-web-and-ux.md](../plan/06-web-and-ux.md) (live data, reconnects and upgrades), [07-production-planning.md](../plan/07-production-planning.md) (board events).
* graphql-ws: https://github.com/enisdenjo/graphql-ws
* Revisit when the board spike reports volumes, when a second `api` replica runs, when a site blocks WebSockets and SSE becomes the main transport, or when event volume needs a broker.

[adr-0011]: 0011-principals-credentials-and-same-origin-rules.md
[adr-0014]: 0014-outbox-event-log-and-pg-boss-jobs.md
[adr-0015]: 0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md
[adr-0019]: 0019-web-shell-with-react-module-federation-remotes.md
[adr-0021]: 0021-accessibility-target-wcag-2-2-aa.md
[adr-0029]: 0029-per-planner-drafts-soft-locks-and-the-plan-revision.md
[adr-0030]: 0030-a-planning-board-built-in-house.md
[adr-0043]: 0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md
