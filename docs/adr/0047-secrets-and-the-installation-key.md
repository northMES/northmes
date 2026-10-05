---
status: "proposed"
date: 2026-10-05
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: internal research notes 01, 06, 15, 22, 23 and 32
informed: contributors, coding agents and pilot IT
release: "1"
needs-confirmation: "pilot IT (escrow location)"
---

# Secrets and the installation key

## Context and problem statement

In role `all`, every plugin's server code runs in the `app` process ([ADR 0002](0002-modular-monolith-with-module-owned-schemas-and-process-roles.md)). The first Compose design gave `app` the same secrets as `migrate`, including the database owner password. In a test, the owner role detached and dropped an audit partition despite the `ENABLE ALWAYS` triggers, so a plugin bug or remote code execution in `app` could erase the audit trail (internal research note 32).

NorthMES also stores integration secrets in the database: AI provider keys ([ADR 0035](0035-ai-provider-port-with-customer-configured-providers.md)) and Pyramid credentials ([ADR 0032](0032-pyramid-connector-polling-file-mode-and-shadow-write-back.md)). An admin who edits a provider's base URL could make Test connection send a stored key to a new host, or point a URL at a link-local metadata address. The offsite backup repository is encrypted, and its cipher pass lived only on the host, so losing the host made the offsite backup unreadable.

This ADR records which secret each Compose service receives, how stored secrets are encrypted and bound, the rule for admin-set outbound URLs and the offline escrow. It covers the `secrets` section of `compose.yaml`, `install.sh`, the secret store in core, the AI provider cache and the recovery runbook.

## Decision drivers

* A process receives only the secrets it uses.
* A stored secret is usable only for the row, column and endpoint host it was saved for.
* The installation can be rebuilt on a clean host from backups plus escrowed material.
* A dozen secrets do not need key management infrastructure.
* A configuration change takes effect without a restart.

## Considered options

* Compose secrets per service, AES-256-GCM with a versioned keyring and associated data that includes the endpoint host, purpose keys derived from one installation key, and one offline escrow kept in two places
* One shared set of Compose secrets for `app` and `migrate`, with the installation key as the only escrowed item
* Envelope encryption with a data key per secret

## Decision outcome

Chosen option: "Compose secrets per service, AES-256-GCM with a versioned keyring and associated data that includes the endpoint host, purpose keys derived from one installation key, and one offline escrow kept in two places", because it removes the owner password from the process that runs plugin code, binds each stored secret to its endpoint, and makes the offsite backup restorable without the host.

### Secrets per service

| Secret | Service | Purpose |
|---|---|---|
| `db_app_password` | `app` | `nm_app`, the runtime login |
| `db_auth_password` | `app` | `nm_auth`, Better Auth's own pool, with rights on the auth schema only |
| `auth_secret` | `app` | The Better Auth secret |
| `installation_key` | `app` | Root of the purpose keys |
| `customer_ca` | `app` | The customer's CA bundle for outbound TLS ([ADR 0044](0044-on-prem-deployment-with-docker-compose-and-mandatory-tls.md)) |
| `db_owner_password` | `migrate` | `nm_owner`, the only login that may `SET ROLE` to module owner roles ([ADR 0006](0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md)) |
| Superuser password | `db` | First init, bootstrap and extension updates ([ADR 0005](0005-postgres-18-official-image-with-pgbackrest-timescaledb-deferred.md)) |

`install.sh` generates every secret and writes each file with `install -m 0440`, owned by root and the group of the uid the `db` and `app` processes run as, in a root-owned directory with mode 0700.

### Stored secrets

* Stored secrets use `node:crypto` AES-256-GCM with a versioned keyring. The key version is stored next to each ciphertext and each badge hash.
* The associated data binds each ciphertext to its table, row, column and normalized endpoint host. A configuration update that changes an AI base URL or the Pyramid endpoint without a new secret fails with `core.secret_reentry_required`.
* Purpose keys come from the installation key through HKDF: `secrets-v1` for stored secrets, `badge-v1` for badge HMACs ([ADR 0010](0010-identity-with-better-auth-roles-and-permissions-in-core-tables.md)).
* Rotation re-encrypts every row in one transaction.
* Losing the installation key means re-entering every integration secret, and badge HMACs made with the old `badge-v1` key no longer match a scan.

### Outbound URLs set by an admin

* Private and link-local targets need an installation-level allowlist entry; a model server on the plant LAN is a normal case.
* `169.254.0.0/16` and the database host are always blocked.
* Test connection reports only reachable, not reachable or auth failed.
* Plants behind a proxy use `NODE_USE_ENV_PROXY=1` with `HTTPS_PROXY`, and `NO_PROXY` includes the database host and any LAN model server.
* The AI provider cache is keyed by (providerConfigId, config revision) and invalidated together with the permission cache, so an edited base URL, a rotated secret or a deleted configuration takes effect without a restart.

