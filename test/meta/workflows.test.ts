import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

interface Step {
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
}

interface Job {
  name?: string;
  needs?: string | string[];
  steps?: Step[];
}

interface Workflow {
  path: string;
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

function workflows(): Workflow[] {
  return globSync('.github/workflows/*.{yml,yaml}', { cwd: root })
    .sort()
    .map((path) => ({ ...(parse(readFileSync(`${root}${path}`, 'utf8')) as Workflow), path }));
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

describe('workflows', () => {
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
