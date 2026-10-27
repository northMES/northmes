// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { checkRuleset } from './check-ruleset.mjs';

const actions = 15368;
const codeql = 57789;

function jobs(...names: string[]) {
  return Object.fromEntries(names.map((name) => [name.replaceAll(' ', '-'), { name }]));
}

const workflows = [
  {
    file: 'ci.yml',
    jobs: jobs('lint', 'typecheck', 'build', 'test', 'react doctor', 'e2e', 'cla', 'gate'),
  },
  {
    file: 'pr.yml',
    jobs: jobs('pr title', 'linked issue', 'pr security', 'pr tests', 'openapi diff', 'pr gate'),
  },
  { file: 'risk.yml', jobs: jobs('risk gate', 'risk label') },
  { file: 'supply-chain.yml', jobs: jobs('license gate', 'dependency audit') },
];

const requiredNames = [
  'lint',
  'typecheck',
  'build',
  'test',
  'react doctor',
  'gate',
  'pr title',
  'linked issue',
  'pr security',
  'pr tests',
  'pr gate',
  'risk gate',
  'license gate',
  'dependency audit',
];

type Check = { context: string; integration_id?: number };

function ruleset(checks: Check[], strict = true) {
  return {
    id: 24515911,
    name: 'main',
    enforcement: 'active',
    conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
    rules: [
      { type: 'deletion' },
      {
        type: 'required_status_checks',
        parameters: {
          strict_required_status_checks_policy: strict,
          required_status_checks: checks,
        },
      },
    ],
  };
}

const matching: Check[] = [
  ...requiredNames.map((context) => ({ context, integration_id: actions })),
  { context: 'CodeQL', integration_id: codeql },
];

describe('check-ruleset', () => {
  it('a ruleset that requires every job of the workflows from its app passes', () => {
    expect(checkRuleset(ruleset(matching), workflows)).toEqual([]);
  });

  it('a ruleset that does not require test fails naming test', () => {
    const problems = checkRuleset(
      ruleset(matching.filter(({ context }) => context !== 'test')),
      workflows,
    );

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('"test"');
    expect(problems[0]).toContain('ci.yml');
  });

  it('a required check that no job reports any more fails as stale, naming it', () => {
    const problems = checkRuleset(
      ruleset([...matching, { context: 'fresh worktree', integration_id: actions }]),
      workflows,
    );

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/stale/);
    expect(problems[0]).toContain('"fresh worktree"');
  });

  it('a required check from another app, or from any app, fails naming the check and the app', () => {
    const problems = checkRuleset(
      ruleset(
        matching.map((check) =>
          check.context === 'lint'
            ? { context: 'lint', integration_id: 12345 }
            : check.context === 'pr gate'
              ? { context: 'pr gate' }
              : check,
        ),
      ),
      workflows,
    );

    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain('"lint"');
    expect(problems[0]).toContain('12345');
    expect(problems[0]).toContain(String(actions));
    expect(problems[1]).toContain('"pr gate"');
    expect(problems[1]).toContain('any app');
  });

  it('CodeQL comes from the code scanning app, not from GitHub Actions', () => {
    const problems = checkRuleset(
      ruleset(
        matching.map((check) =>
          check.context === 'CodeQL' ? { context: 'CodeQL', integration_id: actions } : check,
        ),
      ),
      workflows,
    );

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('"CodeQL"');
    expect(problems[0]).toContain(String(codeql));
  });

  it('cla, e2e, openapi diff and risk label may be required or not', () => {
    const optional = ['cla', 'e2e', 'openapi diff', 'risk label'].map((context) => ({
      context,
      integration_id: actions,
    }));

    expect(checkRuleset(ruleset([...matching, ...optional]), workflows)).toEqual([]);
  });

  it('a job without a name is required by its id', () => {
    const named = workflows.map((workflow) =>
      workflow.file === 'ci.yml'
        ? { ...workflow, jobs: { ...workflow.jobs, docs: { needs: 'lint' } } }
        : workflow,
    );

    const problems = checkRuleset(ruleset(matching), named);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('"docs"');
  });

  it('a ruleset whose checks are not strict fails naming strict_required_status_checks_policy', () => {
    const problems = checkRuleset(ruleset(matching, false), workflows);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('strict_required_status_checks_policy');
  });

  it('a ruleset that is not active fails naming its enforcement', () => {
    const problems = checkRuleset({ ...ruleset(matching), enforcement: 'evaluate' }, workflows);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('enforcement');
    expect(problems[0]).toContain('evaluate');
  });

  it('a ruleset that does not target the default branch fails naming its ref condition', () => {
    const problems = checkRuleset(
      {
        ...ruleset(matching),
        conditions: { ref_name: { include: ['refs/heads/release'], exclude: [] } },
      },
      workflows,
    );

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('refs/heads/release');
  });

  it('a ruleset that excludes main fails naming its ref condition', () => {
    const problems = checkRuleset(
      {
        ...ruleset(matching),
        conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: ['refs/heads/main'] } },
      },
      workflows,
    );

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('refs/heads/main');
  });

  it('a ruleset without a required_status_checks rule fails', () => {
    const problems = checkRuleset({ ...ruleset(matching), rules: [] }, workflows);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('required_status_checks');
  });
});
