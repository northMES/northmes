---
status: "proposed"
date: 2026-10-11
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: Krister Johansson
informed: contributors and coding agents
release: "1"
needs-confirmation: ""
---

# Secure development lifecycle with a security note per change, a controls index and an internal audit each release

## Context and problem statement

On 2026-10-11 Krister Johansson set secure-development and audit-readiness guidelines for NorthMES. The project should follow IEC 62443-4-1 (secure product development lifecycle), the development controls of ISO 27001 and SOC 2, and OpenSSF Best Practices, and align with ISA-95 where practical. When a third-party audit company audits NorthMES, the evidence must already be in the repository.

The internal audit of the same day found that most controls are decided. The decisions are spread over ADRs 0008, 0010, 0011, 0013, 0017, 0040, 0044, 0046, 0047, 0050 and 0051, plus plan 12. Some are built: row-level security, least-privilege database roles, secret files, masked errors, the strict CSP and hardened CI. Others exist on paper only: the audit trail, structured logs, `SECURITY.md`, the supply-chain checks and a threat model. Nothing tells a contributor or a coding agent what a change must do for security, and an auditor has no single entry point.

This ADR decides how every change, every release and the documentation keep NorthMES audit-ready. It covers all modules, the web, the CLI, plugins, CI and the docs.

## Decision drivers

* An auditor asks for evidence: what the control is, where it is implemented, and how it is tested. Promises do not count.
* One maintainer works with coding agents, so the rules must be checkable in review and in CI, not left to memory.
* The Cyber Resilience Act's vulnerability reporting applies since 11 September 2026 (ADR 0051), and customers ask NIS2 supply-chain questions.
* The rules must not slow release 1. They should reuse what exists: test first (ADR 0041), command contracts (ADR 0017), the audit trail (ADR 0013), and the validation impact of ADR 0051 rule 18.

## Considered options

* Adopt the guidelines as working rules, with the evidence kept in the repository and an internal audit before each release
* Keep the existing ADRs as they are and prepare the evidence when an audit is booked
* Seek an IEC 62443-4-1 certification for release 1

## Decision outcome

Chosen option: "Adopt the guidelines as working rules", because the evidence costs little to keep while each change is fresh and a lot to reconstruct later. A certification before the first customer would cost money and time the project does not have.

### Rules for every change

1. **Secure by default.**
   - Least privilege for users (permissions checked where the API acts, ADR 0010), for the database (`nm_app` without BYPASSRLS, row-level security on every module table, ADR 0008) and for containers (ADR 0044).
   - Secrets come from secret files and are never written in code, logs or errors (ADR 0060, ADR 0047).
   - Every input passes a Zod contract (ADR 0017).
   - SQL goes through Kysely with bound values. `sql.raw`, `sql.lit`, `sql.ref` and `sql.id` take literals only.
   - Errors that reach a client are masked and carry a code and a correlation id.
   - Cryptography uses the algorithms ADR 0047 names, and TLS 1.2 or later at the proxy (ADR 0044).
2. **A security note per change.**
   - Every pull request description has a Security section. It names the controls the change touches (authentication, permissions, row-level security, input, secrets, logging, dependencies, plugins, integrations) and the threat each one meets, or says "none" with a reason.
   - It extends the validation impact of ADR 0051 rule 18, and `.github/PULL_REQUEST_TEMPLATE.md` asks for it.
3. **Security tests come first.**
   - A change to a control comes with its test, written first (ADR 0041): a permission refusal, a row the policy hides, an input the contract refuses, a secret the config refuses.
