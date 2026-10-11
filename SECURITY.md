# Security policy

Thank you for helping keep NorthMES and the plants that run it safe.

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

NorthMES has no release yet. Until 1.0, only the latest minor release gets security fixes. Once 1.0 ships, this table names the supported versions.

| Version | Supported |
|---|---|
| Latest 0.x minor | Yes |
| Older 0.x minors | No |

## Plugins run with full trust

A NorthMES plugin runs inside the server process and the web app with the same rights as NorthMES itself (ADR 0037, ADR 0068). It can read the database through the application's role, the configuration and the users' sessions. NorthMES does not sandbox plugins.

Install only plugins from publishers you trust, and review a plugin's inventory before you install it. A vulnerability in a third-party plugin belongs to its publisher; report it to them. If a plugin can break NorthMES's own controls, for example by reaching one company's data that core keeps apart from another's, report that to us as above.

## Scope

In scope: the code in this repository, the published NorthMES images and packages, and the default configuration they ship with.

Out of scope: an installation's own configuration and infrastructure (its host, network, proxy and backups), third-party plugins, and findings that need physical access to a plant's machines.

## How NorthMES handles security

The rules every change follows, the controls index and the internal audit reports are described in ADR 0076 and kept under `docs/security/`. Known limitations that the project has accepted for now are listed with their reasons in the latest audit report there.
