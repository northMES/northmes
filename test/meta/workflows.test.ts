import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import vitestConfig from '../../vitest.config.ts';

interface Step {
  id?: string;
  if?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  env?: Record<string, string>;
}

interface Job {
  name?: string;
  if?: string;
  needs?: string | string[];
  permissions?: Permissions;
  'runs-on'?: unknown;
  env?: Record<string, string>;
  steps?: Step[];
}

type Permissions = string | Record<string, string>;

interface Workflow {
  path: string;
  name?: string;
  on?: unknown;
  permissions?: Permissions;
  jobs: Record<string, Job>;
}

interface PackageJson {
  scripts?: Record<string, string>;
}

interface VitestConfig {
  test?: { coverage?: { thresholds?: unknown } };
}

const root = fileURLToPath(new URL('../../', import.meta.url));

const rootScripts =
  (JSON.parse(readFileSync(`${root}package.json`, 'utf8')) as PackageJson).scripts ?? {};

function rootScript(name: string | undefined): string | undefined {
  return name !== undefined && Object.hasOwn(rootScripts, name) ? rootScripts[name] : undefined;
}

// The pull request checks read the pull request instead of the code, so no root script runs them
// (docs/adr/0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md).
const pullRequestChecks = ['pr title', 'linked issue'];

// The steps that copy a report of an earlier step into the job summary. They check nothing, so no
// root script runs them.
const reportSteps = ['node scripts/ci/coverage-summary.mjs'];

// Collecting coverage adds a report to a Vitest run and changes neither the tests it runs nor, while
// vitest.config.ts sets no coverage threshold, its result. A run of the same projects without
// --coverage stands for it.
const coverageFlag = / --coverage(?= |$)/;

function withoutCoverage(command: string): string {
  return command.replace(coverageFlag, '');
}

// react-doctor runs in CI only, under a reviewed license exception that waits for the vendor's
// written confirmation on agent workflows
// (docs/adr/0040-dependency-license-policy-ci-gate-and-sbom.md), so neither pnpm check, which
// handoff's agents run, nor pnpm check:full runs it.
const ciOnlyChecks = ['react doctor'];

// A GitHub Actions expression as a workflow writes it.
function expression(source: string): string {
  return `\${{ ${source} }}`;
}

// What each pull request check runs, and the pull request fields it reads from the environment.
const pullRequestCheckSteps = {
  'pr title': {
    run: 'node scripts/ci/pr-title.mjs',
    env: { PR_TITLE: expression('github.event.pull_request.title') },
  },
  'linked issue': {
    run: 'node scripts/ci/linked-issue.mjs',
    env: {
      PR_BODY: expression('github.event.pull_request.body'),
      PR_AUTHOR: expression('github.event.pull_request.user.login'),
      PR_HEAD_REF: expression('github.event.pull_request.head.ref'),
      PR_FROM_FORK: expression('github.event.pull_request.head.repo.fork'),
    },
  },
};

// The jobs of the CI workflow, which GitHub shows as CI / <job name>. The main ruleset requires
// each of them as a status check by its job name
// (docs/adr/0069-require-each-ci-job-as-a-status-check-on-main.md), so a change to this list
// needs a ruleset edit: an added name after the merge, a removed or old name just before it.
const ciJobs = [
  'lint',
  'typecheck',
  'build',
  'test',
  'react doctor',
  'pr title',
  'linked issue',
  'gate',
];

// The checks the main ruleset requires from workflow files
// (docs/adr/0050-github-organization-rulesets-ci-runners-and-supply-chain.md and
// docs/adr/0069-require-each-ci-job-as-a-status-check-on-main.md). CodeQL runs as GitHub's default
// setup, outside the workflow files.
const requiredChecks = [...ciJobs, 'license gate', 'dependency audit'];

// write-all grants id-token: write with every other permission.
function holdsIdTokenWrite(permissions: Permissions | undefined): boolean {
  return (
    permissions === 'write-all' ||
    (typeof permissions === 'object' && permissions?.['id-token'] === 'write')
  );
}

function installsDependencies({ run }: Step): boolean {
  return /\bpnpm (?:install|i|add)\b/.test(run ?? '');
}

// The events a workflow's `on` names, in any of its three forms.
function triggersOf(on: unknown): string[] {
  if (typeof on === 'string') {
    return [on];
  }
  if (Array.isArray(on)) {
    return on.map(String);
  }
  return on !== null && typeof on === 'object' ? Object.keys(on) : [];
}