4. **Major features update the threat model.**
   - A new surface, trust boundary or integration adds its row to `docs/security/threat-model.md` (#485) in the same pull request: its assets, its STRIDE threats and the controls that meet them.
   - An integration over OPC UA, MQTT or an ERP connector names its security mode, credentials and access lists in its ADR before code exists.
5. **Logs and audit trails.**
   - Security events follow ADR 0013 and ADR 0046: sign-in success and failure, sign-out, permission denials, role and user changes, configuration changes and lockouts.
   - Each event is a JSON line with a UTC time, the principal, the action, the result and the correlation id.
   - No password, token, secret or personal data goes in clear text.
   - Production facts stay traceable through the audit trail (ADR 0013, ADR 0051).
6. **Dependencies and supply chain.**
   - Exact versions and the 14-day release age (`pnpm-workspace.yaml`), the license gate, the SBOM (ADR 0040), the dependency audit and CodeQL (ADR 0050, #7, #197), and Renovate (#482).
   - A new dependency comes in its own pull request (AGENTS.md).
7. **Vulnerability management.**
   - `SECURITY.md` (#481) states how to report, the response target, the supported versions, the plugin trust model (ADR 0037) and the accepted risks.
   - Fixes ship as patch releases (ADR 0038, ADR 0051).
8. **Flag and decide.**
   - A change that adds a significant security or compliance risk says so in its Security section and asks the maintainer before it merges.
   - An accepted risk is recorded with its reason in the latest audit report and in `SECURITY.md`. When in doubt, the more secure option is chosen and the decision recorded.

### Documents an auditor reads

`docs/security/README.md` is the entry point:
- the controls index, mapping each guideline to the ADRs, code, tests and CI jobs that implement it, or to the issue that will;
- the threat model;
- the audit reports in `docs/security/audits/`;
- the hardening guidance for an installation (plan 12 and ADR 0044, until the install guide of ADR 0048 holds it).

The architecture and data flows stay in plan 02. The data models stay in plans 04 and 07, which use ISA-95 terms (ADR 0026, GLOSSARY.md).

### Internal audits

- Before each release, and at least each quarter, an audit reads the code, the CI and the documents against the controls index, as the audit of 2026-10-11 did.
- The report goes to `docs/security/audits/<date>.md`. Each finding becomes an issue under one tracking issue per audit, such as #473.
- The controls index is updated in the same pull request.
- A finding closes with a fix and its test, or as an accepted risk with the maintainer's reason.

### Consequences

* Good, because an auditor finds every control with its evidence through one page, and each claim points at code, a test or a CI job.
* Good, because contributors and coding agents get one list of rules, and reviewers and CodeRabbit can check the Security section in every pull request.
* Good, because the audit cadence turns "decided but not built" into tracked issues before a release ships.
* Bad, because every pull request gains a section to write, and every release gains an audit (estimated at half a day to a day).
* Bad, because the controls index must be kept current, or it misleads.

### Confirmation

* `test/meta/security-docs.test.ts`:
  * "ADR0076 the pull request template asks for a Security section and the validation impact";
  * "ADR0076 every control in the controls index has the status built, decided, gap or accepted";
  * "ADR0076 the controls index links every audit report, and each report links its tracking issue".
* A `pr security` check in `scripts/ci/`, run like `linked-issue.mjs` on every pull request, fails a pull request whose Security section is missing or empty. #513 adds it (M-87).
* The release workflow of ADR 0038 fails when no report in `docs/security/audits/` is newer than the previous release tag. A task adds it with the first release (M-86).
* `test/meta/security-policy.test.ts`: "ADR0076 SECURITY.md names a reporting channel, a response target and the plugin trust model", added by #481 (M-90).

## Pros and cons of the options

### Adopt the guidelines as working rules

* Good, because evidence is cheapest while the change is fresh.
* Good, because it reuses the existing ADRs instead of restating them.
* Bad, because it adds a little process to every pull request.

### Prepare when an audit is booked

* Good, because it costs nothing now.
* Bad, because rebuilding the evidence later is slow and error-prone, and gaps found then block the audit.

### Certify for release 1

* Good, because a certificate answers customers' questions at once.
* Bad, because an assessment costs money and weeks the project does not have before the pilot, and most controls are not built yet.

## More information

* Related ADRs: 0008, 0010, 0011, 0013, 0017, 0026, 0037, 0038, 0040, 0041, 0044, 0046, 0047, 0050, 0051.
* Plan: [12-operations-and-security.md](../plan/12-operations-and-security.md), [17-risks.md](../plan/17-risks.md).
* The first audit: [docs/security/audits/2026-10-11.md](../security/audits/2026-10-11.md), tracked in #473.
* Krister Johansson answered M-86 to M-90 on 2026-10-11 with the working defaults of plan 16.
* Revisit when a customer requires a certification, when the first audit company is booked, or when the regulated profile of ADR 0051 is switched on.
