// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// `pnpm repo:check-ruleset`: compares the required status checks of the main ruleset with the jobs
// of the workflows (docs/adr/0069-require-each-ci-job-as-a-status-check-on-main.md). It names each
// job the ruleset does not require, each required check that no job reports any more, and each
// check required from the wrong app, checks that the ruleset is active on main and merges through
// a merge queue that squashes (ADR 0093), and exits 1 when it finds a problem. It reads the workflows of the working tree, so run
// it on an up-to-date main: before a change that renames, adds or removes a job, to start from a
// clean match, and after the merge and the ruleset edit that follow it. Between the edit just
// before the merge and the merge itself it names the jobs that the merge renames or removes.
//
// It reads the ruleset through `gh api`, with the login of the gh CLI that runs it, which needs
// read access to the repository: the maintainer's login and the northmes-agent token both read it.
// Only the ruleset's bypass list needs write access to the ruleset, and the script does not read
// it. The script changes nothing: a person edits the ruleset (ADR 0069).

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const repository = 'northMES/northmes';
const mainRuleset = 24515911;

// The GitHub Actions app, which reports every workflow job.
const githubActions = 15368;

// The checks the ruleset requires that no workflow of this repository runs, by the app that
// reports them. None since ADR 0093: CodeQL runs as the job codeql of codeql.yml, so that it
// reports on merge queue commits too, which code scanning's default setup does not.
const otherApps = new Map();

/** The workflow files whose jobs the main ruleset requires; test/meta/workflows.test.ts reads it. */
export const workflowFiles = ['ci.yml', 'pr.yml', 'risk.yml', 'supply-chain.yml', 'codeql.yml'];

// Jobs the ruleset may require but does not have to. cla joins before the first outside pull
// request (ADR 0039), e2e when #281 lands; openapi diff fails a pull request through pr gate and
// e2e through gate; risk label only labels the pull request (ADR 0086); pull request only reads
// the pull request for the other PR jobs, which fail without it (ADR 0093).
const optional = new Set(['cla', 'e2e', 'openapi diff', 'risk label', 'pull request']);

// The ref patterns that name main in a ruleset's condition; main is the default branch.
const mainRefs = new Set(['~DEFAULT_BRANCH', '~ALL', 'refs/heads/main']);

/**
 * The problems of the main ruleset's enforcement, target and required status checks against the
 * workflows' jobs.
 * @param {{ enforcement?: string, conditions?: { ref_name?: { include?: string[], exclude?: string[] } }, rules?:{ type: string, parameters?: { merge_method?: string, required_status_checks?: { context: string, integration_id?: number }[] } }[] }} ruleset
 * @param {{ file: string, jobs: Record<string, { name?: string }> }[]} workflows
 * @returns {string[]} one line per problem, none when the ruleset matches
 */
export function checkRuleset(ruleset, workflows) {
  const problems = [];
  if (ruleset.enforcement !== 'active') {
    problems.push(
      `enforcement is ${ruleset.enforcement}, not active, so the ruleset blocks no merge.`,
    );
  }
  const { include = [], exclude = [] } = ruleset.conditions?.ref_name ?? {};
  if (!include.some((ref) => mainRefs.has(ref)) || exclude.some((ref) => mainRefs.has(ref))) {
    problems.push(
      `the ref condition (include ${JSON.stringify(include)}, exclude ${JSON.stringify(exclude)}) does not cover main.`,
    );
  }

  // The merge queue builds each pull request on the latest main and runs the required checks there
  // before it merges, which the strict policy of ADR 0050 did by holding every pull request until
  // its author updated the branch (ADR 0093).
  const queue = (ruleset.rules ?? []).find(({ type }) => type === 'merge_queue');
  if (queue === undefined) {
    problems.push(
      'The ruleset has no merge_queue rule, so a pull request merges without being built on the latest main.',
    );
  } else if (queue.parameters?.merge_method !== 'SQUASH') {
    problems.push(
      `the merge queue merges with ${queue.parameters?.merge_method ?? 'no method'}, not SQUASH.`,
    );
  }

  const rules = (ruleset.rules ?? []).filter(({ type }) => type === 'required_status_checks');
  if (rules.length === 0) {
    return [
      ...problems,
      'The ruleset has no required_status_checks rule, so it requires no check.',
    ];
  }

  /** @type {Map<string, { app: number, source: string }>} */
  const expected = new Map();
  /** @type {Map<string, string>} */
  const optionalSource = new Map();
  for (const { file, jobs } of workflows) {
    for (const [id, job] of Object.entries(jobs)) {
      // GitHub reports a job without a name by its id.
      const name = job?.name ?? id;
      if (optional.has(name)) {
        optionalSource.set(name, file);
      } else {
        expected.set(name, { app: githubActions, source: file });
      }
    }
  }
  for (const [name, app] of otherApps) {
    expected.set(name, { app, source: 'code scanning' });
  }

  const required = rules.flatMap(({ parameters }) => parameters?.required_status_checks ?? []);
  const requiredNames = new Set(required.map(({ context }) => context));

  for (const [name, { source }] of expected) {
    if (!requiredNames.has(name)) {
      problems.push(`missing: the ruleset does not require "${name}" (${source}).`);
    }
  }
  for (const { context, integration_id: app } of required) {
    const want =
      expected.get(context)?.app ?? (optionalSource.has(context) ? githubActions : undefined);
    if (want === undefined) {
      problems.push(
        `stale: the ruleset requires "${context}", which no job of ${workflowFiles.join(', ')} reports. Remove it, or add its workflow to this check.`,
      );
    } else if (app !== want) {
      const from = app === undefined ? 'any app' : `app ${app}`;
      problems.push(
        `wrong app: the ruleset requires "${context}" from ${from}, not from app ${want}.`,
      );
    }
  }
  return problems;
}

function readWorkflows() {
  return workflowFiles.map((file) => {
    const path = fileURLToPath(new URL(`../../.github/workflows/${file}`, import.meta.url));
    return { file, jobs: parse(readFileSync(path, 'utf8')).jobs ?? {} };
  });
}

if (import.meta.main) {
  let workflows;
  try {
    workflows = readWorkflows();
  } catch (error) {
    console.error(
      `Cannot read the workflows: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(2);
  }
  let ruleset;
  try {
    ruleset = JSON.parse(
      execFileSync('gh', ['api', `repos/${repository}/rulesets/${mainRuleset}`], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'inherit'],
      }),
    );
  } catch (error) {
    console.error(
      `Cannot read ruleset ${mainRuleset} of ${repository} through gh api: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(2);
  }
  const problems = checkRuleset(ruleset, workflows);
  if (problems.length > 0) {
    console.error(`The main ruleset (${mainRuleset}) does not match the workflow jobs:`);
    for (const problem of problems) {
      console.error(`- ${problem}`);
    }
    process.exit(1);
  }
  console.log(
    `The main ruleset (${mainRuleset}) is active on main, merges through a merge queue that squashes, and requires every job of ${workflowFiles.join(', ')} that ADR 0069 requires, each from its app.`,
  );
}
