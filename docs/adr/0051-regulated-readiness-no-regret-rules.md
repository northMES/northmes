---
status: "accepted"
date: 2026-10-05
decision-makers: Krister Johansson
consulted: internal research notes 01, 12, 15, 22, 24, 27 and 32
informed: product owner, contributors and coding agents
release: "1"
needs-confirmation: "lawyer (signature path, CRA role); product owner (regulated profile switch)"
---

# Regulated readiness: no-regret rules

## Context and problem statement

The pilot customer is not in a regulated industry. Krister Johansson decided that release 1 must still not paint the project into a corner, and that the project documents what a regulated customer would require and the work list. Regulation reaches NorthMES through its customers: a manufacturer under 21 CFR Part 11, EU GMP Annex 11, ISO 13485 and the FDA QMSR, food law or IATF 16949 must validate the computerized systems that hold its required records and assess their supplier. NorthMES is production software, not a medical device; the customer is inspected and the vendor is audited as a supplier.

Some choices are cheap now and expensive to retrofit once data exists: corrections as new records, no deletion of rows with reports, behaviour configuration in audited tables, record times from one clock, operators as full users, the software version on every audit row. This ADR adopts 24 no-regret rules for release 1, decides the compliance profile and the reserved signature stage, records the security answers the pilot needs, and fixes the work list for the day a regulated customer signs. It covers core (commands, audit, identity, settings), the production-start module's reports, planning's routing copies, the release process and the docs.

## Decision drivers

* The GraphQL contract and the database must not change when a later profile requires reasons or signatures.
* Release 1 is already full; the new rule work must stay small (about 8 to 10 developer days, an estimate).
* Validation happens per installation, and one installation serves one customer.
* Customers ask security questions without any GxP duty: NIS2 supply chain rules, ISO 9001 audits, and Cyber Resilience Act vulnerability reporting, which applies since 11 September 2026.
* AI must stay acceptable under the draft EU GMP Annex 22: a person stays responsible for outputs.

## Considered options

* Adopt the 24 rules now, build the ones that are cheap now and costly later, reserve signatures
* Build nothing for regulated customers until one signs
* Build the regulated baseline (locked audit profile, signatures, validation package) in release 1

## Decision outcome

Chosen option: "Adopt the 24 rules now", because the rules that are costly to retrofit cost about 8 to 10 days now, the rest is design that costs nothing when made before the code exists, and the full baseline (38 to 60 days) would serve a customer the project does not have.

| # | Rule | Release 1 |
|---|---|---|
| 1 | Every command can carry a reason through one shared optional input on every mutation; contracts declare where it is required | Built |
| 2 | Audit keeps old and new values; exports write instants with UTC offset and the plant's IANA zone | Built |
| 3 | Command rows record principal, acting-for user, credential, surface, scope and roles in effect | Built |
| 4 | Production facts are append-only; a correction is a new record that references the original and carries a reason; no update endpoint for reports | Built |
| 5 | No hard deletes of business records; a job order with reports is frozen and autoplan never deletes or recreates it; reports reference the order operation and equipment | Built |
| 6 | Behaviour-affecting configuration lives in audited tables; environment variables hold only infrastructure settings and secrets | Design rule |
| 7 | Plugin enablement, HTTP action endpoints and their fail-open choice are audited commands | Design rule (validators fail closed; per-organization enablement and actions do not exist yet) |
| 8 | An order's routing copy records the source operation id and its `version` at release | Built |
| 9 | Calendar and shift versions are immutable once in effect | Built |
| 10 | Record times come from the database clock; device time is stored as data; System health compares clocks and shows NTP status | Built |
| 11 | Ids are uuidv7 and never reused; usernames are never reassigned; badge assignments are dated rows | Built |
| 12 | Every operator is a full user with a username, also when signing in by badge only | Design rule |
| 13 | A password set by an administrator is temporary and must be changed at the next sign-in | Built |
| 14 | One installation policy object, the compliance profile, decides audit opt-outs, redaction, reason requirements, password, lockout and session rules, AI availability and signature requirements | Built, `standard` profile only |
| 15 | Each audit command row records NorthMES version, image digest and configuration revision; `northmes config export` writes modules, plugins with versions, roles and settings | Columns built; export before the first regulated sale |
| 16 | The command pipeline reserves a signature stage between validators and execution; manifests may declare `signature`; a signature binds to one command id and a record hash | Reserved, not built |
| 17 | Audit and record exports use a documented, versioned format readable without NorthMES | Built |
| 18 | Every pull request carries a validation impact: none, UI only, records, security, calculation, data migration | Built |
| 19 | Tests carry requirement ids; CI keeps JUnit XML, coverage and e2e reports per release tag | Ids from the first test; retention before the first regulated sale |
| 20 | SBOM per package and image, `SECURITY.md`, signed or attested images, license notices | Built |
| 21 | A Supplier quality page: development, review, testing, release, vulnerability handling, support periods, data integrity features | Before the first regulated sale |
| 22 | AI never commits; agent writes are proposals a person commits; AI features never score, rank or assign people | Built |
| 23 | One installation per customer | Decided |
| 24 | No audit deletion by default; partition export then drop is the only delete path | Built |

