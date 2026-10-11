# NorthMES

[![CI](https://github.com/northMES/northmes/actions/workflows/ci.yml/badge.svg)](https://github.com/northMES/northmes/actions/workflows/ci.yml)
[![CodeQL](https://github.com/northMES/northmes/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/northMES/northmes/actions/workflows/github-code-scanning/codeql)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/northMES/northmes/badge)](https://scorecard.dev/viewer/?uri=github.com/northMES/northmes)
[![License: AGPL-3.0-or-later](https://img.shields.io/badge/License-AGPL--3.0--or--later-blue.svg)](LICENSE)

NorthMES is an open source, developer-first manufacturing execution system. It plans production and follows it on the shop floor. Production planning is its first module: production orders and their operations, the job orders a planner places on machines, plant calendars, the planning board and a minimal operator station. It is built first for manufacturers without an ERP; an ERP connects through its own connector module. One installation serves one customer, on the customer's own server.

## Status

NorthMES is in development and has no release yet. The plan for release 1 is in [docs/plan](docs/plan/README.md), and the decisions behind it are in [docs/adr](docs/adr/README.md).

## Getting started

You need Node.js 26 (see `.node-version`), pnpm and Docker, which the tests and the dev stack use for Postgres.

```sh
pnpm install
pnpm dev      # Postgres in Docker, migrations, a seed and the app with live reload
pnpm check    # lint, typecheck, generated files and the unit, integration and web tests
pnpm e2e      # the end-to-end specs in Chromium against the built server
```

`pnpm dev` prints the address of the web app and the dev admin to sign in as. The dev passwords are in `scripts/stack/seed.mjs`; they only ever reach the dev and test databases.

## Where to read more

- [docs/plan](docs/plan/README.md): what NorthMES is, the modules, release 1 and the roadmap.
- [docs/adr](docs/adr/README.md): the architecture decisions.
- [docs/security](docs/security/README.md): the security controls with their evidence, and the audit reports.
- [GLOSSARY.md](GLOSSARY.md): the project's terms.
- [AGENTS.md](AGENTS.md): how work is done here, for people and coding agents.
- [SECURITY.md](SECURITY.md): how to report a vulnerability, and what happens next.

## License

The application is licensed under [AGPL-3.0-or-later](LICENSE). The SDK and contracts packages that plugins build on (`packages/sdk`, `packages/web-sdk`, `packages/contracts`, `packages/testing` and each module's contracts package) are licensed under MIT, so code built on them stays the author's own ([ADR 0039](docs/adr/0039-license-agpl-3-0-or-later-core-and-a-contributor-license-agreement.md), [ADR 0056](docs/adr/0056-mit-sdk-packages-the-extension-exception-and-the-trademark-policy.md)). Contributions come in under a contributor license agreement.
