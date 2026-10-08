import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

interface Step {
  name?: string;
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
  'runs-on'?: unknown;
  steps?: Step[];
}

type Permissions = string | Record<string, string>;

interface Workflow {
  path: string;
  on?: unknown;
  permissions?: Permissions;
  jobs: Record<string, Job>;
}

interface PackageJson {
  scripts?: Record<string, string>;
}

const root = fileURLToPath(new URL('../../', import.meta.url));

const rootScripts =
  (JSON.parse(readFileSync(`${root}package.json`, 'utf8')) as PackageJson).scripts ?? {};

function rootScript(name: string | undefined): string | undefined {
  return name !== undefined && Object.hasOwn(rootScripts, name) ? rootScripts[name] : undefined;
}

// The pull request checks read the pull request instead of the code, so no root script runs them
// (docs/adr/0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md).
const pullRequestChecks = ['ci / pr title', 'ci / linked issue'];

// A GitHub Actions expression as a workflow writes it.
function expression(source: string): string {
  return `\${{ ${source} }}`;
}

// What each pull request check runs, and the pull request fields it reads from the environment.
const pullRequestCheckSteps = {
  'ci / pr title': {
    run: 'node scripts/ci/pr-title.mjs',
    env: { PR_TITLE: expression('github.event.pull_request.title') },
  },
  'ci / linked issue': {
    run: 'node scripts/ci/linked-issue.mjs',
    env: {
      PR_BODY: expression('github.event.pull_request.body'),
      PR_AUTHOR: expression('github.event.pull_request.user.login'),
      PR_HEAD_REF: expression('github.event.pull_request.head.ref'),
      PR_FROM_FORK: expression('github.event.pull_request.head.repo.fork'),
    },
  },
};

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

function jobNamed(name: string): { workflow: Workflow; id: string } {
  for (const workflow of workflows()) {
    for (const [id, job] of Object.entries(workflow.jobs ?? {})) {
      if (job.name === name) {
        return { workflow, id };
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

// `turbo run lint typecheck` runs the lint and the typecheck tasks, which `turbo run lint` and
// `turbo run typecheck` run one each. A turbo command with flags stays whole.
function turboTasks(command: string): string[] {
  const match = /^turbo run ([\w:-]+(?: [\w:-]+)*)$/.exec(command);
  return match?.[1] === undefined ? [command] : match[1].split(' ').map((t) => `turbo run ${t}`);
}

// The runner of the test jobs (docs/plan/13-delivery-and-github.md): a pull request from a fork
// always runs on a GitHub-hosted runner, and an unset NM_RUNNER_X64 falls back to one, so deleting
// the variable moves the test jobs off Blacksmith without a commit.
const testRunner =
  // biome-ignore lint/suspicious/noTemplateCurlyInString: a GitHub Actions expression, not a template.
  "${{ (github.event_name == 'pull_request' && github.event.pull_request.head.repo.fork) && 'ubuntu-24.04' || vars.NM_RUNNER_X64 || 'ubuntu-24.04' }}";

// A test job runs a root script that runs Vitest.
function isTestJob(job: Job): boolean {
  return (job.steps ?? []).some(
    ({ run }) => run !== undefined && commandsOf(run.trim()).some((c) => /\bvitest\b/.test(c)),
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

  // Without top-level permissions a job gets the repository's default token permissions; with
  // them, a job that needs more raises its own.
  it('every workflow sets top-level permissions', () => {
    const all = workflows();

    expect(all, 'workflows').not.toHaveLength(0);
    for (const { path, permissions } of all) {
      expect(permissions, path).toBeDefined();
    }
  });

  it('test jobs take runs-on from a repository variable', () => {
    const testJobs = allJobs().filter(({ job }) => isTestJob(job));

    expect(testJobs, 'test jobs').not.toHaveLength(0);
    for (const { where, job } of testJobs) {
      expect(String(job['runs-on']).replace(/\s+/g, ' ').trim(), where).toBe(testRunner);
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
  it('ci / gate runs after a failed or cancelled job and then fails', () => {
    const { workflow, id } = jobNamed('ci / gate');
    const gate = workflow.jobs[id];

    expect(gate?.if).toBe('always()');
    expect(gate?.steps).toContainEqual(
      expect.objectContaining({
        if: "contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled')",
        run: 'exit 1',
      }),
    );
  });

  // A push to main has no pull request to check. An event value interpolated into a run script
  // could inject shell code, so the scripts read the pull request from environment variables.
  it('ci / pr title and ci / linked issue run on pull requests only and read the pull request from environment variables', () => {
    for (const [name, step] of Object.entries(pullRequestCheckSteps)) {
      const { workflow, id } = jobNamed(name);
      const job = workflow.jobs[id];

      expect(job?.if, name).toBe("github.event_name == 'pull_request'");
      expect(job?.steps, name).toContainEqual(expect.objectContaining(step));
    }
  });

  // The opened, synchronize and reopened types are the default; edited re-runs both checks after a
  // fix to the title or body.
  it('ci / gate needs ci / pr title and ci / linked issue, and an edited pull request re-runs them', () => {
    const { workflow, id } = jobNamed('ci / gate');
    const needed = allNeedsOf(workflow.jobs, id).map((need) => workflow.jobs[need]?.name);
    const on = workflow.on as { pull_request?: { types?: string[] } };

    expect(needed).toEqual(expect.arrayContaining(pullRequestChecks));
    expect(on.pull_request?.types).toEqual(
      expect.arrayContaining(['opened', 'synchronize', 'reopened', 'edited']),
    );
  });

  it('every run step in ci / gate calls a script that pnpm check or check:full contains', () => {
    const { workflow, id } = jobNamed('ci / gate');
    const gated = allNeedsOf(workflow.jobs, id).filter(
      (need) => !pullRequestChecks.includes(workflow.jobs[need]?.name ?? ''),
    );
    const contained = new Set(
      ['pnpm check', 'pnpm check:full'].flatMap(commandsOf).flatMap(turboTasks),
    );

    expect(gated, 'the jobs ci / gate needs').not.toHaveLength(0);
    for (const need of gated) {
      for (const { run } of workflow.jobs[need]?.steps ?? []) {
        const where = `${workflow.path} job ${need} step ${JSON.stringify(run)}`;
        // Installing the dependencies is the setup every pnpm script needs.
        if (run === undefined || run.trim() === 'pnpm install --frozen-lockfile') {
          continue;
        }
        const script = rootScript(/^pnpm (\S+)/.exec(run.trim())?.[1]);

        expect(script, `${where} calls a root script`).toBeDefined();
        for (const command of commandsOf(run.trim()).flatMap(turboTasks)) {
          expect([...contained], where).toContain(command);
        }
      }
    }
  });
});
