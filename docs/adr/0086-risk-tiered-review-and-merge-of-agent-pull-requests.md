---
status: "proposed"
date: 2026-10-21
decision-makers: Krister Johansson
consulted: GitHub documentation on rulesets, CODEOWNERS and auto-merge; CodeRabbit configuration reference (auto_review.labels); Claude Code documentation on auto mode; OpenSSF Scorecard checks; published practice on risk-based merge of agent pull requests (Vercel, April 2026; Rewind); a review of the change in a fresh context
informed: contributors and coding agents
release: "1"
needs-confirmation: "maintainer (the review machinery in .github/risk-paths and the blast-radius tier rule, decided 2026-10-22; Risk refresh and auto-merge for every tier, decided 2026-10-22; the shadow phase and when it ends; the switch of the main ruleset to code owner review on the risk paths only, with risk gate required from the GitHub Actions app; the lower OpenSSF Scorecard Code-Review and Branch-Protection scores; accepted risk A-08, recorded with the switch)"
---

# Risk-tiered review and merge of agent pull requests

## Context and problem statement

Since ADR 0084 every pull request to `main` waits for the maintainer: `.github/CODEOWNERS` names him for every path and the `main` ruleset requires code owner review. CodeRabbit reviews every agent pull request on top of the session's own fresh-context review. A typo fix and a row-level security policy take the same path, so the maintainer reviews many changes that would do little harm if they were wrong, agent sessions stop at every pull request, and CodeRabbit's review allowance goes to changes that do not need it.

This ADR decides how a pull request is sorted by the harm a wrong merge would do, which pull requests merge without the maintainer, and which ones CodeRabbit reviews. It covers `.github/risk-paths`, `.github/workflows/risk.yml`, the blast-radius subagent, `.github/CODEOWNERS`, `.coderabbit.yaml`, the `main` ruleset and the session instructions in `CLAUDE.md` and `AGENTS.md`.

## Decision drivers

* Agent sessions should finish their work without the maintainer when a wrong change would be visible, contained and undone by a revert.
* A change that could destroy or corrupt customer data, or open a way into the system nobody checked, still needs a person outside the session (IEC 62443-4-1, ISO 27001 8.32, ADR 0051 rule 18). The blast-radius review judges which changes those are (Krister, 2026-10-22).
* Prompt injection is expected (ADR 0084): an injected session must not be able to talk a change to the review machinery into the low tier.
* The rule has to be checkable by an auditor from the repository.

## Considered options

* Keep the maintainer's approval on every pull request (ADR 0084 rule 5)
* Let the session's own judgment decide which pull requests merge alone
* A deterministic floor from changed paths and the validation impact, raised by a fresh-context blast-radius review, enforced by GitHub and a check that runs from the default branch
* A Claude review in CI that classifies every pull request

## Decision outcome

Chosen option: "A deterministic floor from changed paths and the validation impact, raised by a fresh-context blast-radius review", because the review machinery's floor is enforced outside the session: GitHub's code owner review on the risk paths, and a check that reads its rules from the default branch.

The fixed floor covers the review machinery only (Krister, 2026-10-22): the files that decide how a pull request is judged and merged, and what agent sessions are told and allowed to do. Whether any other change is high, docs, ADRs, dependencies, migrations and access code included, is the blast-radius review's judgment: could a wrong version destroy or corrupt customer data, open an unchecked way in or weaken a check, or does the change not feel right to it? A session cannot loosen the machinery by declaring a low tier. A wrong low tier elsewhere is accepted risk A-08.

1. **Two tiers.** A pull request is high when any of these holds, and low otherwise:
   * it changes, or renames a file out of, a path in `.github/risk-paths`, which names the review machinery: `.github/`, `scripts/ci/`, `scripts/agents/`, `test/meta/`, `.claude/`, `CLAUDE.md`, `AGENTS.md` and `skills-lock.json`;
   * its Validation impact (ADR 0051 rule 18) names anything other than none or UI only (records, security, calculation, data migration, or a value the gate cannot read), or it has no Validation impact section;
   * a Tier line in its Blast radius section says `Tier: high`, or the section has no Tier line;
   * its title marks a breaking change with `!`;
   * `northmes-agent` did not open it;
   * it changes more files than GitHub lists.
