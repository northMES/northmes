---
status: "proposed"
date: 2026-10-17
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: Krister Johansson (rate limits that an installation enables and sets in the environment, 2026-10-17)
informed: contributors, coding agents, pilot IT and hosting partners
release: "1"
needs-confirmation: "maintainer (rate limits off by default; the three environment variables and their defaults; the exception to ADR 0051 rule 6)"
---

# Public API rate limits off by default and set in the environment

## Context and problem statement

[ADR 0073](0073-one-module-contract-for-rest-webmcp-and-later-mcp-with-oauth-clients-and-tokens.md) section 6 limits the public REST API to 600 reads and 60 writes per minute per credential, counted in a Postgres `ThrottlerStorage`, and always on. On 2026-10-17 Krister Johansson asked for the limits to be an environment setting, so that an installation can turn them on and set them. An on-premises installation with one ERP import may want no limit at all, and a hosting partner with many integrations may want other numbers.

The decision covers the public REST family under `/api/v1`. The WebMCP limit and the OAuth token endpoint's limit in ADR 0073 section 6 stay as they are.

## Decision drivers

* An installation decides how hard its integrations may call the API.
* A limit that is on must hold across every backend process.
* A wrong value must fail at boot, not at the first request.
* [ADR 0051](0051-regulated-readiness-no-regret-rules.md) rule 6 keeps behaviour settings in audited tables, not in environment variables.

## Considered options

* Off by default, with an on switch and two limits in environment variables
* On by default at 600 and 60, with the limits in environment variables
* On by default, with the limits in an audited settings table that a Company admin edits

## Decision outcome

Chosen option: "Off by default, with an on switch and two limits in environment variables", because it is what Krister Johansson asked for, and the host owner who runs the installation is the one who knows its load.

### Changes to ADR 0073

In section 6, the first point, "Public REST: 600 reads and 60 writes per minute per credential", is replaced by these rules:

* The limits are off unless `NORTHMES_API_RATE_LIMIT` is `on`. Its values are `on` and `off`, and the default is `off`.
* `NORTHMES_API_RATE_LIMIT_READS` is the number of GET requests per minute per credential, default 600.
* `NORTHMES_API_RATE_LIMIT_WRITES` is the number of POST requests per minute per credential, default 60.
* The server refuses to boot when the switch is neither `on` nor `off`, or when a limit is not a positive integer.
* When the limits are on, they are counted per credential in the Postgres `ThrottlerStorage`, and a refusal is 429 `core.request.rate_limited` with `Retry-After`, as section 6 says.

The rest of ADR 0073 stands.

### Consequences

* Good, because a small installation runs without limits it does not need, and a large one sets its own.
* Good, because every backend process shares one count, so the limit holds with more than one `app` container.
* Bad, because the setting lives outside the audited tables, against ADR 0051 rule 6, as `NORTHMES_WEBMCP` already does. A change shows only in the deployment's own history, not in the audit trail.
* Bad, because an installation that leaves the limits off has no defense against one integration flooding the API, other than the gateway in front of it.

### Confirmation

* `apps/backend/test/rest/rate-limit.int.test.ts`: the 61st write in a minute from one token returns 429 `core.request.rate_limited` with `Retry-After`; with the limits off, no request is refused; a configured limit replaces the default; reads and writes count apart; two tokens count apart; two backend processes share a token's count.
* The server's configuration tests: a bad value of any of the three variables fails at boot with its name in the message.
* `test/meta/compose.test.ts`: the Compose bundle passes the three variables to `app`.

## Pros and cons of the options

### Off by default, with the switch and the limits in the environment

* Good, because it matches the request and needs no screen.
* Bad, because it is an exception to ADR 0051 rule 6.

### On by default, with the limits in the environment

* Good, because every installation is protected from the start.
* Bad, because an installation that wants no limit has to know to turn it off.

### On by default, with the limits in an audited table

* Good, because each change is audited and a Company admin can change it in the app.
* Bad, because it needs a settings screen and a command before the first token is used, and the limit is per installation, not per company.

## More information

The implementation is `apps/backend/src/http/public-api/public-api-rate-limit.ts` and the migration that adds `core.rate_limit`. Revisit when an installation asks to change the limits without a restart, or when the audit trail ([ADR 0013](0013-audit-trail-written-in-the-command-transaction.md)) records configuration changes.