Details that make the rules concrete:

* Compliance profile: installation-wide, never per company; a regulated company in a mixed group gets its own installation. Switching to a regulated profile is one-way and CLI-only (product owner confirms). Every compliance-sensitive branch reads the profile, never an environment variable.
* Configuration revision: the installed catalog (module ids, versions, manifest hashes, supergraph hash) is folded into it, and one boot command is written only when the catalog changes. Statement triggers on settings, role, assignment, retention and installed-module tables bump `core.config_revision`. The build identity sits in OCI labels and `/app/build.json`, and one Compose variable feeds both `image:` and `NORTHMES_IMAGE_REF`. The Better Auth `testUtils` entry point stays out of the production image, and boot refuses to start with `BETTER_AUTH_TELEMETRY` set.
* Export: `audit.command.detail` holds the export's filters, row count and format version, written before streaming. The format is JSON Lines plus a manifest with field labels, an id-to-label dictionary and plant zones. A migration that renames an audited column records the mapping.
* Signatures: `recordHash` and station signing wait for the signature work, which starts when the first device or pharma customer signs. The signature path, including whether passkeys satisfy 21 CFR 11.200, needs legal confirmation.

Security answers for the pilot:

* `SECURITY.md` names GitHub private vulnerability reporting (the form asks for the CWE) and security@northmes.dev, holds the supported-versions table (latest minor only before 1.0) and a response target. A short page on vulnerability handling and customer notification exists before the pilot. The vendor's role under the Cyber Resilience Act needs confirmation.
* A patch release class: image-only, no migrations, rollback class image, with a 72-hour target from fix to customer bundle and a contact list in the runbook.
* Support engineers are named NorthMES users with a support role. `audit.begin_command` with surface `sql` requires an active support user and a reason. Security events are also structured log lines, so a customer SIEM sees failed sign-ins.
* Multi-factor authentication is decided once the pilot customer's status under the Swedish Cybersäkerhetslag (NIS2) is known: Microsoft Entra ID as the Microsoft provider, or Better Auth `twoFactor` after a review of its advisories.

When a regulated customer signs, the work starts with five steps: classify the customer and the regulations that apply; agree the intended use and mark the high process risk features; turn on the regulated profile and agree its values; deliver the validation package and run the supplier audit; plan the industry work. The baseline for any regulated customer, in developer days (estimates):

| # | Work | Days |
|---|---|---|
| B1 | Locked audit profile: no category opt-outs, no redaction, seals and `northmes audit verify`, a separate audit owner role, a DDL event trigger | 5 to 8 |
| B2 | Identity and access: password policy, lockout with admin unlock, inactivity logout with re-authentication, access log, MFA for remote access | 6 to 10 |
| B3 | Reason prompts for declared commands and fields, switched by the profile | 2 to 4 |
| B4 | Audit review support: critical-data filters, changes since the last review, a recorded review | 3 to 5 |
| B5 | Complete copies: order history with its audit trail as PDF and in the export format | 4 to 6 |
| B6 | Vendor validation package: requirement catalogue, function risk assessment, traceability matrix from test ids, CI evidence, installation report, Part 11 and Annex 11 compliance matrix | 10 to 15 first time, 2 to 4 per release after |
| B7 | Supplier audit pack: QMS description, review, change and release control, vulnerability handling, data integrity features, support terms; a rehearsal audit | 8 to 12 |

The total is about 38 to 60 days. Industry work comes on top: electronic signatures (10 to 15 days) for medical devices and pharma; the Traceability module core (30 to 50 days) for medical devices, food and automotive; a device or batch record report (15 to 28 days); food recall reports and lots at goods receipt and dispatch (10 to 18 days); FSMA 204 exports only for US-listed foods (5 to 10 days); retention beyond 15 years for automotive (3 to 5 days). Pharma is not entered without a separate decision, because an electronic batch record is a product of its own. The vendor needs a documented quality management system aligned with ISO 9001 (10 to 20 days to write), a supplier audit pack, a quality agreement template, the Cyber Resilience Act's full manufacturer obligations from 11 December 2027, and a longer support line for regulated customers. [15-regulated-readiness.md](../plan/15-regulated-readiness.md) holds the full work list, the traps release 1 avoids and the sources.

