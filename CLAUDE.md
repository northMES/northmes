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

A session that opens its own pull request reviews its diff first; in a handoff run the graph's code review step does this instead. Once `pnpm check` passes, the `code-reviewer` subagent (`.claude/agents/code-reviewer.md`) reviews the branch's diff in a fresh context: the code-review skill at level high against the issue's acceptance criteria and the ADRs it links, the security skills the diff calls for, and Context7 for library behaviour a finding depends on. Give it the issue, the branch and what the change intends. Fix each finding that holds, test first, and run `pnpm check` again before you push. The review is done when the pull request's Checks section lists every finding with its outcome: fixed, not changed with the reason, or a follow-up issue.

On the final diff, the `blast-radius` subagent (`.claude/agents/blast-radius.md`) judges in a fresh context how much harm the change would do if it merged and turned out wrong. Give it the issue, the branch, what the change intends and the Validation impact, and put what it returns under the pull request's `## Blast radius` section unchanged, its `Tier:` line included. `Risk / risk gate` reads that line with `.github/risk-paths` (the review machinery) from the default branch and labels the pull request `risk:low` or `risk:high` ([ADR 0086](docs/adr/0086-risk-tiered-review-and-merge-of-agent-pull-requests.md)). A red risk gate on a high pull request waits for the maintainer's approval; never change the Tier line or the Validation impact to turn it green.

Right after the pull request opens, run `pnpm agent:auto-merge <number>` once, whatever the tier. It turns on auto-merge, so GitHub squash-merges the pull request when every required check passes. For a high pull request it also asks the maintainer to review, posts the reasons and the Blast radius section as a comment, and asks CodeRabbit to review; the pull request then merges by itself once the maintainer approves. After that, only a failing check or a review comment needs you: fix it and push. Never merge any other way, by `gh pr merge` or through the API; the script merges at once only a pull request whose required checks, the risk gate included, have all passed.

## Sandbox

Sessions run inside the Claude Code sandbox, in auto mode or, when nobody watches, in bypass mode ([ADR 0087](docs/adr/0087-unattended-agent-sessions-in-bypass-mode-inside-the-sandbox-with-installs-inside-the-sandbox.md)), and act on GitHub as the `northmes-agent` machine user ([ADR 0084](docs/adr/0084-agent-sessions-in-auto-mode-inside-the-claude-code-sandbox-with-their-own-github-identity-and-the-maintainers-approval-on-main.md); setup in `docs/agents/agent-isolation.md`). A command the sandbox refuses stays refused: report what it needed instead of working around it. In a worktree under `.claude/worktrees/`, run `pnpm install --frozen-lockfile` yourself: it runs inside the sandbox, with pnpm's store and virtual store in `/private/tmp/claude-501`, which a hook in the maintainer's user settings sets. If `$pnpm_config_virtual_store_dir` is empty, or the session runs in the main checkout, do not install; say so and stop. Only GitHub merges, through the auto-merge that `pnpm agent:auto-merge` turns on.
