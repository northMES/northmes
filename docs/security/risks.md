# Accepted security risks

The security risks NorthMES has accepted for now, each with its reason, an owner, a date by which the owner reviews it, and the ADR or issue that carries it. The residual risks of the [threat model](threat-model.md) end up here, and the internal audit before each release (ADR 0076) reviews every row. A risk leaves the table when its fix is built; a review that keeps it moves its date.

The project's delivery risks are in [plan 17](../plan/17-risks.md). Gaps that an issue will close are in the [controls index](README.md#controls-index), not here.

| Id | Risk | Why it is accepted | Owner | Review by | ADR or issue | Revisit when |
|---|---|---|---|---|---|---|
| A-01 | No MFA, and Better Auth's default password policy | ADR 0051 B2 defers both until the pilot's NIS2 status is known | Krister | 2027-01-15 | ADR 0051, [#446](https://github.com/northMES/northmes/issues/446) | a customer requires MFA, or before the pilot goes live |
| A-02 | No tamper-evident seals on the audit trail | ADR 0051 defers seals and `northmes audit verify` to B1 | Krister | 2027-04-15 | ADR 0051, [#443](https://github.com/northMES/northmes/issues/443) | the regulated profile is switched on |
| A-03 | Plugins run with full trust: a plugin reads whatever `nm_app` can read within the current scopes, sees sessions and configuration, and runs code in the browser (see `SECURITY.md`) | Release 1 installs plugins with `npm install --ignore-scripts` into the plugin volume, and the admin reviews the plugin inventory; no third-party plugin runs on the pilot. A sandbox is not planned, and signed archives come later | Krister | 2027-01-15 | ADR 0037, ADR 0068, ADR 0075 | a third-party plugin is installed, or the plugin archive of ADR 0075 is built |
| A-04 | No backups in v0.0.1: the Compose bundle has no backup or restore path, and `deploy/README.md` says to keep no production data in it | v0.0.1 is not installed for production use | Krister | 2026-11-15 | ADR 0045, [#148](https://github.com/northMES/northmes/issues/148) | the backup profile lands, or before any installation holds production data |
| A-05 | braces has a known vulnerability and no fixed release | It is reached only through `@nestjs/graphql`, ts-morph and fast-glob in the CLI tooling, with patterns the project writes; the server never runs it | Krister | 2026-11-15 | [#526](https://github.com/northMES/northmes/issues/526) | a fixed braces release passes the 14-day release age |
