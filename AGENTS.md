# NorthMES agent guide

NorthMES is an open source, developer-first manufacturing execution system. This file is for any coding agent working in this repository (Claude Code reads it through `CLAUDE.md`).

The plan lives in `docs/plan/`, the architecture decisions in `docs/adr/` (index in `docs/adr/README.md`) and the project's terms in `GLOSSARY.md`. Before changing an area, read the ADRs that cover it and use the glossary terms in names, tests and issues.

## Working rules

- Test-driven, one behaviour at a time: write its failing test, make it pass, then refactor.
- Each integration and end-to-end test run starts its own Postgres with `@testcontainers/postgresql`.
- Tests call the mocked AI provider. Tests against a real model live in `*.ai.test.ts` and run only through `pnpm test:ai` or `pnpm test:e2e:ai`.
- Generated files (schema snapshots, link snapshots, `*.gen.*` files, the lockfile) are rebuilt with the command that owns them, also when resolving a merge conflict.
- Run every command as `pnpm` or `git` from the repository root, through a root script, `pnpm --filter` or `pnpm -C`.
- Start the subject of a commit that adds a failing test with `test:`.
- Bring a new dependency in its own pull request, at a version older than Renovate's `minimumReleaseAge` window.
- Do not run react-doctor, through `pnpm react-doctor` or any other command: it runs in CI only (`CI / react doctor`) until its vendor confirms that agents may run it (ADR 0040).
- Packages published under MIT (`packages/sdk`, `packages/web-sdk`, `packages/ui`, `packages/contracts`, `packages/web-build`, `packages/testing`, every `modules/*/contracts` package and the generator package) import only MIT or other permissive code, never the AGPL modules.

## Scope

Deliver what the task or issue asks, at the scope it intends. Make routine judgment calls yourself, and ask only when different readings of the request would lead to materially different work. If the request looks mistaken or a better approach exists, say so in one sentence and continue as asked. Finish the whole task and stop there; note follow-up ideas in the pull request description.

When an issue names a seam (the module boundary or interface to build at), build at that seam.

Review happens on the pull request (CI, CodeRabbit and the maintainer), so hand the work over once `pnpm check` passes.

## Subagents

Delegate to a subagent only for large, independent tracks of work, such as a wide investigation across many files. Work you can finish in a handful of tool calls stays with you, and one subagent beats several when one can do the job.

## Writing

ADRs, plan documents, docs pages and pull request descriptions are as long as the substance needs: no filler sections, repeated summaries or boilerplate. Write plain technical prose with sentence-case headings, and use commas, colons, periods or parentheses where a dash would go. New ADRs follow `docs/adr/template.md` with status `proposed`. Pull request titles are Conventional Commits written for users, for example `feat(planning): ...`.
