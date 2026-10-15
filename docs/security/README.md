# Security and audit readiness

This is the entry point for an auditor and for anyone who changes NorthMES. [ADR 0076](../adr/0076-secure-development-lifecycle-with-a-security-note-per-change-a-controls-index-and-an-internal-audit-each-release.md) decides the working rules: a security note in every pull request, security tests first, the threat model kept current, and an internal audit before each release. The guidelines follow IEC 62443-4-1, the development controls of ISO 27001 and SOC 2, and OpenSSF Best Practices, with ISA-95 terms where practical.

- [Controls index](#controls-index): each control, its decision, and the evidence that it is built, or the issue that will build it.
- [Threat model](threat-model.md): the assets, zones and conduits, surfaces, and the STRIDE threats at each boundary with their controls.
- [Risk register](risks.md): each accepted risk with an owner, a review date and its ADR or issue.
- Audit reports: [2026-10-11](audits/2026-10-11.md), tracked in [#473](https://github.com/northMES/northmes/issues/473).
- Architecture and data flows: [plan 02](../plan/02-architecture.md). Deployment and operations: [plan 12](../plan/12-operations-and-security.md). Risks: [plan 17](../plan/17-risks.md).
- Reporting a vulnerability: [`SECURITY.md`](../../SECURITY.md) at the repository root.

## Controls index

Status: **built** (code, a test or a CI job shows it), **decided** (an ADR or plan holds it, and code does not exist yet), **gap** (an issue tracks it), or **accepted** (deferred with a reason). The audit before each release checks this table against the code (ADR 0076).

### 1. Secure development

| Control | Status | Evidence |
|---|---|---|
| Least privilege in the database: `nm_owner`, `nm_app`, `nm_auth` and `nm_ext`, none with SUPERUSER, CREATEDB, REPLICATION or BYPASSRLS | built | ADR 0006, ADR 0008; `apps/backend/src/db/bootstrap.ts`; `bootstrap.int.test.ts` |
| Row-level security on module tables, with scopes set per transaction from bound values | built | ADR 0008; `apps/backend/src/db/scoped-database.ts`; `access-policies.int.test.ts`, `scoped-database.int.test.ts` |
| Row-level security on a user's own rows (own dashboard tabs), by the signed-in user's id set per transaction from a bound value | built | ADR 0078 (proposed); `apps/backend/src/db/scoped-database.ts`; `dashboard-tab-policies.int.test.ts`, `scoped-database.int.test.ts` |
| Row-level security on writes to the scope tree and companies: `nm_app` adds a node or a company only at a company among its write scopes | built | ADR 0008; `20261014214627_scope_company_policies.sql`; `access-policies.int.test.ts` |
| Row-level security on reads of the identity and company tables, and a closed `principal_grants` | gap | [#483](https://github.com/northMES/northmes/issues/483) |
| Least privilege in containers (non-root, read-only, no capabilities, a memory limit) | built | ADR 0044; `Dockerfile` (`USER node`), `deploy/compose.yaml`; `test/meta/compose.test.ts` |
| No secrets in code: secret files only, files readable by others refused, dev secrets refused in production | built | ADR 0060, ADR 0047; `packages/sdk/src/config/secrets.ts`; `config.int.test.ts` |
| A minimum strength for the auth secret: at least 32 bytes, or the boot is refused | built | `packages/sdk/src/config/secrets.ts`; `secrets.test.ts` |
| The stack seed's dev users, whose passwords are public, refused in production: the boot stops while one exists | built | `apps/backend/src/boot/dev-users.ts`; `boot.int.test.ts` |
| Every input parsed by a Zod contract | built | ADR 0017; `packages/sdk/src/commands/command-bus.ts`, `mutation-field.ts` |
| Parameterized SQL only (Kysely with bound values; `sql.raw` on constants only) | built | `packages/sdk/src/lists/define-list.ts`; CodeRabbit path instructions in `.coderabbit.yaml` |
| Errors masked: GraphQL `maskedErrors`, only HTTP exceptions pass the filter, static file errors hide paths | built | `apps/backend/src/graphql/server.ts`; `packages/sdk/src/errors/exception-filter.ts`; `apps/backend/src/web/static-mounts.ts` |
| Request size, depth and cost limits on GraphQL | built | ADR 0070; `apps/backend/src/graphql/limits.ts`, `apps/backend/src/graphql/cost.ts`; `limits.test.ts`, `limits.int.test.ts`, `web-operations.test.ts`. A rate limit per principal, or per client address without one, answers 429 with Retry-After (`rate-limit.test.ts`); its counters live in each replica's memory |
| Cryptography: AES-256-GCM with a keyring for stored secrets, TLS at the proxy | decided | ADR 0047, ADR 0044 |
| Pinned dependencies: exact catalog versions, 14-day release age, install scripts denied | built | `pnpm-workspace.yaml` |

### 2. Authentication, authorization and access control

| Control | Status | Evidence |
|---|---|---|
| Deny by default: a global principal guard, which also runs on field resolvers | built | ADR 0011 (proposed); `access-api.module.ts`, `graphql.module.ts` |
| Short-lived JWTs (5 minutes, EdDSA, issuer and audience pinned), principal re-read on every request | built | `auth-options.ts`; `principal.service.ts`; `sign-in.int.test.ts` |
| JWT signing keys rotated every 30 days by Better Auth's own rotation, encrypted with the auth secret in `auth.jwks` | built | `auth-options.ts`; `sign-in.int.test.ts` |
| The sign-in return path stays on the web's origin: resolved as a URL, any other origin leads to the root | built | `apps/web/src/auth/sign-in-link.ts`; `sign-in-link.test.ts` |
| Role-based access control with permissions per scope, checked by the command bus at the row's scope | built | ADR 0010, ADR 0012; `permissions.ts`; `command-bus.ts`; `role-assignment-commands.int.test.ts` |
| A user's own row changed without a permission: the command bus skips the permission only for a row its target names as the principal's own, which row-level security keeps from every other user, and still checks the version | built | ADR 0078 (proposed); `packages/sdk/src/commands/command-bus.ts`, `apps/backend/src/commands/command-bus.ts`; `command-bus.test.ts`, `dashboard-save.int.test.ts` |
| A permission check on every read | gap | [#474](https://github.com/northMES/northmes/issues/474) (production orders) |
| No one grants a permission they lack; the last Company admin is protected | built | `role-rules.ts`, `user-rules.ts`; `last-admin` tests |
| No web setup route: companies, their first Company admins and admin recovery only from the CLI on the host, which writes as `nm_app` and `nm_auth`, never prompts and takes no password as a flag | built | ADR 0011, ADR 0066, ADR 0072; `apps/backend/src/admin/`, `administration.service.ts`; `cli.test.ts`, `company.int.test.ts`, `reset-password.int.test.ts`. The command row and security event wait on the audit trail ([#443](https://github.com/northMES/northmes/issues/443)) |
| Block and unblock limited to users who hold no more than the actor | gap | [#478](https://github.com/northMES/northmes/issues/478) |
| Only the auth routes the web uses are open: sign-in, the JWT and sign-out | built | ADR 0011 (proposed); `auth-options.ts` (`openPaths`); `auth-routes.int.test.ts` |
| Sign-in throttling and account lockout | built | [#476](https://github.com/northMES/northmes/issues/476); `auth-options.ts` (Better Auth's rate limit on every `NODE_ENV`, per client address), `sign-in-lockout.ts`, `trusted-proxy.module.ts`; `sign-in.int.test.ts`. The lockout is logged once the audit trail lands ([#443](https://github.com/northMES/northmes/issues/443)) |
| Session absolute lifetime (24 hours from sign-in, whatever its use), and JWTs ended with their session: a JWT is refused once its session signed out, was revoked or expired | built | `auth-options.ts`; `auth.service.ts`; `auth-options.test.ts`, `sign-in.int.test.ts` |
| The auth design (ADR 0011) matches the code | built | ADR 0011 and ADR 0070: a bearer session in `sessionStorage`, five-minute JWTs, CORS for `webOrigins` without credentials; `apps/backend/src/http/web-origins.module.ts` |
| MFA and a password policy | accepted | ADR 0051 B2: deferred until the pilot's NIS2 status is known |

### 3. Logging, monitoring and audit trails

| Control | Status | Evidence |
|---|---|---|
| Audit trail in the command transaction, append-only, with old and new values | decided | ADR 0013, ADR 0051; [#443](https://github.com/northMES/northmes/issues/443) |
| Security events (sign-in, denials, role and user changes, lockouts) | decided | ADR 0013; [#443](https://github.com/northMES/northmes/issues/443) |
| Structured JSON logs with a UTC time, correlation id and credentials redacted | decided | ADR 0046; [#147](https://github.com/northMES/northmes/issues/147) |
| No secrets in logs: password statements unlogged, pool errors without credentials | built | `bootstrap.ts`, `pool.ts` |
| Tamper-evident audit seals | accepted | ADR 0051: deferred to B1 |

### 4. Data protection and integrity

| Control | Status | Evidence |
|---|---|---|
| TLS in transit through the proxy, with HTTPS required for the public origin in production | decided (origin check built) | ADR 0044; `packages/sdk/src/config/server-env.ts` |
| Security headers on every response | gap | [#480](https://github.com/northMES/northmes/issues/480) |
| Encryption of stored secrets and of offsite backups | decided | ADR 0047, ADR 0045 |
| Nightly backups of the database and the site's files, mode 600, with the restore run in CI; the off-host copy and its encryption are the customer's | built | ADR 0045; `deploy/backup.sh`; `scripts/ci/backup-restore.sh` |
| Append-only production facts, corrections as new records, no hard deletes | decided | ADR 0051 rules 4, 5 and 24 |
| Retention and erasure | decided | ADR 0013, plan 12 (GDPR basics) |

### 5. Dependency and supply chain security

| Control | Status | Evidence |
|---|---|---|
| CI hardening: actions pinned by SHA, read-only tokens, no `pull_request_target`, inputs through `env` | built | `.github/workflows/ci.yml`; `test/meta/workflows.test.ts` |
| License gate, dependency audit, CodeQL as required checks | decided | ADR 0040, ADR 0050; [#7](https://github.com/northMES/northmes/issues/7), [#197](https://github.com/northMES/northmes/issues/197) |
| SBOM in CycloneDX per package and image | decided | ADR 0040 |
| Automated dependency updates | gap | [#482](https://github.com/northMES/northmes/issues/482) |
| MIT packages import no AGPL code | built | `scripts/lint/mit-imports.mjs`; `test/meta/mit-imports.test.ts` |
| Origin and license of third-party components | built | `LICENSE`, `NOTICE`, `skills-lock.json`, SPDX headers |
| Contributions under a signed CLA: `CI / cla` checks the pull request author and every commit author against `.github/cla/signed.json` on the default branch, with no checkout and a read-only token; it joins `CI / gate` before the first outside pull request | built | ADR 0039; `scripts/cla/check.mjs`, `.github/workflows/ci.yml`; `scripts/cla/check.test.ts`, `test/meta/workflows.test.ts`. The CLA texts wait for legal review |

### 6. Vulnerability management

| Control | Status | Evidence |
|---|---|---|
| `SECURITY.md` with reporting, response target, supported versions and the plugin trust model | built | `SECURITY.md`; `test/meta/security-policy.test.ts` |
| Patch releases for security fixes | decided | ADR 0038, ADR 0051 |
| Accepted risks recorded with an owner and a review date | built | the [risk register](risks.md); `test/meta/security-docs.test.ts` |

### 7. Architecture and industrial standards

| Control | Status | Evidence |
|---|---|---|
| ISA-95 names in code and the glossary | decided | ADR 0026; `GLOSSARY.md` |
| Documented data models and integration points | built | plans 04, 05 and 07; ADR 0031, ADR 0032, ADR 0064 |
| OPC UA and MQTT security mode, credentials and access lists | decided | ADR 0076 rule 4: in each integration's ADR before code |

### 8. Documentation for auditors

| Control | Status | Evidence |
|---|---|---|
| Architecture and data-flow diagrams | built | [plan 02](../plan/02-architecture.md), [plan 12](../plan/12-operations-and-security.md) |
| Threat model | built | [threat-model.md](threat-model.md); `test/meta/security-docs.test.ts` |
| Hardening guidance | decided | plan 12 go-live checklist, ADR 0044; the install guide of ADR 0048 |
| This controls index and the audit reports | built | this page |

### 9. Code quality and maintainability

| Control | Status | Evidence |
|---|---|---|
| Test first, with Postgres from Testcontainers and tests as `nm_app` | built | ADR 0041; `pnpm check` |
| Lint, format and typecheck in CI; every CI job a required check | built | Biome; `.github/workflows/ci.yml`; ADR 0069 |
| Module boundaries enforced | built | `scripts/lint/module-boundaries.mjs`; `test/meta/module-boundaries.test.ts` |
| Review on every pull request by CodeRabbit and the maintainer | built | ADR 0065; `.coderabbit.yaml` |

### 10. Process

| Control | Status | Evidence |
|---|---|---|
| Decisions recorded as ADRs, checked by a meta test | built | `docs/adr`; `test/meta/adr.test.ts` |
| Every pull request linked to an issue, with a Conventional Commit title | built | `scripts/ci/linked-issue.mjs`, `scripts/ci/pr-title.mjs` |
| A security note in every pull request | built | ADR 0076; `.github/PULL_REQUEST_TEMPLATE.md`, checked by `test/meta/security-docs.test.ts`; `CI / pr security` (`scripts/ci/pr-security.mjs`, `scripts/ci/pr-security.test.ts`) fails a pull request whose Security section is missing, empty or a bare none |
| An internal audit before each release and each quarter | decided | ADR 0076 |