function workflowPaths(): string[] {
  return globSync('.github/workflows/*.{yml,yaml}', { cwd: root }).sort();
}

function workflows(): Workflow[] {
  return workflowPaths().map((path) => ({
    ...(parse(readFileSync(`${root}${path}`, 'utf8')) as Workflow),
    path,
  }));
}

// Every job of every workflow, with the place to name in an assertion.
function allJobs(): { where: string; job: Job }[] {
  return workflows().flatMap(({ path, jobs }) =>
    Object.entries(jobs ?? {}).map(([id, job]) => ({ where: `${path} job ${id}`, job })),
  );
}

function jobNamed(name: string): { workflow: Workflow; id: string; job: Job } {
  for (const workflow of workflows()) {
    for (const [id, job] of Object.entries(workflow.jobs ?? {})) {
      if (job.name === name) {
        return { workflow, id, job };
      }
    }
  }
  throw new Error(`no workflow under .github/workflows has a job named ${name}`);
}

function needsOf(job: Job): string[] {
  return typeof job.needs === 'string' ? [job.needs] : (job.needs ?? []);
}

// The jobs that the job `id` needs, directly and through their own needs.
function allNeedsOf(jobs: Record<string, Job>, id: string): string[] {
  const found = new Set<string>();
  const pending = needsOf(jobs[id] ?? {});
  for (let need = pending.pop(); need !== undefined; need = pending.pop()) {
    if (!found.has(need)) {
      found.add(need);
      pending.push(...needsOf(jobs[need] ?? {}));
    }
  }
  return [...found];
}

// The commands a command line runs, with each `pnpm <root script> [args]` replaced by the commands
// of that script, so `pnpm gen --check` becomes `node scripts/gen.mjs --check`.
function commandsOf(command: string): string[] {
  return command.split(' && ').flatMap((part) => {
    const match = /^pnpm (\S+)(.*)$/.exec(part);
    const script = rootScript(match?.[1]);
    return script === undefined ? [part] : commandsOf(`${script}${match?.[2] ?? ''}`);
  });
}

// The react-doctor commands that a job runs, with each root script expanded.
function reactDoctorCommandsOf(job: Job): string[] {
  return (job.steps ?? []).flatMap(({ run }) =>
    run === undefined
      ? []
      : commandsOf(run.trim()).filter((command) => /^react-doctor\b/.test(command)),
  );
}

// `turbo run lint typecheck` runs the lint and the typecheck tasks, which `turbo run lint` and
// `turbo run typecheck` run one each. A turbo command with flags stays whole.
function turboTasks(command: string): string[] {
  const match = /^turbo run ([\w:-]+(?: [\w:-]+)*)$/.exec(command);
  return match?.[1] === undefined
    ? [command]
    : match[1].split(' ').map((task) => `turbo run ${task}`);
}

// The runner of the test jobs (docs/plan/13-delivery-and-github.md): a pull request from a fork
// always runs on a GitHub-hosted runner, and an unset NM_RUNNER_X64 falls back to one, so deleting
// the variable moves the test jobs off Blacksmith without a commit.
const testRunner = expression(
  "(github.event_name == 'pull_request' && github.event.pull_request.head.repo.fork) && 'ubuntu-24.04' || vars.NM_RUNNER_X64 || 'ubuntu-24.04'",
);

// A job's runs-on on one line, whether it is a label, an expression, a list or a group.
function runsOnOf(job: Job): string {
  const runsOn = job['runs-on'];
  return (typeof runsOn === 'string' ? runsOn : JSON.stringify(runsOn ?? null))
    .replace(/\s+/g, ' ')
    .trim();
}

// A test job runs a root script that runs Vitest.
function isTestJob(job: Job): boolean {
  return (job.steps ?? []).some(
    ({ run }) => run !== undefined && commandsOf(run.trim()).some((c) => /\bvitest\b/.test(c)),
  );
}

// A Vitest run in a job, with the environment it sees: the job's, the step's and the variables the
// command sets in front of vitest.
interface VitestRun {
  env: Record<string, string>;
  projects: string[];
  coverage: boolean;
}

