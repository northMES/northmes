// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
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
  'working-directory'?: string;
  with?: Record<string, unknown>;
  env?: Record<string, string>;
}

interface Job {
  name?: string;
  if?: string;
  needs?: string | string[];
  permissions?: Permissions;
  'runs-on'?: unknown;
  outputs?: Record<string, string>;
  env?: Record<string, string>;
  steps?: Step[];
}

type Permissions = string | Record<string, string>;

interface Workflow {
  path: string;
  name?: string;
  on?: unknown;
  permissions?: Permissions;
  concurrency?: unknown;
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
const pullRequestChecks = ['pr title', 'linked issue', 'pr security', 'pr tests', 'openapi diff'];

// The steps that copy a report of an earlier step into the job summary. They check nothing, so no
// root script runs them.
const reportSteps = ['node scripts/ci/coverage-summary.mjs'];

// The steps that prepare a job: installing the dependencies, which every pnpm script needs, and
// adding the worktree that CI / fresh worktree installs and tests in. They check nothing, so no
// root script runs them. The worktree step names one directory, optionally quoted, made of path
// characters and variables only, so no other command can run in it.
function isSetupStep(run: string): boolean {
  return (
    run === 'pnpm install --frozen-lockfile' ||
    /^git worktree add --detach (?:[\w$./-]+|"[\w$./-]+")$/.test(run)
  );
}

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
  'pr security': {
    run: 'node scripts/ci/pr-security.mjs',
    env: {
      PR_BODY: expression('github.event.pull_request.body'),
      PR_AUTHOR: expression('github.event.pull_request.user.login'),
      PR_HEAD_REF: expression('github.event.pull_request.head.ref'),
      PR_FROM_FORK: expression('github.event.pull_request.head.repo.fork'),
    },
  },
  'pr tests': {
    run: 'node scripts/ci/pr-tests.mjs',
    env: {
      PR_TITLE: expression('github.event.pull_request.title'),
      PR_BODY: expression('github.event.pull_request.body'),
      PR_AUTHOR: expression('github.event.pull_request.user.login'),
      PR_HEAD_REF: expression('github.event.pull_request.head.ref'),
      PR_FROM_FORK: expression('github.event.pull_request.head.repo.fork'),
    },
  },
  'openapi diff': {
    run: 'node scripts/ci/openapi-diff.mjs',
    env: {
      PR_TITLE: expression('github.event.pull_request.title'),
      OPENAPI_CHANGES: `${expression('runner.temp')}/openapi-changes.json`,
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
  'fresh worktree',
  'e2e',
  'pr title',
  'linked issue',
  'pr security',
  'pr tests',
  'openapi diff',
  'gate',
];

// The jobs of the CI workflow that CI / gate does not need yet, and that the main ruleset does not
// require. CI / cla joins CI / gate before the first outside pull request
// (docs/adr/0039-license-agpl-3-0-or-later-core-and-a-contributor-license-agreement.md).
const ungatedCiJobs = ['cla'];

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

// `vitest run --project unit --project integration` runs the unit and the integration projects,
// which `vitest run --project unit` and `vitest run --project integration` run one each, with the
// variables set in front of vitest. A Vitest command with other flags stays whole.
function vitestProjects(command: string): string[] {
  const match = /^((?:\w+=\S+ )*vitest run)((?: --project [\w-]+)+)$/.exec(command);
  const run = match?.[1];
  return run === undefined
    ? [command]
    : [...(match?.[2] ?? '').matchAll(/--project ([\w-]+)/g)].map(
        ([, project]) => `${run} --project ${project}`,
      );
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

  // OpenSSF Scorecard uploads its findings to code scanning and publishes the score behind the
  // README badge through OIDC, so its one job also writes security events and mints an id token.
  const scorecardPermissions = {
    contents: 'read',
    'security-events': 'write',
    'id-token': 'write',
  };

  // release-please opens the release pull request and tags the release; the image job pushes the
  // image to ghcr.io and writes the .env line into that release's notes (ADR 0080); the attestations
  // job signs the image's provenance and SBOM through OIDC, pushes the attestations next to the
  // image and attaches the SBOM to the release (ADR 0050). Nothing else writes.
  const releasePermissions: Record<string, Record<string, string>> = {
    'release please': { contents: 'write', 'pull-requests': 'write' },
    'release image': { contents: 'write', packages: 'write' },
    'release attestations': {
      contents: 'write',
      packages: 'write',
      'id-token': 'write',
      attestations: 'write',
    },
  };

  // CI / cla reads the pull request and its commits through the API.
  const claPermissions = { contents: 'read', 'pull-requests': 'read' };

  // Risk / risk gate reads the pull request, its files and reviews; Risk / risk label labels it with
  // its tier (ADR 0086). Only the label job holds the write token.
  const riskGatePermissions = { contents: 'read', 'pull-requests': 'read' };
  const riskLabelPermissions = { contents: 'read', 'pull-requests': 'write' };
  // Risk refresh re-runs the other failed Risk runs once a review made the gate pass, and reads
  // which pull requests the commit heads; it reads no files.
  const riskRefreshPermissions = { actions: 'write', 'pull-requests': 'read' };

  it('every job sets its own permissions: contents: read, none for CI / gate, which reads no files, what CI / cla reads, what Risk / risk gate reads, what Risk / risk label writes, what Scorecard publishes with for its analysis, and what the three release jobs write', () => {
    const jobs = allJobs();

    expect(jobs, 'jobs').not.toHaveLength(0);
    for (const { where, job } of jobs) {
      const expected =
        job.name === 'gate'
          ? {}
          : job.name === 'cla'
            ? claPermissions
            : job.name === 'risk gate'
              ? riskGatePermissions
              : job.name === 'risk label'
                ? riskLabelPermissions
                : job.name === 'risk refresh'
                  ? riskRefreshPermissions
                : job.name === 'Scorecard analysis'
              ? scorecardPermissions
              : (releasePermissions[job.name ?? ''] ?? { contents: 'read' });
      expect(job.permissions, where).toEqual(expected);
    }
  });

  it('ADR0080 the release jobs live in release.yml, which runs on push to main only, and the image job runs only after release-please created a release', () => {
    const releaseJobs = allJobs().filter(({ job }) => job.name && job.name in releasePermissions);
    const release = workflows().find(({ path }) => path.endsWith('/release.yml'));

    expect(releaseJobs.map(({ where }) => where.split(' ')[0])).toEqual(
      Object.keys(releasePermissions).map(() => '.github/workflows/release.yml'),
    );
    expect(release?.on).toEqual({ push: { branches: ['main'] } });
    expect(release?.permissions).toEqual({});
    const image = Object.values(release?.jobs ?? {}).find(({ name }) => name === 'release image');
    expect(image?.if).toBe("needs.release-please.outputs.created == 'true'");
    expect((image?.steps ?? []).some(installsDependencies)).toBe(false);
  });

  // The attestations job holds id-token: write, so it runs no code from the repository: it checks
  // nothing out and installs nothing. It runs on a GitHub-hosted runner, so a verifier can pass
  // --deny-self-hosted-runners (docs/adr/0050-github-organization-rulesets-ci-runners-and-supply-chain.md).
  const imageName = 'ghcr.io/northmes/northmes';
  const imageDigest = expression('needs.image.outputs.digest');

  function attestationsJob(): { image: Job | undefined; job: Job; steps: Step[] } {
    const { workflow, job } = jobNamed('release attestations');
    const image = Object.values(workflow.jobs).find(({ name }) => name === 'release image');
    return { image, job, steps: job.steps ?? [] };
  }

  function stepUsing(steps: Step[], action: string): Step | undefined {
    return steps.find(({ uses }) => uses?.startsWith(`${action}@`));
  }

  // The step that attaches files to the release, and its gh release upload line.
  function releaseUpload(steps: Step[]): { step: Step | undefined; line: string } {
    for (const step of steps) {
      const line = (step.run ?? '')
        .split('\n')
        .map((part) => part.trim())
        .find((part) => part.startsWith('gh release upload "$TAG" '));
      if (line !== undefined) {
        return { step, line };
      }
    }
    return { step: undefined, line: '' };
  }

  it('ADR0050 the release attestations job runs after the image job on a GitHub-hosted runner, and checks out and installs nothing', () => {
    const { workflow } = jobNamed('release attestations');
    const { image, job, steps } = attestationsJob();

    expect(workflow.path).toBe('.github/workflows/release.yml');
    expect(needsOf(job)).toEqual(expect.arrayContaining(['release-please', 'image']));
    expect(job.if).toBe(image?.if);
    expect(runsOnOf(job)).toMatch(/^ubuntu-[\w.]+$/);
    expect(steps.some(installsDependencies)).toBe(false);
    expect(stepUsing(steps, 'actions/checkout')).toBeUndefined();
    expect(image?.outputs?.digest).toBe(expression('steps.build.outputs.digest'));
  });

  it('ADR0050 the release attestations job attests the build provenance of the image digest and pushes it to the registry', () => {
    const { steps } = attestationsJob();
    const provenance = stepUsing(steps, 'actions/attest-build-provenance');

    expect(provenance?.with).toMatchObject({
      'subject-name': imageName,
      'subject-digest': imageDigest,
      'push-to-registry': true,
    });
  });

  it('ADR0040 ADR0050 the release attestations job writes a CycloneDX SBOM of the image with a pinned Syft, attests it for the image digest and attaches it to the release', () => {
    const { steps } = attestationsJob();
    const sbom = stepUsing(steps, 'anchore/sbom-action');
    const sbomFile = String(sbom?.with?.['output-file'] ?? '');
    const attestation = steps.find(
      ({ uses, with: inputs }) => uses?.startsWith('actions/attest@') && inputs?.['sbom-path'],
    );
    const upload = releaseUpload(steps);

    expect(sbom?.with).toMatchObject({
      image: `${imageName}@${imageDigest}`,
      format: 'cyclonedx-json',
      'upload-artifact': false,
      'upload-release-assets': false,
    });
    expect(String(sbom?.with?.['syft-version'] ?? '')).toMatch(/^v\d+\.\d+\.\d+$/);
    expect(sbomFile).toMatch(/\.cdx\.json$/);
    expect(attestation?.with).toMatchObject({
      'subject-name': imageName,
      'subject-digest': imageDigest,
      'sbom-path': sbomFile,
      'push-to-registry': true,
    });
    expect(upload.step?.env?.SBOM).toBe(sbomFile);
    expect(upload.line).toContain('"$SBOM"');
  });

  // Scorecard's Signed-Releases check credits a release asset named <asset>.intoto.jsonl, and a
  // plant can take the bundles from the release page to a host without internet.
  it('ADR0050 the release attestations job attaches both attestation bundles to the release as .intoto.jsonl files', () => {
    const { steps } = attestationsJob();
    const ids = steps
      .filter(({ uses }) => /^actions\/attest(?:-build-provenance)?@/.test(uses ?? ''))
      .map(({ id }) => id);
    const upload = releaseUpload(steps);
    const envValues = Object.values(upload.step?.env ?? {});

    expect(ids).toHaveLength(2);
    for (const id of ids) {
      expect(envValues, `bundle of step ${id}`).toContain(
        expression(`steps.${id}.outputs.bundle-path`),
      );
    }
    expect(upload.line.match(/\.intoto\.jsonl"/g)).toHaveLength(2);
  });

  // Two builds of the image from one commit give the same digest (OpenSSF Best Practices
  // build_repeatable and build_reproducible). BuildKit reads SOURCE_DATE_EPOCH, set to the commit
  // time, and rewrite-timestamp gives every file in the image that time. A provenance or SBOM
  // attestation from BuildKit would hold the build's own start and end times and change the digest,
  // so the build adds none; the release attestations job signs both for the digest instead.
  const commitTime = 'echo "SOURCE_DATE_EPOCH=$(git log -1 --format=%ct)" >> "$GITHUB_ENV"';
  const reproducibleImage = { context: '.', provenance: false, sbom: false };

  function imageBuilds(steps: Step[]): Step[] {
    return steps.filter(({ uses }) => uses?.startsWith('docker/build-push-action@'));
  }

  function exporterOf(step: Step | undefined): string[] {
    return String(step?.with?.outputs ?? '').split(',');
  }

  function expectReproducibleBuilds(steps: Step[], where: string): void {
    const epoch = steps.findIndex(({ run }) => run?.trim() === commitTime);
    const builds = imageBuilds(steps);

    expect(epoch, `${where} sets SOURCE_DATE_EPOCH to the commit time`).not.toBe(-1);
    expect(builds, `${where} image builds`).not.toHaveLength(0);
    for (const build of builds) {
      expect(steps.indexOf(build), `${where} sets SOURCE_DATE_EPOCH first`).toBeGreaterThan(epoch);
      expect(build.with, where).toMatchObject(reproducibleImage);
      expect(exporterOf(build), where).toEqual(
        expect.arrayContaining(['type=image', 'rewrite-timestamp=true']),
      );
      expect(build.with?.push, `${where} pushes through the exporter`).toBeUndefined();
    }
  }

  // The check builds on every pull request and push to main, with no paths filter, so it can become
  // a required check. The second build starts without BuildKit's cache, so it rebuilds every layer.
  it('reproducible.yml builds the image twice from one commit, the second time without cache, and fails when the two digests differ', () => {
    const { workflow, job } = jobNamed('reproducible image');
    const steps = job.steps ?? [];
    const [first, second] = imageBuilds(steps);
    const compare = steps.at(-1);
    const on = workflow.on as Record<string, Record<string, unknown> | null>;

    expect(workflow.path).toBe('.github/workflows/reproducible.yml');
    expect(Object.keys(on).sort()).toEqual(['pull_request', 'push']);
    expect(on.pull_request).toBeNull();
    expect(on.push).toEqual({ branches: ['main'] });
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(runsOnOf(job)).toMatch(/^ubuntu-[\w.]+$/);
    expect(steps.map(({ uses, run }) => uses?.replace(/@.*$/, '') ?? run?.trim())).toEqual([
      'actions/checkout',
      'docker/setup-buildx-action',
      commitTime,
      'docker/build-push-action',
      'docker/build-push-action',
      compare?.run?.trim(),
    ]);
    expectReproducibleBuilds(steps, workflow.path);
    expect(exporterOf(first)).toContain('push=false');
    expect(second?.with).toEqual({ ...first?.with, 'no-cache': true });
    expect(compare?.env).toEqual({
      FIRST: expression(`steps.${first?.id}.outputs.digest`),
      SECOND: expression(`steps.${second?.id}.outputs.digest`),
    });
    expect(compare?.run).toContain('if [ -z "$FIRST" ] || [ "$FIRST" != "$SECOND" ]; then');
    expect(compare?.run).toContain('exit 1');
  });

  // The release pushes the digest that a rebuild of the tagged commit gives, so anyone can check
  // the released image against the source.
  it('the release image job builds the image the way reproducible image checks it, and pushes it', () => {
    const { job: check } = jobNamed('reproducible image');
    const { job } = jobNamed('release image');
    const steps = job.steps ?? [];
    const [build] = imageBuilds(steps);
    const [checked] = imageBuilds(check.steps ?? []);

    expect(imageBuilds(steps)).toHaveLength(1);
    expectReproducibleBuilds(steps, 'release image');
    expect(exporterOf(build).sort()).toEqual(
      exporterOf(checked)
        .map((option) => (option === 'push=false' ? 'push=true' : option))
        .sort(),
    );
    expect(build?.id).toBe('build');
  });

  // The score behind the badge stays current: weekly, after every push to main and when the
  // branch protection changes. Scorecard refuses to publish from a workflow with workflow-level
  // write permissions, env or defaults, so the workflow holds none of them.
  it('E00-S04 scorecard.yml runs weekly, on push to main and on branch protection changes, and publishes its results', () => {
    const scorecard = workflows().find(({ path }) => path.endsWith('/scorecard.yml'));
    const raw = scorecard === undefined ? {} : (scorecard as unknown as Record<string, unknown>);
    const job = Object.values(scorecard?.jobs ?? {})[0];
    const analysis = job?.steps?.find(({ uses }) => uses?.startsWith('ossf/scorecard-action@'));

    expect(scorecard, '.github/workflows/scorecard.yml').toBeDefined();
    expect(triggersOf(scorecard?.on)).toEqual(
      expect.arrayContaining(['schedule', 'push', 'branch_protection_rule']),
    );
    expect((scorecard?.on as { push?: { branches?: string[] } }).push?.branches).toEqual(['main']);
    expect(scorecard?.permissions).toEqual({ contents: 'read' });
    expect(raw.env, 'workflow env').toBeUndefined();
    expect(raw.defaults, 'workflow defaults').toBeUndefined();
    expect(Object.keys(scorecard?.jobs ?? {})).toHaveLength(1);
    expect(job?.permissions).toEqual(scorecardPermissions);
    expect(analysis?.with?.publish_results).toBe(true);
    // Scorecard publishes only from a job whose steps are all its approved actions.
    expect(
      (job?.steps ?? []).map(({ uses, run }) => uses?.replace(/@.*$/, '') ?? `run: ${run}`),
    ).toEqual([
      'actions/checkout',
      'ossf/scorecard-action',
      'actions/upload-artifact',
      'github/codeql-action/upload-sarif',
    ]);
    expect(job?.env, 'job env').toBeUndefined();
    // Scorecard publishes from the default branch only, so a manual run elsewhere skips the job.
    expect(job?.if).toBe(expression('github.ref_name == github.event.repository.default_branch'));
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
  // tests did not run. A push to main skips the pull request checks and CI / fresh worktree.
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
  it('CI / pr title, CI / linked issue, CI / pr security, CI / pr tests and CI / openapi diff run on pull requests only and read the pull request from environment variables', () => {
    for (const [name, step] of Object.entries(pullRequestCheckSteps)) {
      const { job } = jobNamed(name);

      expect(job.if, name).toBe("github.event_name == 'pull_request'");
      expect(job.steps, name).toContainEqual(expect.objectContaining(step));
    }
  });

  // The opened, synchronize and reopened types are the default; edited re-runs both checks after a
  // fix to the title or body.
  it('ADR0076 CI / gate needs CI / pr title, CI / linked issue, CI / pr security and CI / pr tests, and an edited pull request re-runs them', () => {
    const { workflow, id } = jobNamed('gate');
    const needed = allNeedsOf(workflow.jobs, id).map((need) => workflow.jobs[need]?.name);
    const on = workflow.on as { pull_request?: { types?: string[] } };

    expect(needed).toEqual(expect.arrayContaining(pullRequestChecks));
    expect(on.pull_request?.types).toEqual(
      expect.arrayContaining(['opened', 'synchronize', 'reopened', 'edited']),
    );
  });

  // A newer commit or edit on a pull request cancels the pull request's older CI run, and the newer
  // run reports every required check on the head commit. Each push to main runs in a group of its
  // own that nothing cancels, so every commit on main keeps a full run.
  it('CI cancels the older run of a pull request and never a run on a push to main', () => {
    const { workflow } = jobNamed('gate');

    expect(workflow.concurrency).toEqual({
      group: `${expression('github.workflow')}-${expression(
        "github.event_name == 'pull_request' && github.event.pull_request.number || github.run_id",
      )}`,
      'cancel-in-progress': expression("github.event_name == 'pull_request'"),
    });
  });

  // GitHub counts a skipped required check as passed, so CI / gate needs every job to fail a pull
  // request on which one of them did not run.
  it('CI / gate needs every other job in its workflow except CI / cla, which joins it before the first outside pull request', () => {
    const { workflow, id } = jobNamed('gate');

    expect(allNeedsOf(workflow.jobs, id).sort()).toEqual(
      Object.entries(workflow.jobs)
        .filter(([job, { name }]) => job !== id && !ungatedCiJobs.includes(name ?? ''))
        .map(([job]) => job)
        .sort(),
    );
  });

  // The main ruleset names each CI job, so a renamed, added or removed job needs a ruleset edit timed
  // to its merge (docs/adr/0069-require-each-ci-job-as-a-status-check-on-main.md).
  it('the CI workflow has exactly the jobs lint, typecheck, build, test, react doctor, fresh worktree, e2e, pr title, linked issue, pr security, pr tests, openapi diff, gate and cla', () => {
    const ci = workflows().find(({ name }) => name === 'CI');

    expect(ci, 'a workflow named CI').toBeDefined();
    expect(
      Object.values(ci?.jobs ?? {})
        .map(({ name }) => name)
        .sort(),
    ).toEqual([...ciJobs, ...ungatedCiJobs].sort());
  });

  // CI checks out the pull request's merge commit; its first parent is the base branch, so a depth
  // of 2 holds both sides of the diff. The job reads code only, so it keeps no credentials.
  it("CI / pr tests checks out the merge commit with its first parent and without credentials", () => {
    const { job } = jobNamed('pr tests');

    expect(job.permissions).toEqual({ contents: 'read' });
    expect(job.steps?.[0]).toEqual(
      expect.objectContaining({
        uses: expect.stringMatching(/^actions\/checkout@[0-9a-f]{40}$/),
        with: { 'fetch-depth': 2, 'persist-credentials': false },
      }),
    );
  });

  // oasdiff compares the base branch's schema/openapi-v1.json with the pull request's (ADR 0064).
  // It runs from its image pinned by digest, without network, so neither document leaves the runner
  // and the image cannot change under the job; Renovate updates the tag and digest together.
  it('ADR0064 CI / openapi diff runs oasdiff from its image pinned by digest, without network, on the base branch document and the pull request one', () => {
    const { workflow, job } = jobNamed('openapi diff');
    const steps = job.steps ?? [];
    const checkouts = steps.filter(({ uses }) => uses?.startsWith('actions/checkout@'));
    const compare = steps.find(({ run }) => run?.includes('oasdiff') || run?.includes('OASDIFF'));

    expect(workflow.path).toBe('.github/workflows/ci.yml');
    expect(job.permissions).toEqual({ contents: 'read' });
    expect(job.env?.OASDIFF_IMAGE).toMatch(/^tufin\/oasdiff:v\d+\.\d+\.\d+@sha256:[0-9a-f]{64}$/);
    expect(checkouts.map(({ with: inputs }) => inputs?.ref)).toEqual([
      undefined,
      expression('github.event.pull_request.base.sha'),
    ]);
    expect(checkouts[1]?.with).toMatchObject({ path: 'base', 'sparse-checkout': 'schema' });
    expect(compare?.run).toContain('docker run --rm --network none');
    expect(compare?.run).toContain('"$OASDIFF_IMAGE" breaking');
    expect(compare?.run).toContain('base/schema/openapi-v1.json schema/openapi-v1.json');
    expect(compare?.run).toContain('--format json > "$RUNNER_TEMP/openapi-changes.json"');
    expect(steps.at(-1)?.run).toBe('node scripts/ci/openapi-diff.mjs');
  });

  // A pull request's own files must not decide its CLA check: a checkout would run the pull
  // request's copy of the check, and its copy of signed.json could list its own author. So the job
  // checks out nothing and runs the check from the default branch, which reads signed.json from
  // there too (docs/adr/0039-license-agpl-3-0-or-later-core-and-a-contributor-license-agreement.md).
  it('ADR0039 CI / cla runs on pull requests, checks out nothing and runs the check from the default branch', () => {
    const { workflow, job } = jobNamed('cla');
    const steps = job.steps ?? [];
    const download = steps.find(({ run }) => run?.includes('gh api'));
    const check = steps.at(-1);

    expect(workflow.path).toBe('.github/workflows/ci.yml');
    expect(job.if).toBe("github.event_name == 'pull_request'");
    expect(runsOnOf(job)).toBe('ubuntu-24.04');
    expect(steps.map(({ uses, run }) => uses?.replace(/@.*$/, '') ?? 'run')).toEqual([
      'actions/setup-node',
      'run',
      'run',
    ]);
    expect(download?.env).toEqual({
      GH_TOKEN: expression('github.token'),
      DEFAULT_BRANCH: expression('github.event.repository.default_branch'),
    });
    for (const file of ['scripts/cla/check.mjs', 'scripts/ci/annotation.mjs']) {
      expect(download?.run).toContain(`contents/${file}?ref=$DEFAULT_BRANCH`);
    }
    expect(check).toEqual({
      name: expect.any(String),
      run: 'node "$RUNNER_TEMP/cla/scripts/cla/check.mjs"',
      env: {
        GITHUB_TOKEN: expression('github.token'),
        PR_NUMBER: expression('github.event.pull_request.number'),
      },
    });
  });

  // A pull request runs its own copy of a workflow, so the gate's integrity rests on the check and
  // the path list coming from the default branch, and on .github/ being a high-risk path.
  it('ADR0086 Risk / risk gate runs on pull requests and reviews, checks out nothing and runs the check from the default branch', () => {
    const { workflow, job } = jobNamed('risk gate');
    const steps = job.steps ?? [];
    const download = steps.find(({ run }) => run?.includes('gh api'));
    const check = steps.find(({ id }) => id === 'risk');

    expect(workflow.path).toBe('.github/workflows/risk.yml');
    expect(triggersOf(workflow.on)).toEqual(['pull_request', 'pull_request_review']);
    expect(steps.some(({ uses }) => uses?.startsWith('actions/checkout@'))).toBe(false);
    expect(download?.env).toEqual({
      GH_TOKEN: expression('github.token'),
      DEFAULT_BRANCH: expression('github.event.repository.default_branch'),
    });
    for (const file of ['scripts/ci/risk-gate.mjs', 'scripts/ci/pull-request.mjs', 'scripts/ci/annotation.mjs']) {
      expect(download?.run).toContain(`contents/${file}?ref=$DEFAULT_BRANCH`);
    }
    expect(check).toEqual({
      name: expect.any(String),
      id: 'risk',
      run: 'node "$RUNNER_TEMP/risk/scripts/ci/risk-gate.mjs"',
      env: {
        GITHUB_TOKEN: expression('github.token'),
        PR_NUMBER: expression('github.event.pull_request.number'),
      },
    });
  });

  // GitHub keeps the failed or cancelled risk gate checks of the runs from before the approval next
  // to the passing one from the review, and the required check stays failed. Risk refresh re-runs
  // those earlier runs, which now find the approval. A workflow_run workflow runs from the default
  // branch, so a pull request cannot change it. Its re-runs join the Risk workflow's concurrency
  // group, so they go one at a time and only while the commit is still the pull request's head.
  it('ADR0086 Risk refresh re-runs the failed pull request runs of Risk at the head commit once a review run passed', () => {
    const { workflow, job } = jobNamed('risk refresh');
    const steps = job.steps ?? [];
    const rerun = steps.find(({ run }) => run?.includes('rerun-failed-jobs'));

    expect(workflow.path).toBe('.github/workflows/risk-refresh.yml');
    expect(workflow.on).toEqual({ workflow_run: { workflows: ['Risk'], types: ['completed'] } });
    expect(job.if).toBe(
      "github.event.workflow_run.event == 'pull_request_review' && github.event.workflow_run.conclusion == 'success'",
    );
    expect(steps.some(({ uses }) => uses?.startsWith('actions/checkout@'))).toBe(false);
    expect(rerun?.env).toEqual({
      GH_TOKEN: expression('github.token'),
      HEAD_SHA: expression('github.event.workflow_run.head_sha'),
      STARTED_BY: expression('github.event.workflow_run.id'),
    });
    expect(rerun?.run).toContain(
      'actions/workflows/risk.yml/runs?head_sha=$HEAD_SHA',
    );
    expect(rerun?.run).toContain(
      'select(.conclusion == "failure" or .conclusion == "cancelled")',
    );
    expect(rerun?.run).toContain('[ "$id" = "$STARTED_BY" ] && continue');
    expect(rerun?.run).toContain('gh run watch');
    expect(rerun?.run).toContain('select(.state == "open")');
    expect(workflow.concurrency).toEqual({
      group: `risk-refresh-${expression('github.event.workflow_run.head_sha')}`,
      'cancel-in-progress': false,
    });
    expect(rerun?.run).toContain('still_head ||');
  });

  // Without a checkout the job cannot read .node-version, so it names the same version.
  it('ADR0039 ADR0086 CI / cla and Risk / risk gate set up the Node version in .node-version', () => {
    for (const name of ['cla', 'risk gate']) {
      const { job } = jobNamed(name);
      const setup = (job.steps ?? []).find(({ uses }) => uses?.startsWith('actions/setup-node@'));

      expect(String(setup?.with?.['node-version']), name).toBe(
        readFileSync(`${root}.node-version`, 'utf8').trim(),
      );
    }
  });

  // A review run and an edited run can overlap; the later one wins, so a stale label does not stay.
  it('ADR0086 the Risk workflow runs one at a time per pull request and labels in a job of its own after the gate', () => {
    const { workflow, job } = jobNamed('risk label');

    expect(workflow.concurrency).toEqual({
      group: `risk-${expression('github.event.pull_request.number')}`,
      'cancel-in-progress': true,
    });
    expect(needsOf(job)).toEqual(['risk-gate']);
    expect(job.if).toBe("always() && needs.risk-gate.outputs.tier != ''");
    expect(job.steps?.some(({ uses }) => uses?.startsWith('actions/checkout@'))).toBe(false);
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

  // A setup step skips the containment check below, so a step that chains another command after
  // git worktree add goes through that check.
  it('only the install and a git worktree add of one directory with nothing chained count as setup steps', () => {
    const steps = {
      'pnpm install --frozen-lockfile': true,
      'git worktree add --detach ../fresh-worktree': true,
      'git worktree add --detach "$RUNNER_TEMP/fresh-worktree"': true,
      'pnpm install': false,
      'git worktree add ../x && node -e "process.exit(0)"': false,
      'git worktree add --detach ../x && pnpm build': false,
      'git worktree add --detach ../x; pnpm build': false,
      'git worktree add --detach ../x || pnpm build': false,
      'git worktree add --detach ../x | tee log': false,
      'git worktree add --detach $(pnpm${IFS}build)': false,
      'git worktree add --detach `pnpm build`': false,
    };

    expect(Object.fromEntries(Object.keys(steps).map((run) => [run, isSetupStep(run)]))).toEqual(
      steps,
    );
  });

  it('every run step in CI / gate calls a script that pnpm check or check:full contains', () => {
    const { workflow, id } = jobNamed('gate');
    const gated = allNeedsOf(workflow.jobs, id).filter(
      (need) => ![...pullRequestChecks, ...ciOnlyChecks].includes(workflow.jobs[need]?.name ?? ''),
    );
    const contained = new Set(
      ['pnpm check', 'pnpm check:full']
        .flatMap(commandsOf)
        .flatMap(turboTasks)
        .flatMap(vitestProjects),
    );

    expect(gated, 'the jobs CI / gate needs').not.toHaveLength(0);
    expect(
      (vitestConfig as VitestConfig).test?.coverage?.thresholds,
      'a coverage threshold',
    ).toBeUndefined();
    for (const need of gated) {
      for (const { run } of workflow.jobs[need]?.steps ?? []) {
        const where = `${workflow.path} job ${need} step ${JSON.stringify(run)}`;
        if (run === undefined || isSetupStep(run.trim()) || reportSteps.includes(run.trim())) {
          continue;
        }
        const script = rootScript(/^pnpm (\S+)/.exec(run.trim())?.[1]);

        expect(script, `${where} calls a root script`).toBeDefined();
        for (const command of commandsOf(run.trim())
          .map(withoutCoverage)
          .flatMap(turboTasks)
          .flatMap(vitestProjects)) {
          expect([...contained], where).toContain(command);
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
  // job runs a root script, so the meta tests can read its flags.
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

  // The web code is apps/web, which holds every module's screens, and packages/web-sdk.
  it('the react doctor job scans apps/web and packages/web-sdk', () => {
    const { job } = jobNamed('react doctor');
    const web = ['apps/web', 'packages/web-sdk'];
    const commands = reactDoctorCommandsOf(job);

    expect(commands, 'react-doctor commands').not.toHaveLength(0);
    for (const command of commands) {
      const projects = /--project (\S+)/.exec(command)?.[1]?.split(',') ?? [];
      expect(projects.sort(), command).toEqual(web.sort());
    }
  });

  // The job reports its findings in the job summary (#339). With --json, react-doctor writes only
  // the report, so the step after the scan copies the findings from it into the job summary and the
  // log. That step also runs after a failed scan, and not when a failed install skipped the scan.
  it('the react doctor job copies its findings into the job summary, also after a failed scan', () => {
    const { job } = jobNamed('react doctor');
    const steps = job.steps ?? [];
    const scan = steps.findIndex(({ run }) => run === 'pnpm react-doctor');
    const id = steps[scan]?.id;
    const commands = reactDoctorCommandsOf(job);
    const report = /--json-out (\S+)/.exec(commands[0] ?? '')?.[1];

    expect(scan, 'the pnpm react-doctor step').not.toBe(-1);
    expect(id, 'the id of the pnpm react-doctor step').toBeDefined();
    expect(commands).toHaveLength(1);
    expect(commands[0]?.split(' ')).toContain('--json');
    expect(report, 'the --json-out path').toBeDefined();
    expect(steps[scan + 1]).toEqual({
      if: `!cancelled() && steps.${id}.outcome != 'skipped'`,
      run: 'pnpm react-doctor:summary',
    });
    expect(commandsOf('pnpm react-doctor:summary')).toEqual([
      `node scripts/ci/react-doctor-summary.mjs ${report}`,
    ]);
  });

  // A handoff run starts in a fresh git worktree and runs tests right after one install, so the job
  // adds a worktree, installs in it and runs the integration project there, with no build step.
  // Tests that boot the built server build it through bootBuilt
  // (docs/adr/0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md).
  // The job runs on pull requests only; on main, CI / test runs the same integration tests.
  it('E02-S08 the fresh-worktree job runs git worktree add, pnpm install --frozen-lockfile and pnpm test:int and no build', () => {
    const { id, job } = jobNamed('fresh worktree');
    const steps = job.steps ?? [];
    const runs = steps.flatMap(({ run }) => (run === undefined ? [] : [run.trim()]));
    const worktree = /^git worktree add --detach (\S+)$/.exec(runs[0] ?? '')?.[1];

    expect(id).toBe('fresh-worktree');
    expect(job.if).toBe("github.event_name == 'pull_request'");
    expect(worktree, 'the directory that git worktree add creates').toBeDefined();
    expect(
      steps.map(({ uses, run, 'working-directory': directory }) => ({
        step: uses?.replace(/@.*$/, '') ?? run?.trim(),
        directory,
      })),
    ).toEqual([
      { step: 'actions/checkout', directory: undefined },
      { step: 'pnpm/action-setup', directory: undefined },
      { step: 'actions/setup-node', directory: undefined },
      { step: `git worktree add --detach ${worktree}`, directory: undefined },
      { step: 'pnpm install --frozen-lockfile', directory: worktree },
      { step: 'pnpm test:int', directory: worktree },
    ]);
    expect(runs.flatMap(commandsOf).filter((command) => /\b(?:build|tsc)\b/.test(command))).toEqual(
      [],
    );
  });

  // The end-to-end specs run against the built server in role all, with Postgres from
  // Testcontainers (docs/adr/0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md).
  // pnpm e2e builds, installs Chromium and runs Playwright; after a failed run the job keeps
  // Playwright's report with the traces of the failed tests.
  it('E02-S08 the e2e job installs and runs pnpm e2e, and keeps the report after a failure', () => {
    const { id, job } = jobNamed('e2e');
    const steps = job.steps ?? [];

    expect(id).toBe('e2e');
    expect(steps.map(({ uses, run }) => uses?.replace(/@.*$/, '') ?? run?.trim())).toEqual([
      'actions/checkout',
      'pnpm/action-setup',
      'actions/setup-node',
      'pnpm install --frozen-lockfile',
      'pnpm e2e',
      'actions/upload-artifact',
    ]);
    expect(steps.at(-1)?.if).toBe('failure()');
    expect(steps.at(-1)?.with?.path).toBe('playwright-report/');
  });

  // The docs images come from a run that a maintainer starts by hand on a branch. The job only reads
  // the repository and hands the PNGs back as an artifact to commit: a push with the job's token
  // would start no CI run on the new commit, so its required checks would never report
  // (docs/adr/0048-documentation-on-docs7-at-docs-northmes-dev.md).
  it('ADR0048 the docs screenshots workflow runs by hand, runs pnpm docs:screenshots and uploads apps/docs/images', () => {
    const { workflow, job } = jobNamed('docs screenshots');
    const steps = job.steps ?? [];

    expect(workflow.path).toBe('.github/workflows/docs-screenshots.yml');
    expect(workflow.on).toEqual({ workflow_dispatch: null });
    expect(workflow.permissions).toEqual({});
    expect(steps.map(({ uses, run }) => uses?.replace(/@.*$/, '') ?? run?.trim())).toEqual([
      'actions/checkout',
      'pnpm/action-setup',
      'actions/setup-node',
      'pnpm install --frozen-lockfile',
      'pnpm docs:screenshots',
      'actions/upload-artifact',
    ]);
    expect(steps.at(-1)?.with?.path).toBe('apps/docs/images/');
    expect(steps.at(-1)?.with?.['if-no-files-found']).toBe('error');
  });

  // The Argos token reaches only the step that runs the e2e specs, as an environment variable, so
  // no other job or step reads it and a fork's pull request, which gets no secrets, uploads nothing
  // (docs/adr/0077-visual-regression-snapshots-with-argos-from-the-playwright-specs.md).
  it('ADR0077 only the e2e job reads ARGOS_TOKEN, as an environment variable of its test step', () => {
    const token = 'secrets.ARGOS_TOKEN';
    const reads = (value: unknown) => JSON.stringify(value ?? {}).includes(token);
    const readers = workflows().flatMap((workflow) => [
      ...(reads({ ...workflow, jobs: undefined }) ? [workflow.path] : []),
      ...Object.entries(workflow.jobs ?? {}).flatMap(([id, job]) => [
        ...(reads({ ...job, steps: undefined }) ? [`${workflow.path} ${id}`] : []),
        ...(job.steps ?? []).flatMap((step) => {
          if (!reads(step)) return [];
          const where = `${workflow.path} ${id} ${step.run ?? step.uses}`;
          if (reads({ ...step, env: undefined })) return [`${where} outside env`];
          return Object.entries(step.env ?? {})
            .filter(([, value]) => value.includes(token))
            .map(([name, value]) => `${where} env ${name}=${value}`);
        }),
      ]),
    ]);

    expect(readers).toEqual([
      `.github/workflows/ci.yml e2e pnpm e2e env ARGOS_TOKEN=\${{ ${token} }}`,
    ]);
  });

  // The dependency audit is a required check of its own (docs/adr/0040-dependency-license-policy-ci-gate-and-sbom.md,
  // docs/security/vulnerability-policy.md). It needs the registry's advisory database, so it is not
  // part of pnpm check, which handoff's agents run offline.
  it('ADR0040 CI / dependency audit runs pnpm audit on the production tree for every pull request and push to main', () => {
    const { workflow, job } = jobNamed('dependency audit');
    const runs = (job.steps ?? []).flatMap(({ run }) => (run === undefined ? [] : [run.trim()]));
    const on = workflow.on as Record<string, { branches?: string[] } | null>;

    expect(triggersOf(workflow.on)).toEqual(expect.arrayContaining(['pull_request', 'push']));
    expect(on.push?.branches).toEqual(['main']);
    expect(runs).toContain('pnpm audit --prod');
    expect(job.permissions).toEqual({ contents: 'read' });
  });

  // The license gate is a required check of its own on a GitHub-hosted runner
  // (docs/adr/0040-dependency-license-policy-ci-gate-and-sbom.md,
  // docs/adr/0050-github-organization-rulesets-ci-runners-and-supply-chain.md). It installs the
  // native binaries of every platform the images ship for, so that their licenses are in the tree.
  it('ADR0040 Supply chain / license gate installs for linux x64 and arm64, glibc and musl, with the frozen lockfile on every pull request and push to main', () => {
    const { workflow, job } = jobNamed('license gate');
    const runs = (job.steps ?? []).flatMap(({ run }) => (run === undefined ? [] : [run.trim()]));
    const install = runs.find((run) => /^pnpm install\b/.test(run)) ?? '';
    const values = (flag: string) =>
      [...install.matchAll(new RegExp(`--${flag} (\\S+)`, 'g'))].map(([, value]) => value).sort();
    const on = workflow.on as Record<string, { branches?: string[] } | null>;

    expect(workflow.path).toBe('.github/workflows/supply-chain.yml');
    expect(triggersOf(workflow.on)).toEqual(expect.arrayContaining(['pull_request', 'push']));
    expect(on.push?.branches).toEqual(['main']);
    expect(runsOnOf(job)).toBe('ubuntu-24.04');
    expect(install).toMatch(/^pnpm install --frozen-lockfile /);
    expect(values('os')).toEqual(['linux']);
    expect(values('cpu')).toEqual(['arm64', 'x64']);
    expect(values('libc')).toEqual(['glibc', 'musl']);
  });

  it('ADR0040 Supply chain / license gate writes a CycloneDX SBOM per package of the production tree and of the full tree, then runs scripts/license-gate.mjs on both', () => {
    const { job } = jobNamed('license gate');
    const commands = (job.steps ?? []).flatMap(({ run }) =>
      run === undefined ? [] : commandsOf(run.trim()),
    );
    const sbom = 'pnpm sbom --sbom-format cyclonedx --sbom-type application';
    const prod = commands.indexOf(`${sbom} --prod --split --out sbom/prod/%s.cdx.json`);
    const all = commands.indexOf(`${sbom} --split --out sbom/all/%s.cdx.json`);
    const gate = commands.indexOf('node scripts/license-gate.mjs --prod sbom/prod --all sbom/all');

    expect(prod, commands.join('\n')).toBeGreaterThanOrEqual(0);
    expect(all, commands.join('\n')).toBeGreaterThan(prod);
    expect(gate, commands.join('\n')).toBeGreaterThan(all);
  });

  it('ADR0040 Supply chain / license gate reads only and holds no id-token', () => {
    const { workflow, job } = jobNamed('license gate');

    expect(job.permissions).toEqual({ contents: 'read' });
    expect(holdsIdTokenWrite(job.permissions ?? workflow.permissions)).toBe(false);
    expect(job.env ?? {}).toEqual({});
    for (const step of job.steps ?? []) {
      expect(JSON.stringify(step), 'a step that reads a secret').not.toMatch(/secrets\./);
    }
  });
});