2. **The blast-radius review.** Before the pull request opens, the session gives the `blast-radius` subagent (`.claude/agents/blast-radius.md`) the issue, the branch, the intent and the Validation impact. In a fresh context, with read-only tools and the Bash guard of the code-reviewer agent, it answers what breaks for whom, whether a revert undoes it, how far the change reaches, which test would catch a wrong version and which controls it touches. It returns the `## Blast radius` section of the pull request, ending in `Tier: low` or `Tier: high`. Outside the review machinery its Tier line decides; it never lowers the tier below rule 1's other conditions. For a high tier it ends with a `For the reviewer:` list of the places to look, as `path:line`.
3. **The risk gate.** `Risk / risk gate` (`.github/workflows/risk.yml`, `scripts/ci/risk-gate.mjs`) runs on every pull request and review. It downloads the check and `.github/risk-paths` from the default branch and runs them without a checkout, as `CI / cla` does, so a pull request cannot change the script or the paths that judge it. GitHub runs a pull request's own copy of `risk.yml`, so the workflow file itself is protected by code owner review on `.github/`, which is a risk path; the machine user's token cannot change a workflow at all (ADR 0084 rule 4). It labels the pull request `risk:low` or `risk:high`, writes the reasons into the job summary, passes a low pull request, and passes a high one only once the maintainer's latest review approves its head commit. GitHub keeps the failed check of the run from before the approval next to the passing one, so `Risk refresh` (`.github/workflows/risk-refresh.yml`) re-runs the failed pull request runs of Risk at the head commit once a run that a review started passes. It is a `workflow_run` workflow, so it runs from the default branch.
4. **Shadow phase.** The gate, the labels and the Blast radius section start while CODEOWNERS still names the maintainer for every path, so he reviews every pull request and notes where he disagrees with the tier. The switch in rule 5 follows when he is satisfied with the tiers, in a pull request of its own.
5. **The switch.**
   * `.github/CODEOWNERS` names the maintainer for the patterns of `.github/risk-paths` only, and a meta test keeps the two lists equal.
   * The `main` ruleset requires 0 approvals, keeps code owner review, conversation resolution and stale review dismissal, and requires `risk gate` from the GitHub Actions app, so a status set by another integration or a token does not satisfy it. With 0 required approvals GitHub does not enforce code owner review: a probe pull request on a risk path on 2026-10-22 had the maintainer requested as code owner and no required review ([#808](https://github.com/northMES/northmes/pull/808)). CODEOWNERS still requests his review on the risk paths.
   * Auto-merge is turned on for the repository.
   * Right after its pull request opens, a session runs one project script, `pnpm agent:auto-merge <number>`, whatever the tier. It refuses unless `northmes-agent` opened the pull request against `main`, where the ruleset applies, and turns on auto-merge, so GitHub merges once every required check passes. For a high pull request it also asks the maintainer to review, comments with the gate's reasons and the Blast radius section, and asks CodeRabbit to review, so the pull request merges by itself once the maintainer approves its head commit. The required `risk gate` is the control: it stays failed on a high pull request until that approval. The deny rule `Bash(gh pr merge*)` stays, so a session never merges directly.
   * The maintainer adds an `autoMode.allow` entry for that script to his `~/.claude/settings.json`, because merging a pull request no person approved is one of auto mode's default blocks.
6. **CodeRabbit.** After the switch CodeRabbit reviews high pull requests only: `reviews.auto_review.enabled: false` with `reviews.auto_review.labels: ["risk:high"]`, and the project script posts `@coderabbitai review` on a high pull request.

### Changes to ADR 0050, ADR 0065 and ADR 0084

ADR 0050 is accepted, so its text stays as it was. ADR 0065 and ADR 0084 are proposed and point here. From the switch in rule 5, this ADR replaces these parts, and the rest of each stands.

| Line | Replaced by |
|---|---|
| ADR 0050: auto-merge is off | Auto-merge is on; a session turns it on for every pull request it opens through the project script |
| ADR 0065: every pull request needs one approving review | A high pull request, one that touches a risk path included, needs the maintainer's approval through the required `risk gate` |
| ADR 0065: CodeRabbit reviews every agent pull request | CodeRabbit reviews high pull requests |
| ADR 0084 rule 5: CODEOWNERS names the maintainer for every path, and agents do not merge | CODEOWNERS names the maintainer for the risk paths; a session turns on auto-merge through the project script, which merges at once only a pull request whose required checks have all passed |
| ADR 0084 driver: a change to `main` needs a human reviewer outside the session | A high change to `main` needs one; a low change is reviewed by two fresh-context subagents and the deterministic gate |

### Consequences

* Good, because a low pull request merges when its checks pass, so agent sessions finish without waiting for the maintainer.
* Good, because the maintainer's and CodeRabbit's attention goes to the changes where a mistake costs the most.
* Good, because the review machinery, the gate included, is on the risk paths and the gate runs from the default branch, so a pull request cannot loosen how pull requests are judged.
* Bad, because a low change with a defect reaches `main` without a person reading it (accepted risk A-08, which the risk register records with the switch). Tests, the two fresh-context reviews and a revert bound the harm.
* Bad, because the maintainer's own pull requests are always high and he cannot approve them himself, so they go through agent sessions as ADR 0084 says. The gate names one maintainer by user id, and a second maintainer needs a change to it.
* Bad, because OpenSSF Scorecard counts a merge without a human review against Code-Review, and 0 required approvals scores lower on Branch-Protection.
* Bad, because outside the review machinery the tier rests on the blast-radius review's judgment, so a session that judges a harmful change low, by mistake or on an injected instruction, merges it without a person reading it. CI, the dependency audit, the license gate and a revert bound the harm; a migration that drops data is the case a revert does not undo.

### Confirmation

`scripts/ci/risk-gate.test.ts` covers each rule of the tier and the approval, and checks that the repository's `.github/risk-paths` names exactly the review machinery. `test/meta/workflows.test.ts` checks that the risk gate runs from the default branch without a checkout, and that `Risk refresh` re-runs earlier runs one at a time, only after a passing review run and only while the commit is the head. `scripts/agents/auto-merge.test.ts` checks the one step after the pull request opens. `test/meta/agent-files.test.ts` checks the blast-radius agent's tools, guard and Tier line. After the switch, a meta test keeps CODEOWNERS equal to `.github/risk-paths`.

## Pros and cons of the options

### Keep the maintainer's approval on every pull request

* Good, because every change has a human reviewer.
* Bad, because agent sessions stop at every pull request, which is the problem this ADR solves.

### Let the session's own judgment decide

* Good, because it needs no new CI.
* Bad, because a prompt injection in an issue or a comment could ask for the low tier, and nothing outside the session would catch it. The chosen option accepts this outside the review machinery (A-08) and keeps a fixed floor for the machinery itself.

### A deterministic floor raised by a fresh-context blast-radius review

* Good, because the session's judgment adds caution where the paths cannot see the harm. Since 2026-10-22 it also decides the tier outside the review machinery.
* Good, because it costs no API key and no CI model calls.
* Neutral, because the blast-radius review runs in the same session's environment as the author, so its independence is a fresh context, not a separate trust zone.
* Bad, because two places name the risky paths until the meta test ties CODEOWNERS to `.github/risk-paths`.

### A Claude review in CI that classifies every pull request

* Good, because it runs outside the session that wrote the change.
* Bad, because it needs an Anthropic API key as a repository secret and costs per pull request, and it adds a trust boundary to the threat model.

## More information

ADR 0049 already kept tasks that touch authentication, row-level security or secrets on handoff's guided graph; `.github/risk-paths` was the same idea for pull requests, and since 2026-10-22 it keeps only the governance files, leaving authentication, secrets and data to the blast-radius review. Vercel reported in April 2026 that an agent reviews and merges a majority of the pull requests in its largest monorepo without a human reviewer, based on a classifier of the diff's blast radius. Rewind's write-up on AI-approved pull requests describes the same split: the model's findings feed a deterministic verdict, and a protected policy file forces a human for authentication, secrets, infrastructure and governance files. Revisit when a second maintainer joins, or when a low pull request causes an incident.
