# CodeRabbit

CodeRabbit is a GitHub App (`coderabbitai[bot]`) that reviews pull requests to `main`. It is installed on the `northMES` GitHub organization and covers the repository once the repository moves there. Its settings live in `.coderabbit.yaml` at the repository root. CodeRabbit reads that file from the branch under review, so a pull request that changes it is reviewed with its own new settings.

## What it checks

CodeRabbit reviews a pull request when it opens and again after every push, with no pause after a number of reviewed commits. It skips drafts, release PRs (`chore(main): release`) and PRs from `renovate[bot]` and `dependabot[bot]`. While the repository has fewer than 10 stars, CodeRabbit reviews only after an `@coderabbitai review` comment. The review profile is `chill`.

It does not review the lockfiles (`pnpm-lock.yaml`, `skills-lock.json`), the committed GraphQL snapshots (`schema/*.graphql`, `modules/*/schema.graphql`), `pnpm gen` output (`*.gen.ts`, `*.gen.css`, `modules/*/web/links.snapshot.json`), Vitest snapshots, generated reference docs under `apps/docs/reference`, `CHANGELOG.md`, the vendored skills in `.claude/skills`, or the internal research material, which is gitignored and filtered only in case a file is committed. CodeRabbit's own defaults also skip images (including `*.svg`), `*.csv`, `*.map` and directories named `generated`, `__generated__` or `gen`.

Path instructions tell it what to flag per area:

| Path | What CodeRabbit flags |
|---|---|
| `modules/*/server/**` | Writes outside a registered command handler, a write path without `can()` at the target's scope, writes outside the command's audit context, queries outside the scoped transaction helper, SQL on another module's schema, `sql.raw` and friends, `Date` query parameters, AI SDK calls outside `modules/ai/server/model-call.ts` |
| `modules/*/domain/**`, `modules/*/server/domain/**` | Imports of Nest, Kysely or `pg`, and use of `process.env` |
| `**/migrations/**/*.sql` | Missing expand or contract marker, a new table without row-level security and split policies, `FOR ALL` policies, write policies wider than the read policy, `TRUNCATE` grants, missing audit trigger or uuid `id`, secret-like columns, `CREATE INDEX CONCURRENTLY` advice |
| `modules/*/web/**`, `packages/ui/**` | WCAG 2.2 AA gaps (keyboard, single-pointer alternative to drag, 24 px targets, state by color alone, missing names and labels, focus hidden), live regions outside `announce()`, direct `@base-ui/*` or Radix imports, values that are not tokens |
| MIT packages (`packages/contracts`, `sdk`, `web-sdk`, `ui`, `web-build`, `testing`, `modules/*/contracts`) | Imports of AGPL code, a license field that is not MIT, breaking changes without `!` in the PR title |
| `**/*.test.{ts,tsx}`, `**/e2e/**` | A behaviour change without a test, a shared database instead of `@testcontainers/postgresql`, real AI calls outside `*.ai.test.ts` files and `pnpm test:e2e:ai` runs |
| `docs/adr/**` | Missing MADR front matter, a new ADR with a status other than `proposed`, Confirmation items that name no test, lint rule or CI check |
| `docs/**`, `**/*.md`, `.github/**/*.md`, `apps/docs/**/*.mdx` | Em and en dashes, Title Case headings, curly quotes, emojis, MDX components outside the portable subset |
| `.github/workflows/**` | Actions not pinned by SHA, broad permissions, `pull_request_target`, checkout without `persist-credentials: false`, event values interpolated into scripts |
| `.coderabbit.yaml` | Changes that drop a path instruction, exclude source, test or migration files, or turn off the request-changes workflow or incremental reviews |

Pre-merge checks only warn; they never block a merge. The title check asks for a Conventional Commit written for users, because the PR title becomes the changelog line. The linked issue check looks for out-of-scope changes. Three custom checks look for AGPL imports in MIT packages, new tables without row-level security, and source changes without a test change.

Tools that stay on include Biome, Squawk (Postgres migrations), actionlint, zizmor and the secret scanners. ESLint and Oxlint are off because the repository lints with Biome. SQLFluff and LanguageTool are off because the repository has no SQL layout rules and uses its own prose rules.

These features are off: poems, fortunes, label and reviewer suggestions, the finishing touches that commit code (docstrings, unit tests, simplify, autofix, CI fix, merge conflict resolution), issue enrichment and issue plans, automatic chat replies, and the legacy commit status. The CodeRabbit check run is on ([ADR 0065](../adr/0065-coderabbit-check-run-and-a-required-approval-on-main.md)): it shows the review's progress on the head commit, and a review error does not fail it.

## How it fits handoff

