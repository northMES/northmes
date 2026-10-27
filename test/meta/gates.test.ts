// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { execFileSync } from 'node:child_process';
import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

interface PackageJson {
  scripts?: Record<string, string>;
}

interface Graph {
  nodes: { key: string; attributes: { config?: { command?: string; instructions?: string } } }[];
}

const root = fileURLToPath(new URL('../../', import.meta.url));

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(`${root}${path}`, 'utf8')) as T;
}

// The root manifest and every workspace package.json that the globs in pnpm-workspace.yaml match.
function workspaceManifests(): string[] {
  const { packages = [] } = parse(readFileSync(`${root}pnpm-workspace.yaml`, 'utf8')) as {
    packages?: string[];
  };
  const matches = packages
    .flatMap((pattern) => globSync(`${pattern}/package.json`, { cwd: root }))
    .filter((path) => !path.split('/').includes('node_modules'));

  return ['package.json', ...new Set(matches)];
}

// The projects that a vitest command names with `--project`, in order.
function projectsOf(command = ''): string[] {
  return [...command.matchAll(/--project[= ](\S+)/g)].map((match) => match[1] ?? '');
}

// The `VAR=value` assignments in front of a command.
function assignmentsOf(command = ''): Record<string, string> {
  const leading = /^(?:\w+=\S+ )*/.exec(command)?.[0] ?? '';
  return Object.fromEntries(
    leading
      .split(' ')
      .filter((assignment) => assignment !== '')
      .map((assignment) => assignment.split('=', 2) as [string, string]),
  );
}

// The commands a command line runs, in order.
function commandsOf(command = ''): string[] {
  return command.split(' && ').map((part) => part.trim());
}

const rootScripts = readJson<PackageJson>('package.json').scripts ?? {};

// The commands a command line runs, with each `pnpm <root script> [args]` replaced by the commands
// of that script, so `pnpm gen --check` becomes `node scripts/gen.mjs --check`.
function expandedCommandsOf(command = ''): string[] {
  return commandsOf(command).flatMap((part) => {
    const match = /^pnpm (\S+)(.*)$/.exec(part);
    const script = match?.[1] === undefined ? undefined : rootScripts[match[1]];
    return script === undefined ? [part] : expandedCommandsOf(`${script}${match?.[2] ?? ''}`);
  });
}

// The file that a `node <file>` command runs, or undefined for another command.
function nodeFileOf(command: string): string | undefined {
  return /^node (\S+)/.exec(command)?.[1];
}

// The index of the first command that satisfies `test`, or -1 when none does.
function indexOfCommand(commands: string[], test: (command: string) => boolean): number {
  return commands.findIndex(test);
}

const trackedFiles = new Set(
  execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n'),
);

