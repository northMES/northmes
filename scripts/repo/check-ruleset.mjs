// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// `pnpm repo:check-ruleset`: compares the required status checks of the main ruleset with the jobs
// of the workflows (docs/adr/0069-require-each-ci-job-as-a-status-check-on-main.md). It names each
// job the ruleset does not require, each required check that no job reports any more, and each
// check required from the wrong app, and exits 1 when it finds one. Run it before and after merging
// a change that renames, adds or removes a job, around the ruleset edit that change needs.
//
// It reads the ruleset through `gh api`, with the login of the gh CLI that runs it. GitHub serves
// a repository ruleset to anyone who can read the repository, so the maintainer's login, the
// northmes-agent token and a workflow's GITHUB_TOKEN with `contents: read` all can; only the
// bypass list needs write access to the ruleset, and the script does not read it. The script
// changes nothing: a person edits the ruleset (ADR 0069).

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const repository = 'northMES/northmes';
const mainRuleset = 24515911;

// The GitHub Actions app, which reports every workflow job.
const githubActions = 15368;

// The checks the ruleset requires that no workflow of this repository runs, by the app that
// reports them: CodeQL comes from code scanning's default setup (ADR 0050).
const otherApps = new Map([['CodeQL', 57789]]);

const workflowFiles = ['ci.yml', 'pr.yml', 'risk.yml', 'supply-chain.yml'];

// Jobs the ruleset may require but does not have to. cla joins before the first outside pull
// request (ADR 0039), e2e when #281 lands; openapi diff fails a pull request through pr gate and
// e2e through gate; risk label only labels the pull request (ADR 0086).
const optional = new Set(['cla', 'e2e', 'openapi diff', 'risk label']);

/**
 * The problems of the main ruleset's required status checks against the workflows' jobs.
 * @param {{ rules?: { type: string, parameters?: { strict_required_status_checks_policy?: boolean, required_status_checks?: { context: string, integration_id?: number }[] } }[] }} ruleset
 * @param {{ file: string, jobs: Record<string, { name?: string }> }[]} workflows
 * @returns {string[]} one line per problem, none when the ruleset matches
 */
export function checkRuleset(ruleset, workflows) {
  const rules = (ruleset.rules ?? []).filter(({ type }) => type === 'required_status_checks');
  if (rules.length === 0) {
    return ['The ruleset has no required_status_checks rule, so it requires no check.'];
  }

  const problems = [];
  if (rules.some(({ parameters }) => parameters?.strict_required_status_checks_policy !== true)) {
    problems.push(
      'strict_required_status_checks_policy is not true, so a pull request may merge without the latest main.',
    );
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
    const want = expected.get(context)?.app ?? (optionalSource.has(context) ? githubActions : undefined);
    if (want === undefined) {
      problems.push(
        `stale: the ruleset requires "${context}", which no job of ${workflowFiles.join(', ')} reports.`,
      );
    } else if (app !== want) {
      const from = app === undefined ? 'any app' : `app ${app}`;
      problems.push(`wrong app: the ruleset requires "${context}" from ${from}, not from app ${want}.`);
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
  const problems = checkRuleset(ruleset, readWorkflows());
  if (problems.length > 0) {
    console.error(`The main ruleset (${mainRuleset}) does not match the workflow jobs:`);
    for (const problem of problems) {
      console.error(`- ${problem}`);
    }
    process.exit(1);
  }
  console.log(`The main ruleset (${mainRuleset}) requires every workflow job, each from its app.`);
}