function vitestRunsOf(job: Job): VitestRun[] {
  return (job.steps ?? []).flatMap((step) =>
    commandsOf((step.run ?? '').trim()).flatMap((command) => {
      const match = /^((?:\w+=\S+ )*)vitest run\b(.*)$/.exec(command);
      if (match === null) {
        return [];
      }
      const inline = Object.fromEntries(
        (match[1] ?? '')
          .split(' ')
          .filter((assignment) => assignment !== '')
          .map((assignment) => assignment.split('=')),
      );
      const projects = [...(match[2] ?? '').matchAll(/--project (\S+)/g)].map(
        ([, project]) => project ?? '',
      );
      const coverage = coverageFlag.test(match[2] ?? '');
      return [{ env: { ...job.env, ...step.env, ...inline }, projects, coverage }];
    }),
  );
}

describe('workflows', () => {
  // A tag can move to other code; a commit SHA cannot. Renovate keeps the version comment next to
  // the SHA current (docs/adr/0050-github-organization-rulesets-ci-runners-and-supply-chain.md).
  it('every uses: line pins a 40-character SHA', () => {
    const uses = workflowPaths().flatMap((path) =>
      readFileSync(`${root}${path}`, 'utf8')
        .split('\n')
        .map((line, index) => ({ where: `${path}:${index + 1}`, line }))
        .filter(({ line }) => /^\s*(?:- +)?uses:/.test(line)),
    );

    expect(uses, 'uses: lines').not.toHaveLength(0);
    for (const { where, line } of uses) {
      expect(line, where).toMatch(/uses: [\w.-]+\/[\w./-]+@[0-9a-f]{40} # v\d+(?:\.\d+)*$/);
    }
  });

  // pull_request_target runs with a write token and secrets in the context of the base repository,
  // also for a pull request from a fork.
  it('no workflow uses pull_request_target', () => {
    const all = workflows();

    expect(all, 'workflows').not.toHaveLength(0);
    for (const { path, on } of all) {
      expect(triggersOf(on), path).not.toContain('pull_request_target');
    }
  });

  // A workflow that a paths filter skips never reports its check, and a required check that never
  // reports blocks the merge. A job that applies to some paths only decides in its first step.
  it('required workflows have no paths filter', () => {
    const required = workflows().filter(({ jobs }) =>
      Object.values(jobs ?? {}).some((job) => requiredChecks.includes(job.name ?? '')),
    );

    expect(required, 'workflows with a required check').not.toHaveLength(0);
    for (const { path, on } of required) {
      const events = on !== null && typeof on === 'object' ? Object.entries(on) : [];
      for (const [event, filters] of events) {
        const keys = Object.keys(filters ?? {});

        expect(keys, `${path} on.${event}`).not.toContain('paths');
        expect(keys, `${path} on.${event}`).not.toContain('paths-ignore');
      }
    }
  });

  // Install scripts of dependencies run in the job, and with id-token: write they could mint an
  // OIDC token for the repository. A job that uploads or publishes with OIDC installs nothing.
  it('no job both runs pnpm install and holds id-token: write', () => {
    for (const { path, permissions, jobs } of workflows()) {
      for (const [id, job] of Object.entries(jobs ?? {})) {
        // A job without its own permissions gets the workflow's.
        const idToken = holdsIdTokenWrite(job.permissions ?? permissions);
        const installs = (job.steps ?? []).some(installsDependencies);

        expect(idToken && installs, `${path} job ${id}`).toBe(false);
      }
    }
  });

  // GitHub substitutes an expression into the script text before the shell or actions/github-script
  // runs it, so a title, body or branch name in a script can inject code, also through env.*,
  // format() or github['event']. Scripts read every value from env instead.
  it('no run step or github-script script contains an expression', () => {
    for (const { where, job } of allJobs()) {
      for (const { run, uses, with: inputs } of job.steps ?? []) {
        expect(run ?? '', where).not.toContain('${{');
        if (uses?.startsWith('actions/github-script@')) {
          expect(String(inputs?.script ?? ''), `${where} github-script`).not.toContain('${{');
        }
      }
    }
  });

  // Without top-level permissions a job gets the repository's default token permissions; with
  // them, a job that needs more raises its own.
  it('every workflow sets top-level permissions', () => {
    const all = workflows();

    expect(all, 'workflows').not.toHaveLength(0);
    for (const { path, permissions } of all) {
      expect(permissions, path).toBeDefined();
    }
  });

  it('every job sets its own permissions: contents: read, and none for CI / gate, which reads no files', () => {
    const jobs = allJobs();

    expect(jobs, 'jobs').not.toHaveLength(0);
    for (const { where, job } of jobs) {
      const expected = job.name === 'gate' ? {} : { contents: 'read' };
      expect(job.permissions, where).toEqual(expected);
    }
  });

  it('test jobs take runs-on from a repository variable', () => {
    const testJobs = allJobs().filter(({ job }) => isTestJob(job));

    expect(testJobs, 'test jobs').not.toHaveLength(0);
    for (const { where, job } of testJobs) {
      expect(runsOnOf(job), where).toBe(testRunner);
    }
  });

  // Only the runner variable may send a job to Blacksmith, behind the fork fallback. Any other
  // expression in runs-on, a matrix value or another variable, could hold a Blacksmith label.
  it('no job names a Blacksmith label outside the runner variable expression', () => {
    const runners = allJobs().map(({ where, job }) => ({ where, runsOn: runsOnOf(job) }));

    expect(runners, 'jobs').not.toHaveLength(0);
    for (const { where, runsOn } of runners) {
      expect(runsOn, where).not.toMatch(/blacksmith/i);
    }
    for (const { where, runsOn } of runners.filter(({ runsOn }) => runsOn.includes('${{'))) {
      expect(runsOn, where).toBe(testRunner);
    }
  });

  // A checkout that persists the token leaves it in .git/config for every later step to read.
  it('every checkout sets persist-credentials: false', () => {
    const checkouts = allJobs().flatMap(({ where, job }) =>
      (job.steps ?? [])
        .filter(({ uses }) => uses?.startsWith('actions/checkout@'))
        .map((step) => ({ where, step })),
    );

    expect(checkouts, 'checkout steps').not.toHaveLength(0);
    for (const { where, step } of checkouts) {
      expect(step.with?.['persist-credentials'], where).toBe(false);
    }
  });

  // GitHub skips a job when a job it needs failed, and a skipped required check counts as passed.
  // On a pull request every job that CI / gate needs runs, so a skipped one means lint, build or
  // tests did not run. A push to main skips the pull request checks.
  it('CI / gate runs after a failed, cancelled or skipped job and then fails', () => {
    const { job: gate } = jobNamed('gate');

    expect(gate.if).toBe('always()');
    expect(gate.steps).toContainEqual(
      expect.objectContaining({
        if:
          "contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled')" +
          " || (github.event_name == 'pull_request' && contains(needs.*.result, 'skipped'))",
        run: 'exit 1',
      }),
    );
  });

  // A push to main has no pull request to check. An event value interpolated into a run script
  // could inject shell code, so the scripts read the pull request from environment variables.
  it('CI / pr title and CI / linked issue run on pull requests only and read the pull request from environment variables', () => {
    for (const [name, step] of Object.entries(pullRequestCheckSteps)) {
      const { job } = jobNamed(name);

      expect(job.if, name).toBe("github.event_name == 'pull_request'");
      expect(job.steps, name).toContainEqual(expect.objectContaining(step));
    }
  });

  // The opened, synchronize and reopened types are the default; edited re-runs both checks after a
  // fix to the title or body.
  it('CI / gate needs CI / pr title and CI / linked issue, and an edited pull request re-runs them', () => {
    const { workflow, id } = jobNamed('gate');
    const needed = allNeedsOf(workflow.jobs, id).map((need) => workflow.jobs[need]?.name);
    const on = workflow.on as { pull_request?: { types?: string[] } };

    expect(needed).toEqual(expect.arrayContaining(pullRequestChecks));
    expect(on.pull_request?.types).toEqual(
      expect.arrayContaining(['opened', 'synchronize', 'reopened', 'edited']),
    );
  });

  // GitHub counts a skipped required check as passed, so CI / gate needs every job to fail a pull
  // request on which one of them did not run.
  it('CI / gate needs every other job in its workflow', () => {
    const { workflow, id } = jobNamed('gate');

    expect(allNeedsOf(workflow.jobs, id).sort()).toEqual(
      Object.keys(workflow.jobs)
        .filter((job) => job !== id)
        .sort(),
    );
  });

  // The main ruleset names each CI job, so a renamed, added or removed job needs a ruleset edit timed
  // to its merge (docs/adr/0069-require-each-ci-job-as-a-status-check-on-main.md).
  it('the CI workflow has exactly the jobs lint, typecheck, build, test, react doctor, pr title, linked issue and gate', () => {
    const ci = workflows().find(({ name }) => name === 'CI');

    expect(ci, 'a workflow named CI').toBeDefined();
    expect(
      Object.values(ci?.jobs ?? {})
        .map(({ name }) => name)
        .sort(),
    ).toEqual([...ciJobs].sort());
  });

  // A required status check matches a check by its name and the app that reports it, not by the
  // workflow, so a job named build in another workflow would also satisfy the required build check.
  // A job without a name reports its id.
  it('no two workflows share a job name', () => {
    const workflowsByJobName = new Map<string, string[]>();
    for (const { path, jobs } of workflows()) {
      const names = new Set(Object.entries(jobs ?? {}).map(([id, job]) => job.name ?? id));
      for (const name of names) {
        workflowsByJobName.set(name, [...(workflowsByJobName.get(name) ?? []), path]);
      }
    }

    expect(workflowsByJobName.size, 'job names').not.toBe(0);
    expect([...workflowsByJobName].filter(([, paths]) => paths.length > 1)).toEqual([]);
  });

  // GitHub shows a check as <workflow name> / <job name>, so a job named ci / e2e in the workflow
  // CI would show as CI / ci / e2e, and the main ruleset would require it as ci / e2e
  // (docs/adr/0069-require-each-ci-job-as-a-status-check-on-main.md).
  it('no job name starts with its workflow name and a slash', () => {
    const jobs = workflows().flatMap(({ path, name: workflowName, jobs }) =>
      Object.entries(jobs ?? {}).map(([id, job]) => ({
        where: `${path} job ${id}`,
        prefix: `${(workflowName ?? path).toLowerCase()} /`,
        name: (job.name ?? id).toLowerCase(),
      })),
    );

    expect(jobs, 'jobs').not.toHaveLength(0);
    for (const { where, prefix, name } of jobs) {
      expect(name.startsWith(prefix), `${where} is named ${name}`).toBe(false);
    }
  });

  // One check covers all tests in both time zones. TZ sets the time zone of the Node process and
  // NM_TEST_PG_TZ the session zone of the test database, so each leg sets both. A step runs only
  // after passed steps by default, so the Europe/Stockholm leg names its own condition: it runs
  // after a failed UTC leg, so a failure that shows only in Stockholm reports in the same run, and
  // not after a failed install, which skips the UTC leg.
  it('CI / test runs the unit, integration, web and types projects in the UTC leg, then the unit and integration projects in the Europe/Stockholm leg', () => {
    const { job } = jobNamed('test');

    expect(job.steps).toContainEqual(
      expect.objectContaining({ id: 'utc', run: 'pnpm test:coverage' }),
    );
    expect(job.steps).toContainEqual(
      expect.objectContaining({
        if: "!cancelled() && steps.utc.outcome != 'skipped'",
        run: 'pnpm test:tz',
      }),
    );
    expect(vitestRunsOf(job)).toEqual([
      expect.objectContaining({
        env: expect.objectContaining({ TZ: 'UTC', NM_TEST_PG_TZ: 'UTC' }),
        projects: expect.arrayContaining(['unit', 'integration', 'web', 'types']),
      }),
      expect.objectContaining({
        env: expect.objectContaining({ TZ: 'Europe/Stockholm', NM_TEST_PG_TZ: 'Europe/Stockholm' }),
        projects: expect.arrayContaining(['unit', 'integration']),
      }),
    ]);
  });

  // Coverage comes from the UTC leg (docs/plan/11-quality-and-testing.md). The summary and the
  // upload follow it with no condition of their own, so they run only after a passed UTC leg, the
  // only run after which Vitest writes the report, and before the Europe/Stockholm leg.
  it('the UTC test leg collects coverage and uploads the lcov report', () => {
    const { job } = jobNamed('test');
    const steps = job.steps ?? [];
    const utc = steps.findIndex(({ id }) => id === 'utc');
    const stockholm = steps.findIndex(({ run }) => run === 'pnpm test:tz');
    const between = steps.slice(utc + 1, stockholm);

    expect(vitestRunsOf(job).map(({ coverage }) => coverage)).toEqual([true, false]);
    expect(between).toEqual([
      expect.objectContaining({ run: 'node scripts/ci/coverage-summary.mjs' }),
      expect.objectContaining({
        uses: expect.stringMatching(/^actions\/upload-artifact@/),
        with: expect.objectContaining({
          path: expect.stringContaining('coverage/lcov.info'),
          'if-no-files-found': 'error',
          // A re-run of the job uploads the same name again within the workflow run.
          overwrite: true,
        }),
      }),
    ]);
    expect(between.map((step) => step.if)).toEqual([undefined, undefined]);
  });

  it('every run step in CI / gate calls a script that pnpm check or check:full contains', () => {
    const { workflow, id } = jobNamed('gate');
    const gated = allNeedsOf(workflow.jobs, id).filter(
      (need) => ![...pullRequestChecks, ...ciOnlyChecks].includes(workflow.jobs[need]?.name ?? ''),
    );
    const contained = new Set(
      ['pnpm check', 'pnpm check:full'].flatMap(commandsOf).flatMap(turboTasks),
    );

    expect(gated, 'the jobs CI / gate needs').not.toHaveLength(0);
    expect(
      (vitestConfig as VitestConfig).test?.coverage?.thresholds,
      'a coverage threshold',
    ).toBeUndefined();
    for (const need of gated) {
      for (const { run } of workflow.jobs[need]?.steps ?? []) {
        const where = `${workflow.path} job ${need} step ${JSON.stringify(run)}`;
        // Installing the dependencies is the setup every pnpm script needs, and a report step checks
        // nothing.
        if (
          run === undefined ||
          run.trim() === 'pnpm install --frozen-lockfile' ||
          reportSteps.includes(run.trim())
        ) {
          continue;
        }
        const script = rootScript(/^pnpm (\S+)/.exec(run.trim())?.[1]);

        expect(script, `${where} calls a root script`).toBeDefined();
        for (const command of commandsOf(run.trim()).flatMap(turboTasks)) {
          expect([...contained], where).toContain(withoutCoverage(command));
        }
      }
    }
  });

  // react-doctor runs in CI only (docs/adr/0040-dependency-license-policy-ci-gate-and-sbom.md), and
  // handoff's agents run pnpm check as their gate.
  it('neither pnpm check nor pnpm check:full runs react-doctor', () => {
    const commands = ['pnpm check', 'pnpm check:full'].flatMap(commandsOf);

    expect(commands, 'the commands of pnpm check and check:full').not.toHaveLength(0);
    for (const command of commands) {
      expect(command).not.toMatch(/\breact-doctor\b/);
    }
  });

  // Without --no-telemetry react-doctor sends the scan to its score API, prints a share URL and
  // reports crashes to Sentry
  // (docs/adr/0020-frontend-libraries-tanstack-router-apollo-client-4-shadcn-ui-and-forms.md). The
  // job runs a root script, so pnpm react-doctor runs the same scan on a developer's machine.
  it('the react doctor job runs with --no-telemetry', () => {
    const { workflow, id, job } = jobNamed('react doctor');
    const runs = (job.steps ?? [])
      .map(({ run }) => run?.trim())
      .filter((run) => run !== undefined && run !== 'pnpm install --frozen-lockfile');
    const commands = reactDoctorCommandsOf(job);

    expect(runs, 'run steps after the install').not.toHaveLength(0);
    for (const run of runs) {
      const where = `${workflow.path} job ${id} step ${JSON.stringify(run)}`;
      expect(
        rootScript(/^pnpm (\S+)/.exec(run ?? '')?.[1]),
        `${where} calls a root script`,
      ).toBeDefined();
    }
    expect(commands, 'react-doctor commands').not.toHaveLength(0);
    for (const command of commands) {
      expect(command.split(' '), command).toContain('--no-telemetry');
    }
  });

  // The web code is apps/web, the web remote of every module and packages/web-sdk, so a module that
  // gains a web remote joins the scan in the same change.
  it('the react doctor job scans apps/web, every modules/*/web and packages/web-sdk', () => {
    const { job } = jobNamed('react doctor');
    const web = ['apps/web', ...globSync('modules/*/web', { cwd: root }), 'packages/web-sdk'];
    const commands = reactDoctorCommandsOf(job);

    expect(web, 'web code').toContain('modules/planning/web');
    expect(commands, 'react-doctor commands').not.toHaveLength(0);
    for (const command of commands) {
      const projects = /--project (\S+)/.exec(command)?.[1]?.split(',') ?? [];
      expect(projects.sort(), command).toEqual(web.sort());
    }
  });
});