### Offline escrow

* One offline escrow, kept in two places, holds the material needed on a clean host: `repo2-cipher-pass`, the repo2 credentials, the installation key, the Caddy root key when the internal CA is used, and the Better Auth secret.
* The installation key is kept apart from database backups, because the key plus a backup gives the plaintext of every stored secret.
* Each quarter, a restore from repo2 only, on a scratch VM or in CI, uses nothing but the escrowed material. Its duration is recorded as the measured RTO ([ADR 0045](0045-backups-restore-drills-upgrades-and-rollback.md)).
* Pilot IT decides where the two copies are kept.

### Consequences

* Good, because code running in `app` cannot connect as the owner, disable triggers or drop audit partitions.
* Good, because a stored key never reaches a host it was not entered for, and a metadata address is refused before any connection.
* Good, because the quarterly restore proves that the offsite backup is readable without the host.
* Bad, because changing an endpoint host always requires re-entering its secret.
* Bad, because the customer must keep an offline escrow current in two places, and the installation key is a single root for every stored secret.
* Bad, because Compose secrets are plain files on the host, protected only by file permissions.

### Confirmation

* Compose contract test (Vitest): `docker compose config --format json` shows no `db_owner_password` for `app`, the owner password only for `migrate` and the superuser password only for `db`.
* Nightly Compose job: `test ! -e /run/secrets/db_owner_password` succeeds inside `app`.
* Database role tests: as `nm_app`, `SET ROLE` to the audit owner fails, `DROP TABLE` of an audit partition fails with "must be owner", and a select from `auth.account` fails while `core.user_directory` works.
* Secret binding tests: a ciphertext copied to another row or column fails to decrypt; changing an OpenAI-compatible base URL to another host without a key returns `core.secret_reentry_required`, and the egress mock records zero requests.
* Outbound URL tests: a base URL of `169.254.169.254` or the database host is refused before any connection; a private address passes only with an allowlist entry.
* Provider cache test: after a configuration update commits, the next call uses the new base URL and secret; a deleted configuration gives no provider.
* Rotation test: after a key rotation, every stored secret decrypts with the new key version, and the old version is no longer referenced.
* Quarterly restore from repo2 with escrowed material only completes, passes the smoke test, and its duration is recorded.

## Pros and cons of the options

### Secrets per service, bound ciphertexts, purpose keys, escrow

* Good, because each guard is a small rule with its own test.
* Bad, because every new integration secret must name its endpoint host in the associated data.

### One shared secret set and only the installation key escrowed

* Good, because Compose needs one anchor for `app` and `migrate`.
* Bad, because the owner password reaches the plugin process, and an encrypted offsite backup cannot be decrypted once the host is lost (internal research note 32).

### Envelope encryption with a data key per secret

* Good, because it is the usual pattern for large secret stores.
* Bad, because at about a dozen secrets a per-secret data key adds nothing over a versioned keyring, and the real risks are a key stored next to the backup and forgotten secrets such as the auth secret (internal research note 15).

## More information

* Related ADRs: [0005](0005-postgres-18-official-image-with-pgbackrest-timescaledb-deferred.md), [0006](0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md) roles, [0008](0008-row-level-security-with-transaction-local-scopes.md), [0010](0010-identity-with-better-auth-roles-and-permissions-in-core-tables.md) badges, [0013](0013-audit-trail-written-in-the-command-transaction.md) audit owner, [0032](0032-pyramid-connector-polling-file-mode-and-shadow-write-back.md) Pyramid endpoint, [0035](0035-ai-provider-port-with-customer-configured-providers.md) AI providers, [0044](0044-on-prem-deployment-with-docker-compose-and-mandatory-tls.md) Caddy internal CA, [0045](0045-backups-restore-drills-upgrades-and-rollback.md) repo2.
* Plan: [12 operations and security](../plan/12-operations-and-security.md) (secrets and the installation key, go-live checklist item 5), [04 data and platform](../plan/04-data-and-platform.md) (secrets and the installation key), [10 AI and agents](../plan/10-ai-and-agents.md) (on-prem reachability).
* Compose secrets: https://docs.docker.com/compose/how-tos/use-secrets/
* Node.js crypto (AES-GCM, HKDF): https://nodejs.org/api/crypto.html
* Revisit when a customer asks to keep keys in its own secret manager, or when the stored secrets grow well beyond the integrations of release 1.
