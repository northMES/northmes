# Security policy

## Reporting a vulnerability

Please report a vulnerability privately. Do not open a public issue, pull request or discussion for it.

- Preferred: [GitHub private vulnerability reporting](https://github.com/northMES/northmes/security/advisories/new). Please include the affected component, the version or commit, the steps to reproduce and the impact; the form also takes the CWE and a severity if you know them.
- Or email security@northmes.dev with the same details.

Please give us a reasonable time to fix the issue before you disclose it, and do not access, change or delete data that is not yours while you test. Test against your own installation, never against a customer's.

## What happens next

- We acknowledge your report within 5 working days.
- We triage it within 10 working days: we confirm whether it is a vulnerability, rate its severity and tell you what we plan.
- We keep you informed while we fix it, and agree the disclosure date with you. We credit you in the advisory unless you prefer otherwise.
- A fix reaches customers as a patch release: an image-only release with no migrations, with a target of 72 hours from the fix to the customer bundle (ADR 0038, ADR 0051).
- We publish a GitHub security advisory for every confirmed vulnerability in a released version.
- The EU Cyber Resilience Act's vulnerability reporting obligations have applied since 11 September 2026. ADR 0051 records the readiness work. NorthMES's role under the Act, and with it the authority we report to, is still to be confirmed.

## Supported versions

NorthMES has no 1.0 release yet. Until 1.0, only the latest 0.x minor release gets security fixes. Once 1.0 ships, this table names the supported versions.

| Version | Supported |
|---|---|
| Latest 0.x minor | Yes |
| Older 0.x minors | No |

## Verify a release

Releases after 0.0.1 carry GitHub artifact attestations for the image: its build provenance and its CycloneDX SBOM, signed by `.github/workflows/release.yml` on `refs/heads/main` through GitHub Actions OIDC, on a GitHub-hosted runner (ADR 0050). Release 0.0.1 has none. Each later release also attaches the SBOM and the attestation bundles. The install guide, `apps/docs/install.mdx`, gives the `gh attestation verify` commands, also for a host without internet.

## Vulnerabilities that do not affect NorthMES

When a dependency has a known vulnerability that cannot reach NorthMES's code paths, the project publishes a `not_affected` statement with the reason in an OpenVEX document, [`docs/security/vex/northmes.openvex.json`](docs/security/vex/northmes.openvex.json). Each one is also an accepted risk in the [risk register](docs/security/risks.md) with a review date.

## Plugins run with full trust

A NorthMES plugin runs inside the server process and the web app with the same rights as NorthMES itself (ADR 0037, ADR 0068). NorthMES does not sandbox plugins. In release 1 the host operator installs a plugin with `npm install --ignore-scripts` into the plugin volume (ADR 0075), and the next restart loads it.

What a plugin can reach, its blast radius:

- **Data:** whatever the database role `nm_app` can read and write within the scopes of the current request. Row-level security still applies, so a plugin's queries see the companies and plants that the request's scopes allow, but nothing stops a plugin's code from opening a transaction with other scopes, as core's own code does.
- **Sessions and configuration:** the request's principal and token, the server's configuration and the secrets the server process holds.
- **The browser:** a plugin's screens run in the same page as NorthMES, so they can read the session token in `sessionStorage` and call the API as the signed-in user.
- **The host:** the server process's files and network access inside its container.

A plugin cannot reach what the server process cannot: `nm_owner`, the database admin password and the host outside the container. This is an accepted risk, with an owner and a review date, in the [risk register](docs/security/risks.md).

Install only plugins from publishers you trust, and review a plugin's inventory before you install it. A vulnerability in a third-party plugin belongs to its publisher; report it to them. If a plugin can break NorthMES's own controls, for example by reaching one company's data that core keeps apart from another's, report that to us as above.

## Scope

In scope: the code in this repository, the published NorthMES images and packages, and the default configuration they ship with.

Out of scope: an installation's own configuration and infrastructure (its host, network, proxy and backups), third-party plugins, and findings that need physical access to a plant's machines.

## How NorthMES handles security

The rules every change follows, the controls index and the internal audit reports are described in ADR 0076 and kept under `docs/security/`. The [threat model](docs/security/threat-model.md) lists the trust boundaries and the threats at each, and the [risk register](docs/security/risks.md) lists the limitations the project has accepted for now, with their reasons.