describe('gates', () => {
  it('test:handoff runs the commands of pnpm check', () => {
    expect(expandedCommandsOf(rootScripts['test:handoff'])).toEqual(
      expandedCommandsOf(rootScripts.check),
    );
  });

  // A script that runs a file that is not tracked fails on a fresh clone. The backend's dist/ is
  // built by the turbo build that the same script runs first.
  it('every root script that runs node runs a tracked file, or a built one after its build', () => {
    expect(Object.keys(rootScripts), 'root scripts').not.toHaveLength(0);
    for (const [name, script] of Object.entries(rootScripts)) {
      const commands = commandsOf(script);
      commands.forEach((command, index) => {
        const file = nodeFileOf(command);
        if (file === undefined) return;
        if (file.split('/').includes('dist')) {
          const build = indexOfCommand(commands, (c) => /^turbo run build\b/.test(c));
          expect(build, `${name}: a turbo build before ${command}`).toBeGreaterThanOrEqual(0);
          expect(build, `${name}: a turbo build before ${command}`).toBeLessThan(index);
        } else {
          expect(trackedFiles.has(file), `${name} runs ${file}, which git does not track`).toBe(
            true,
          );
        }
      });
    }
  });

  // *.ai.test.ts runs only through `pnpm test:ai` (AGENTS.md).
  it('test:unit, test:int and test:ai each run one vitest project, and no other root script runs the ai project', () => {
    expect(projectsOf(rootScripts['test:unit'])).toEqual(['unit']);
    expect(projectsOf(rootScripts['test:int'])).toEqual(['integration']);
    expect(projectsOf(rootScripts['test:ai'])).toEqual(['ai']);
    for (const [name, script] of Object.entries(rootScripts)) {
      if (name === 'test:ai') continue;
      for (const command of expandedCommandsOf(script)) {
        expect(projectsOf(command), `${name}: ${command}`).not.toContain('ai');
      }
    }
  });

  // The Stockholm leg runs the unit and integration projects with Node and the test Postgres in
  // Europe/Stockholm. TZ goes on the command line, because set through Vitest's env option or a
  // setup file it has no effect on Date (docs/plan/11-quality-and-testing.md).
  it('pnpm test:tz runs the unit and integration projects with TZ and NM_TEST_PG_TZ set to Europe/Stockholm on the command line', () => {
    const [command, ...rest] = commandsOf(rootScripts['test:tz']);

    expect(rest).toEqual([]);
    expect(command).toMatch(/\bvitest run\b/);
    expect(assignmentsOf(command)).toEqual({
      TZ: 'Europe/Stockholm',
      NM_TEST_PG_TZ: 'Europe/Stockholm',
    });
    expect(projectsOf(command)).toEqual(['unit', 'integration']);
  });

  it('lint, typecheck and build each run their turbo task', () => {
    for (const task of ['lint', 'typecheck', 'build']) {
      expect(rootScripts[task], task).toMatch(
        new RegExp(`^turbo run (?:[\\w:-]+ )*${task}(?: |$)`),
      );
    }
  });

  it('pnpm check runs the Node check first, then lint, typecheck, gen --check and vitest in that order', () => {
    expect(rootScripts.check?.split(' && ')).toEqual([
      'node scripts/check-node.mjs',
      'turbo run lint typecheck',
      'pnpm gen --check',
      'vitest run --project unit --project integration --project web --project types',
    ]);
  });

  // An unfiltered `vitest run` would also run the ai and ops projects, and *.ai.test.ts runs only
  // through `pnpm test:ai` (AGENTS.md).
  it('pnpm test runs the unit, integration, web and types projects and never ai or ops', () => {
    const checkVitest = rootScripts.check?.split(' && ').find((c) => c.startsWith('vitest run'));

    expect(projectsOf(rootScripts.test)).toEqual(['unit', 'integration', 'web', 'types']);
    expect(projectsOf(rootScripts.test)).toEqual(projectsOf(checkVitest));
  });

  it('check:full runs check, then test:tz, then e2e', () => {
    const commands = commandsOf(rootScripts['check:full']);
    const positions = ['pnpm check', 'pnpm test:tz', 'pnpm e2e'].map((command) =>
      commands.indexOf(command),
    );

    expect(positions, commands.join(' && ')).not.toContain(-1);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('E02-S01 the root scripts northmes, gen:migration, plugin:build, dev, demo and e2e exist', () => {
    for (const name of ['northmes', 'gen:migration', 'plugin:build', 'dev', 'demo', 'e2e']) {
      expect(rootScripts[name], name).toBeDefined();
    }
  });

  // pnpm appends the arguments of `pnpm northmes db bootstrap` after the last command, so the
  // server's entry point comes last, after the turbo build that produces it.
  it('E02-S01 pnpm northmes builds the backend and ends with node on its entry point', () => {
    const commands = commandsOf(rootScripts.northmes);
    const build = commands.findIndex((c) =>
      /^turbo run build\b.* --filter=@northmes\/backend\b/.test(c),
    );

    expect(build).toBeGreaterThanOrEqual(0);
    expect(nodeFileOf(commands.at(-1) ?? '')).toMatch(/^apps\/backend\/dist\/.*\.js$/);
    expect(build).toBeLessThan(commands.length - 1);
  });

  // scripts/plugin-build.mjs imports the dist/ of both SDKs, which a fresh clone does not have.
  it('E02-S01 pnpm plugin:build builds @northmes/sdk and @northmes/web-sdk before it runs its script', () => {
    const commands = commandsOf(rootScripts['plugin:build']);
    const build = commands.findIndex((c) => /^turbo run build\b/.test(c));
    const script = commands.findIndex((c) => nodeFileOf(c) !== undefined);

    expect(build).toBeGreaterThanOrEqual(0);
    expect(commands[build]).toContain('--filter=@northmes/sdk');
    expect(commands[build]).toContain('--filter=@northmes/web-sdk');
    expect(script).toBeGreaterThan(build);
  });

  // The specs run against the built server, in the browser that Playwright installs (ADR 0041).
  it('E02-S01 pnpm e2e builds and installs Chromium before it runs the Playwright tests', () => {
    const commands = commandsOf(rootScripts.e2e);
    const build = commands.indexOf('pnpm build');
    const install = commands.findIndex((c) => /^playwright install\b.*\bchromium\b/.test(c));
    const test = commands.findIndex((c) => /^playwright test\b/.test(c));

    expect(build).toBeGreaterThanOrEqual(0);
    expect(install).toBeGreaterThan(build);
    expect(test).toBeGreaterThan(install);
  });

  it('the Tester command in every graph under docs/agents/handoff/graphs is pnpm check, and its coder instruction names pnpm check', () => {
    const graphs = globSync('docs/agents/handoff/graphs/*.json', { cwd: root });
    expect(graphs, 'graph files').not.toHaveLength(0);

    // The graphs also hold a `tdd-check` node of type tester, so nodes are found by key.
    for (const path of graphs) {
      const { nodes } = readJson<Graph>(path);
      const config = (key: string) => nodes.find((node) => node.key === key)?.attributes.config;

      expect(config('tester')?.command, `${path} tester`).toBe('pnpm check');
      expect(config('coder')?.instructions, `${path} coder`).toContain('pnpm check');
    }
  });

  it('no root or package script contains cd', () => {
    // `cd` as a command word: at the start, or after whitespace, `;`, `&`, `|` or `(`.
    const cd = /(^|[\s;&|(])cd(\s|$)/;

    for (const path of workspaceManifests()) {
      for (const [name, command] of Object.entries(readJson<PackageJson>(path).scripts ?? {})) {
        expect(command, `${path} script ${name}`).not.toMatch(cd);
      }
    }
  });
});