### Consequences

* Good, because a regulated customer later needs added work and configuration, not a data migration or an API change.
* Good, because the same rules answer ISO 9001 and NIS2 questionnaires that the pilot may bring.
* Bad, because release 1 carries about 8 to 10 days of work the pilot does not ask for.
* Bad, because append-only reports and no hard deletes make mistakes visible forever; corrections are new rows with reasons.
* Neutral, because signatures, seals and the regulated profile wait; the reserved stage and the manifest key keep their place.

### Confirmation

* Schema test: every Mutation field accepts the shared reason input; a test profile that requires reasons returns `REASON_REQUIRED` while the committed supergraph snapshot is unchanged.
* Export test: `detail.rowCount` equals the line count; every instant carries an offset and a zone; after a rename of `end_at` the manifest maps old to new; a plain JSON parser reads the file.
* As the runtime role: UPDATE on a report table fails; DELETE on `job_order` fails; UPDATE, DELETE and TRUNCATE on audit tables fail. Correcting a correction is refused.
* Autoplan over a job order with reports leaves it unchanged. A release test asserts source operation id and version on each copied operation.
* A report with a skewed device time keeps the database `received_at`. Creating a user with a retired username fails. After an admin password reset, sign-in requires a new password before any other request succeeds.
* A test lists every branch that reads the compliance profile and fails when a new branch reads an environment variable instead. Review checklist: a new `NORTHMES_*` variable that changes behaviour is rejected.
* Boot without the example validator writes one command with `details.removed`; a second unchanged boot writes none; changing a setting raises the next command's `config_revision` by 1; `/app/dist` contains no `testUtils` symbol; boot with `BETTER_AUTH_TELEMETRY` set exits non-zero.
* The manifest schema accepts the `signature` key, and the signature stage is a tested no-op.
* `begin_command` with surface `sql` and a principal that is not an active support user raises.
* A CI release test fails a patch release whose migration list differs from the previous minor.
* The pull request check fails without a validation impact.

## Pros and cons of the options

### Adopt the rules now

* Good, because each costly retrofit is avoided for about half a day to a day of work.
* Bad, because the rules constrain every module author from the first task.

### Build nothing until a regulated customer signs

* Good, because release 1 is smaller.
* Bad, because operator identities, edited reports, deleted rows and environment-variable switches would need data migrations and API changes later.

### Build the regulated baseline in release 1

* Good, because a regulated sale could happen sooner.
* Bad, because 38 to 60 more days serve no current customer, and signatures need legal confirmation first.

## More information

* Related ADRs: [0010](0010-identity-with-better-auth-roles-and-permissions-in-core-tables.md) (operators, badges, retired usernames, temporary passwords), [0012](0012-commands-as-the-single-write-path.md) (reason input, signature stage), [0013](0013-audit-trail-written-in-the-command-transaction.md), [0022](0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md) (settings), [0028](0028-autoplan-as-a-pure-deterministic-function.md), [0033](0033-online-operator-station-in-the-production-start-module.md), [0035](0035-ai-provider-port-with-customer-configured-providers.md), [0036](0036-agent-proposals-as-planning-records-a-person-commits.md), [0038](0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md), [0041](0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md), [0043](0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md), [0044](0044-on-prem-deployment-with-docker-compose-and-mandatory-tls.md), [0045](0045-backups-restore-drills-upgrades-and-rollback.md), [0050](0050-github-organization-rulesets-ci-runners-and-supply-chain.md).
* Plan: [15 regulated readiness](../plan/15-regulated-readiness.md), [12 operations and security](../plan/12-operations-and-security.md#security-reporting-and-support-access), [16 open questions](../plan/16-open-questions.md).
* 21 CFR Part 11: https://www.law.cornell.edu/cfr/text/21/11.10. EU GMP Annex 11 (2011): https://health.ec.europa.eu/system/files/2016-11/annex11_01-2011_en_0.pdf. PIC/S PI 041-1: https://picscheme.org/docview/4234. FDA Computer Software Assurance guidance: https://www.fda.gov/regulatory-information/search-fda-guidance-documents/computer-software-assurance-production-and-quality-management-system-software. Cyber Resilience Act dates: https://digital-strategy.ec.europa.eu/en/policies/cra-summary.
* Not legal or regulatory advice. Revisit when a regulated customer signs, when the revised Annex 11 and the new Annex 22 are adopted, when the vendor's CRA role is confirmed, and before partner hosting is offered to a regulated customer.
