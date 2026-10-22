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

A session that opens its own pull request reviews its diff first; in a handoff run the graph's code review step does this instead. Once `pnpm check` passes, the `code-reviewer` subagent (`.claude/agents/code-reviewer.md`) reviews the branch's diff in a fresh context: the code-review skill at level high with every finding kept, against the issue's acceptance criteria and the ADRs it links; the `.coderabbit.yaml` path instructions whose globs match the changed files; the edge cases the changed code's input types allow; the security skills the diff calls for; and Context7 for library behaviour a finding depends on. Give it the issue, the branch and what the change intends. Fix each finding that holds, test first, and run `pnpm check` again before you push. The review is done when the pull request's Checks section lists every finding with its outcome: fixed, not changed with the reason, or a follow-up issue.

On the final diff, the `blast-radius` subagent (`.claude/agents/blast-radius.md`) judges in a fresh context how much harm the change would do if it merged and turned out wrong. Give it the issue, the branch, what the change intends and the Validation impact, and put what it returns under the pull request's `## Blast radius` section unchanged, its `Tier:` line included. `Risk / risk gate` reads that line with `.github/risk-paths` from the default branch and labels the pull request `risk:low` or `risk:high` ([ADR 0086](docs/adr/0086-risk-tiered-review-and-merge-of-agent-pull-requests.md)). A red risk gate on a high pull request waits for the maintainer's approval; never change the Tier line or the Validation impact to turn it green.

Once the risk gate passes on a low pull request, run `pnpm agent:auto-merge <number>`, and GitHub squash-merges it when every required check passes. The script refuses a high pull request. On a high pull request, post `@coderabbitai review`, answer its threads with fixes or evidence, and leave the merge to the maintainer. Never merge directly, by `gh pr merge` or through the API.

## Sandbox

Sessions run inside the Claude Code sandbox, in auto mode or, when nobody watches, in bypass mode ([ADR 0087](docs/adr/0087-unattended-agent-sessions-in-bypass-mode-inside-the-sandbox-with-installs-from-mains-manifests.md)), and act on GitHub as the `northmes-agent` machine user ([ADR 0084](docs/adr/0084-agent-sessions-in-auto-mode-inside-the-claude-code-sandbox-with-their-own-github-identity-and-the-maintainers-approval-on-main.md); setup in `docs/agents/agent-isolation.md`). A command the sandbox refuses stays refused: report what it needed instead of working around it. `pnpm install` fails inside the sandbox; the maintainer's install hook runs it after a session starts or runs git, when every dependency file equals `main`. A branch that changes a dependency file waits for the maintainer's install. Only GitHub merges, through the auto-merge that `pnpm agent:auto-merge` turns on for a low pull request.