Every pull request gets the same CodeRabbit review, whoever opens it. The maintainer builds planned tasks with handoff ([the maintainer's handoff workflow](handoff/README.md)), and this section describes how a handoff run waits for that review. Contributors do not need any of it.

The PR node of each graph in `docs/agents/handoff/graphs/` (`northmes-guided`, `northmes-standard` and `northmes-lean`) sets:

```json
{ "waitForReviewers": ["coderabbitai[bot]"], "reviewTimeoutMinutes": 30, "sendReviewComments": true }
```

1. After each push the PR node waits for CI and for a review from `coderabbitai[bot]` on the head commit, up to `reviewTimeoutMinutes` from the push. It stops waiting for the review once CI has failed.
2. With 10 or more stars, CodeRabbit reviews each push by itself. While the repository has fewer than 10 stars, it reviews only on request: Krister or the operating session comments `@coderabbitai review` when the PR opens and after each later push from the PR node (a fix round, or the merge from `main` that the merge queue's update edge makes). handoff does not post the comment, and the coder has no `gh`. Without it, the node waits out the timeout and goes on without a review.
3. When the review arrives, handoff sends each unresolved thread and each review summary that is not an approval to the coder as requested changes, once. An approval sends nothing back.
4. The coder checks each finding against the issue and the linked ADRs, fixes the valid ones, and lists the rejected ones with the reason in the PR description. It cannot reply to or resolve threads.
5. On its next review CodeRabbit resolves the threads that the new commit addressed. It approves the head commit when that commit has a completed review, none of its own threads is open and no pre-merge check fails.
6. While the PR node waits after the coder's push, or before the merge request when CodeRabbit never reviewed the pull request, Krister reads the open threads and the coder's reasons. `@coderabbitai approve` resolves every CodeRabbit thread and asks CodeRabbit to approve the pull request. Threads from people are resolved by hand.
7. The `main` ruleset requires 1 approving review, dismisses an approval when a new commit is pushed, and requires resolved review threads ([ADR 0065](../adr/0065-coderabbit-check-run-and-a-required-approval-on-main.md)). On a pull request opened with Krister's token, CodeRabbit's approval of the head commit is that review, because GitHub does not let Krister approve his own pull request. While a review thread is open, handoff's merge step names the open threads and waits. Without an approval, GitHub refuses the merge and the merge step fails with `merge_failed`. While CodeRabbit's request for changes stands, GitHub reports it as the review decision, and the PR node sends the run back to the coder instead of on to the merge step.

CodeRabbit's check run reports the review's progress on the head commit. handoff counts a check named after a reviewer that is in progress as a started review, and the PR node's `reviewRequest` setting uses that to ask only a reviewer that has not started. The three graphs do not set `reviewRequest` yet. Once [pull request #209](https://github.com/northMES/northmes/pull/209) merges, the PR node asks CodeRabbit only when it has not started, and the check run lets handoff see a review in progress. The PR node also reads the whole check rollup of the head commit as CI status, so a CodeRabbit check that stays in progress holds the run with no time limit: `reviewTimeoutMinutes` applies only to the wait for a review. The check is not a required status check.

handoff opens every pull request with Krister's token, so every review counts against one GitHub identity. On the open source plan that identity gets 1 to 10 PR reviews per hour, depending on the repository's stars, and 100 to 300 files per review after path filters. Every push from the PR node uses one review, whether CodeRabbit starts it or a comment does. `@coderabbitai rate limit` shows what is left. A rate-limited push gets a comment from CodeRabbit and no review, so the PR node waits out its timeout.

## Commands

Post these as top-level comments on the pull request.

| Command | Effect |
|---|---|
| `@coderabbitai review` | Reviews the commits since the last review. Uses one review. |
| `@coderabbitai full review` | Reviews the whole pull request again. Uses one review. |
| `@coderabbitai approve` | Resolves all CodeRabbit threads and tries to approve. Approval needs `request_changes_workflow`, which is on. |
| `@coderabbitai resolve` | Resolves all CodeRabbit threads without approving. |
| `@coderabbitai rate limit` | Shows the remaining review allowance without using a review. |
| `@coderabbitai configuration` | Shows the settings in effect and where each one came from. |

## Moving to a lean graph

Krister's control over the first tasks comes from the gates of the `northmes-guided` graph. `docs/agents/handoff/README.md` lists the criteria for moving on to `northmes-standard` and `northmes-lean`. One of them is that CodeRabbit reviews every pull request without anyone posting `@coderabbitai review`; on the open source plan that starts at 10 stars. `.coderabbit.yaml` needs no change for the switch, because incremental reviews are already on and `auto_pause_after_reviewed_commits` is 0. In the lean graph CodeRabbit reviews every push from the PR node, resolves the threads the coder fixed and approves by itself, and Krister handles only the findings the coder rejected.

## Steps for Krister

1. CodeRabbit is installed on the `northMES` organization (done 2026-10-05). After the repository's transfer to `northMES`, check in the organization's CodeRabbit settings that the installation includes NorthMES; an installation limited to selected repositories needs the repository added.
2. Plan: do not buy a plan or add a payment method. Open source projects on public repositories get Team features for free. The docs also say a new organization starts on a 14-day Advanced trial; check which plan the dashboard shows for the organization.
3. Leave CodeRabbit's web settings at their defaults. Organization global overrides in the web UI take priority over `.coderabbit.yaml`; ordinary repository and organization settings in the UI rank below it.
4. The `main` ruleset requires 1 approving review, dismisses stale approvals on push and requires resolved threads (live since 2026-10-05, [ADR 0065](../adr/0065-coderabbit-check-run-and-a-required-approval-on-main.md)). Every open thread blocks the merge, threads from people included, and CodeRabbit's own threads close through its next review or `@coderabbitai approve`. Approve pull requests from `renovate[bot]` and `dependabot[bot]` and the release pull request yourself, because CodeRabbit skips them. On your own pull requests, which handoff and sessions open with your token, post `@coderabbitai approve` when CodeRabbit has not approved and you accept the head commit.
5. While the repository has fewer than 10 stars, post `@coderabbitai review` after every push from the PR node, or each round waits out the 30 minute timeout. To stop the PR node from waiting, remove `waitForReviewers` from the PR node in the graph files and import them again.
