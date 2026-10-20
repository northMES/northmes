@AGENTS.md

## Claude Code skills

The third-party skills in `.claude/skills/` are pinned in `skills-lock.json`, with each source's license in `.claude/skills/THIRD_PARTY_LICENSE.md`. The project skills next to them are NorthMES's own recipes and have no lock entry. Domain docs and the ADR format they use: `docs/agents/domain.md`.

- tdd and codebase-design: use them for every code change.
- db-test (project skill): tests against Postgres, fixtures through db.command, test apps through createTestApp, and the meaning of a migrate or row-level security error.
- vitest, pnpm and turborepo: tests, workspace settings and task wiring.
- apollo-client: web data code. playwright-cli: end-to-end specs and checking a UI change in a browser.
- wrdn-authz and secret-serialization: reviews of permissions and of code that holds secrets. Row-level security with transaction-local scopes counts as tenant scoping.
- security-audit: the internal audit before each release (ADR 0076) and a full vulnerability audit of an area. The full audit runs only from an interactive session, never from a handoff run. Its output directory stays outside the repository. The release audit report in `docs/security/audits/<date>.md` takes the skill's coverage statement and its findings that are not exploitable vulnerabilities, each as an issue under the audit's tracking issue. A confirmed vulnerability goes to a private security advisory as `SECURITY.md` says, never to a public issue, and the report records it without detail until the advisory is published.
- diagnosing-bugs: a bug report or a performance regression.
- grilling, grill-me, grill-with-docs and domain-modeling: interactive planning sessions with a person who can answer.
- TanStack Table v9: read the skills that ship in `node_modules/@tanstack/table-core/skills/` and `node_modules/@tanstack/react-table/skills/`, which match the installed version.

Where a skill's example differs from an ADR, follow the ADR. Run every tool through pnpm from the repository root, Playwright as `pnpm exec playwright`, and install nothing globally; `.claude/settings.json` denies `npm` and `npx`.

## Review before the pull request

A session that opens its own pull request reviews its diff first; in a handoff run the graph's code review step does this instead. Once `pnpm check` passes, a subagent with a fresh context reviews the branch's diff with the code-review skill at level high, against the issue's acceptance criteria and the ADRs it links. When the diff touches permissions, row-level security or secrets, the review adds wrdn-authz and secret-serialization; when it changes authentication, a trust boundary or an integration, it adds a focused security-audit review. Fix each finding that holds, test first, and run `pnpm check` again before you push. The review is done when the pull request's Checks section lists every finding with its outcome: fixed, not changed with the reason, or a follow-up issue. CodeRabbit and the maintainer then review the pull request as [ADR 0065](docs/adr/0065-coderabbit-check-run-and-a-required-approval-on-main.md) says.

## Sandbox

Sessions run in auto mode inside the Claude Code sandbox and act on GitHub as the `northmes-agent` machine user ([ADR 0084](docs/adr/0084-agent-sessions-in-auto-mode-inside-the-claude-code-sandbox-with-their-own-github-identity-and-the-maintainers-approval-on-main.md); setup in `docs/agents/agent-isolation.md`). A command the sandbox refuses stays refused: report what it needed instead of working around it. `pnpm install` fails inside the sandbox, so a worktree that needs a new install waits for the maintainer to run it. Agents never merge a pull request.
