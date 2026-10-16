# NorthMES agent guide

NorthMES is an open source, developer-first manufacturing execution system. This file is for any coding agent working in this repository (Claude Code reads it through `CLAUDE.md`).

The plan lives in `docs/plan/`, the architecture decisions in `docs/adr/` (index in `docs/adr/README.md`) and the project's terms in `GLOSSARY.md`. Before changing an area, read the ADRs that cover it and use the glossary terms in names, tests and issues.

## Working rules

- Test-driven, one behaviour at a time: write its failing test, make it pass, then refactor.
- Each integration and end-to-end test run starts its own Postgres with `@testcontainers/postgresql`.
- Each page state that the end-to-end specs reach, loading and empty states included, runs `checkA11y` from `e2e/fixtures.ts` in at least one spec, so a WCAG 2.2 AA violation fails it (ADR 0021). An axe exclusion needs a linked issue and an expiry date.
- Tests call the mocked AI provider. Tests against a real model live in `*.ai.test.ts` and run only through `pnpm test:ai` or `pnpm test:e2e:ai`.
- Generated files (schema snapshots, link snapshots, `*.gen.*` files, the lockfile) are rebuilt with the command that owns them, also when resolving a merge conflict.
- Run every command as `pnpm` or `git` from the repository root, through a root script, `pnpm --filter` or `pnpm -C`.
- Start the subject of a commit that adds a failing test with `test:`.
- Name and place web components and screens by the "Naming and folders" section of `.claude/skills/web-module/SKILL.md`.
- Compute and format dates and times with Luxon, every `DateTime` in an explicit zone (ADR 0082). `Date.now()` stays the clock source, a `Date` that a library hands over becomes a `DateTime` where it arrives, and `scripts/lint/date-time.allow.json` lists the other `Date` uses with their reasons.
- Bring a new dependency in its own pull request, at a version older than Renovate's `minimumReleaseAge` window.
- Do not run react-doctor, through `pnpm react-doctor` or any other command: it runs in CI only (`CI / react doctor`) until its vendor confirms that agents may run it (ADR 0040).
- Packages published under MIT (`packages/sdk`, `packages/web-sdk`, `packages/ui`, `packages/contracts`, `packages/testing`, every `modules/*/contracts` package and the generator package) import only MIT or other permissive code, never the AGPL modules.

## Security

NorthMES keeps itself ready for a third-party audit (IEC 62443-4-1, the ISO 27001 and SOC 2 development controls, OpenSSF Best Practices). [ADR 0076](docs/adr/0076-secure-development-lifecycle-with-a-security-note-per-change-a-controls-index-and-an-internal-audit-each-release.md) holds the rules, and `docs/security/README.md` is the controls index.

- Least privilege everywhere: check the permission where the API acts, read through row-level security as `nm_app`, and never use `nm_owner` at run time.
- Secrets come from secret files only. Never put a secret, token, password or personal data in code, a log line, an error or a test fixture that ships.
- Every input passes a Zod contract. SQL goes through Kysely with bound values, and `sql.raw`, `sql.lit`, `sql.ref` and `sql.id` take literals only.
- A client sees a masked error with a code and a correlation id, never a stack trace or an internal detail.
- A change to a control starts with its security test: a refused permission, a hidden row, a refused input.
- Every pull request description has a Security section. It names the controls the change touches and the threat each one meets, or says "none" with a reason.
- A new surface, trust boundary or integration adds its row to the threat model. A change that adds a significant security or compliance risk says so and waits for the maintainer.

## Scope

Deliver what the task or issue asks, at the scope it intends. Make routine judgment calls yourself, and ask only when different readings of the request would lead to materially different work. If the request looks mistaken or a better approach exists, say so in one sentence and continue as asked. Finish the whole task and stop there; note follow-up ideas in the pull request description.

When an issue names a seam (the module boundary or interface to build at), build at that seam.

Review happens on the pull request (CI, CodeRabbit and the maintainer), so hand the work over once `pnpm check` passes.

## Subagents

Delegate to a subagent only for large, independent tracks of work, such as a wide investigation across many files. Work you can finish in a handful of tool calls stays with you, and one subagent beats several when one can do the job.

## Writing

ADRs, plan documents, docs pages and pull request descriptions are as long as the substance needs: no filler sections, repeated summaries or boilerplate. Write plain technical prose with sentence-case headings, and use commas, colons, periods or parentheses where a dash would go. New ADRs follow `docs/adr/template.md` with status `proposed`. Pull request titles are Conventional Commits written for users, for example `feat(planning): ...`.
