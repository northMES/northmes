---
status: "proposed"
date: 2026-10-05
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: internal research note 13
informed: contributors, coding agents, module and plugin authors, hosting partners
release: "later"
needs-confirmation: ""
---

# File storage port with a Postgres driver

## Context and problem statement

Later modules and features will attach files to records: images, documents, exports and similar. NorthMES runs on the customer's own server, and the decision already taken is that no outside service is required: files are stored inside the customer's installation by default, and other storage comes as a plugin behind one interface. Release 1 stores no files; raw Pyramid payloads live in the connector's own tables ([ADR 0032](0032-pyramid-connector-polling-file-mode-and-shadow-write-back.md)).

Under the scope rule ([ADR 0055](0055-release-1-scope-under-option-b-and-the-scope-rule.md)) the port is built when a release needs files. This ADR records its design now, so that no module invents its own way to store bytes in the meantime. It covers the port in `@northmes/sdk`, the metadata table in core, the default driver, driver plugins, downloads and backups.

## Decision drivers

* Customer data stays inside the installation; nothing depends on an outside service.
* One backup must restore records and their files to the same point in time ([ADR 0045](0045-backups-restore-drills-upgrades-and-rollback.md)).
* A file and the row that references it should commit or roll back together.
* The code must work with several replicas ([ADR 0002](0002-modular-monolith-with-module-owned-schemas-and-process-roles.md)), even though the pilot runs one.
* Files must respect the same scope and permission rules as rows ([ADR 0008](0008-row-level-security-with-transaction-local-scopes.md)).
* MinIO's community repository is archived and ships no new binaries or images, so it cannot be the S3-compatible test target.

## Considered options

* A storage port in the SDK with a Postgres default driver; filesystem and S3-compatible drivers as plugins
* A local filesystem volume as the default
* An S3-compatible object store shipped in the Compose bundle as the default
* No port; each module stores bytes its own way

## Decision outcome

Chosen option: "A storage port in the SDK with a Postgres default driver", because it adds no service to the pilot's Compose bundle, keeps files inside the existing backup and transaction, works with any number of replicas, and still lets an installation with large files move to another driver through a plugin.

The port:

* `@northmes/sdk` (MIT) declares the port with four operations: `put`, `get` (returns a stream), `delete` and `exists`. The AGPL host implements it; modules and plugins call only the port.
* Metadata lives in a core Postgres table: scope, owning entity, file name, content type, size, SHA-256, driver and storage key. The table follows every module table's rules: a scope column, row-level security and the audit trigger ([ADR 0013](0013-audit-trail-written-in-the-command-transaction.md)). Storing and deleting a file are commands ([ADR 0012](0012-commands-as-the-single-write-path.md)).
* The SHA-256 verifies integrity on read and lets the store keep one copy of identical content.

The default driver:

* Stores the bytes in Postgres, with a configurable maximum file size (for example 50 MB) checked before any byte is written.
* A file saves in the same transaction as the row that references it, and pgBackRest backs it up with everything else.
* The content table is command-only in the audit sense: the command row records the SHA-256 and size, and no `audit.change` diff ever holds file bytes. Its `bytea` column carries the allowlist entry with a reason that the audit catalog check requires.

Other drivers and operations:

* Filesystem and S3-compatible drivers are plugins. A filesystem driver needs a shared volume when several replicas run. The S3-compatible driver is tested against SeaweedFS (Apache-2.0).
* An installation using another driver backs up that store alongside the database; the install guide says so.
* `northmes files migrate --to <driver>` moves files between drivers.

Downloads:

* Files are never served from public URLs. A download goes through NorthMES with a permission check at the file's scope, or through a short-lived signed link that NorthMES issues after the same check.

Until a release needs files, nothing of this is built. A module that needs to keep a raw payload, as the Pyramid connector does, keeps it in its own table with the payload hash on the command row.

### Consequences

* Good, because the pilot's operations stay unchanged: no extra container, no extra backup target.
* Good, because a restore brings records and files back to the same instant.
* Good, because module code never knows which driver runs, so a customer can change drivers without code changes.
* Bad, because large files enlarge the database, its WAL and its backups; the size limit and the driver plugins answer that.
* Bad, because a filesystem driver loses the shared transaction and needs a separate backup.
* Neutral, because the design waits for its first user and may change when that user's needs are known.

### Confirmation

When the port is built:

* A driver contract suite in `@northmes/testing` that every driver passes: a `put` then `get` round trip returns the same bytes and SHA-256; `exists` and `delete` behave; a file above the maximum size is refused with a named error before any byte is stored; a `get` whose bytes do not match the stored SHA-256 fails.
* Postgres driver integration test: when the owning command's transaction rolls back, neither the file nor its metadata row exists.
* Permission test: a user without read permission at the file's scope gets a forbidden error for the download and for a signed link request; no route returns file bytes without a session or a valid signed link.
* Audit test: storing a file writes one command row with the SHA-256 and size, and no `audit.change` row contains file bytes.
* The S3-compatible driver plugin runs the same suite against SeaweedFS in Testcontainers.

Until then: review rejects a module that stores file bytes outside its own payload tables without this port.

## Pros and cons of the options

### Port with a Postgres default driver

* Good, because one backup, one transaction and any number of replicas come for free.
* Bad, because Postgres is not the cheapest place for very large or very many files.

### Local filesystem default

* Good, because it is simple and fast for large files on one host.
* Bad, because several replicas need a shared volume, files and rows can disagree after a crash or restore, and backups need a second path.

### S3-compatible store in the bundle

* Good, because object stores handle large files well.
* Bad, because it adds a service, its credentials and its backup to every installation, and the common self-hosted choice is archived.

### No port

* Good, because nothing is designed before it is needed.
* Bad, because each module would invent its own storage, and moving an installation to another store would touch every module.

## More information

* Related ADRs: [0002](0002-modular-monolith-with-module-owned-schemas-and-process-roles.md), [0008](0008-row-level-security-with-transaction-local-scopes.md), [0012](0012-commands-as-the-single-write-path.md), [0013](0013-audit-trail-written-in-the-command-transaction.md), [0032](0032-pyramid-connector-polling-file-mode-and-shadow-write-back.md), [0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md) (driver plugins), [0040](0040-dependency-license-policy-ci-gate-and-sbom.md), [0045](0045-backups-restore-drills-upgrades-and-rollback.md), [0055](0055-release-1-scope-under-option-b-and-the-scope-rule.md).
* Plan: [04 data and platform, file storage port](../plan/04-data-and-platform.md#file-storage-port-later), [14 roadmap](../plan/14-roadmap.md).
* MinIO repository (archived): https://github.com/minio/minio.
* Revisit when the first release needs files, and set the maximum size and the signed-link lifetime then.
