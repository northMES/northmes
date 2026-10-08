@AGENTS.md

## Claude Code skills

The third-party skills in `.claude/skills/` are pinned in `skills-lock.json`, with each source's license in `.claude/skills/THIRD_PARTY_LICENSE.md`. The project skills next to them are NorthMES's own recipes and have no lock entry. Domain docs and the ADR format they use: `docs/agents/domain.md`.

- tdd and codebase-design: use them for every code change.
- db-test (project skill): tests against Postgres, fixtures through db.command, test apps through createTestApp, and the meaning of a migrate or row-level security error.
- vitest, pnpm and turborepo: tests, workspace settings and task wiring.
- apollo-client: web data code. playwright-cli: end-to-end specs and checking a UI change in a browser.
- wrdn-authz and secret-serialization: reviews of permissions and of code that holds secrets. Row-level security with transaction-local scopes counts as tenant scoping.
- diagnosing-bugs: a bug report or a performance regression.
- grilling, grill-me, grill-with-docs and domain-modeling: interactive planning sessions with a person who can answer.
- TanStack Table v9: read the skills that ship in `node_modules/@tanstack/table-core/skills/` and `node_modules/@tanstack/react-table/skills/`, which match the installed version.

Where a skill's example differs from an ADR, follow the ADR. Run every tool through pnpm from the repository root, Playwright as `pnpm exec playwright`, and install nothing globally; `.claude/settings.json` denies `npm` and `npx`.
