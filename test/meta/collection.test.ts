import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

interface Listed {
  file: string;
  projectName: string;
}

interface Misfiled {
  path: string;
  projects: string[];
}

const root = fileURLToPath(new URL('../../', import.meta.url));
const config = join(root, 'vitest.config.ts');
const vitestBin = join(root, 'node_modules/vitest/vitest.mjs');

// The suffixes of a test file, and the folders no project collects.
const testFilePattern = /\.(test|spec)\.tsx?$|\.test-d\.ts$/;
const ignoredFolders = ['node_modules', 'dist'];

// Vitest and git in these tests see neither the caller's Vitest worker nor a GIT_DIR from a hook.
function environment(): Record<string, string> {
  const inherited = Object.entries(process.env).filter(
    (entry): entry is [string, string] =>
      entry[1] !== undefined && !entry[0].startsWith('GIT_') && !entry[0].startsWith('VITEST'),
  );
  return Object.fromEntries(inherited);
}

// The files `vitest list` collects under `directory` with the repository's config, by path relative
// to `directory`, each with the projects that collect it. `flags` narrow the run, as `--project` does.
function collected(directory: string, flags: string[] = []): Map<string, string[]> {
  const result = spawnSync(
    process.execPath,
    [vitestBin, 'list', '--filesOnly', '--json', '--config', config, '--root', directory, ...flags],
    { cwd: root, encoding: 'utf8', env: environment(), maxBuffer: 64 * 1024 * 1024 },
  );
  expect(result.status, result.stderr).toBe(0);

  const byFile = new Map<string, string[]>();
  for (const { file, projectName } of JSON.parse(result.stdout) as Listed[]) {
    const path = relative(directory, file);
    byFile.set(path, [...(byFile.get(path) ?? []), projectName]);
  }
  return byFile;
}

function tracked(): string[] {
  const result = spawnSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'utf8',
    env: environment(),
    maxBuffer: 64 * 1024 * 1024,
  });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.split('\0').filter(Boolean);
}

// The projects that the vitest command in the root `check` script names with `--project`.
function checkProjects(): string[] {
  const { scripts } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  };
  const vitest = scripts.check?.split(' && ').find((command) => command.startsWith('vitest run'));
  return [...(vitest ?? '').matchAll(/--project[= ](\S+)/g)].map((match) => match[1] ?? '');
}

// A test file that some project is meant to collect: not under node_modules, dist or docs/sources.
function isCollectable(path: string): boolean {
  const folders = path.split('/').slice(0, -1);
  return (
    testFilePattern.test(path) &&
    !path.startsWith('docs/sources/') &&
    !ignoredFolders.some((folder) => folders.includes(folder))
  );
}

// The test files that no project collects, or that more than one project collects.
function misfiled(testFiles: string[], listed: Map<string, string[]>): Misfiled[] {
  return testFiles
    .map((path) => ({ path, projects: listed.get(path) ?? [] }))
    .filter(({ projects }) => projects.length !== 1);
}

describe('collection', () => {
  describe('in this repository', () => {
    it('every tracked test file belongs to exactly one project', () => {
      const testFiles = tracked().filter(isCollectable);

      expect(testFiles, 'tracked test files').not.toHaveLength(0);
      expect(misfiled(testFiles, collected(root))).toEqual([]);
    }, 60_000);
  });

  describe('in a synthetic tree', () => {
    let directory: string;
    let listed: Map<string, string[]>;

    function write(path: string) {
      mkdirSync(dirname(join(directory, path)), { recursive: true });
      writeFileSync(join(directory, path), 'export {};\n');
    }

    beforeAll(() => {
      directory = realpathSync(mkdtempSync(join(tmpdir(), 'collection-')));
      for (const path of [
        'x.test.ts',
        'x.int.test.ts',
        'x.ai.test.ts',
        'x.ops.test.ts',
        'x.test-d.ts',
        'orphan.spec.ts',
        'docs/sources/spike/x.test.ts',
        'docs/sources/spike/x.int.test.ts',
        'docs/sources/spike/x.ai.test.ts',
        'docs/sources/spike/x.ops.test.ts',
        'docs/sources/spike/x.test-d.ts',
      ]) {
        write(path);
      }
      listed = collected(directory);
    }, 60_000);

    afterAll(() => {
      rmSync(directory, { recursive: true, force: true });
    });

    it('a file named x.int.test.ts lands in integration only', () => {
      expect(listed.get('x.int.test.ts')).toEqual(['integration']);
    });

    it('a file named x.test.ts lands in unit only', () => {
      expect(listed.get('x.test.ts')).toEqual(['unit']);
    });

    it.each([
      { file: 'x.ai.test.ts', project: 'ai' },
      { file: 'x.ops.test.ts', project: 'ops' },
    ])('a file named $file lands in $project only', ({ file, project }) => {
      expect(listed.get(file)).toEqual([project]);
    });

    it('a file named x.test-d.ts lands in types only', () => {
      expect(listed.get('x.test-d.ts')).toEqual(['types']);
    });

    it('pnpm check does not run a file named x.ai.test.ts or x.ops.test.ts', () => {
      const projects = checkProjects();
      const run = collected(
        directory,
        projects.flatMap((project) => ['--project', project]),
      );

      expect(projects).toEqual(expect.arrayContaining(['unit', 'integration', 'types']));
      expect(projects).not.toContain('ai');
      expect(projects).not.toContain('ops');
      expect(run.get('x.test.ts')).toEqual(['unit']);
      expect(run.get('x.int.test.ts')).toEqual(['integration']);
      expect(run.get('x.test-d.ts')).toEqual(['types']);
      expect(run.has('x.ai.test.ts')).toBe(false);
      expect(run.has('x.ops.test.ts')).toBe(false);
    }, 60_000);

    it('files under docs/sources are never collected', () => {
      const paths = [...listed.keys()];

      expect(paths, 'the tree has collected files').toContain('x.test.ts');
      expect(paths.filter((path) => path.startsWith('docs/sources/'))).toEqual([]);
    });

    it('a test file that matches no project is reported', () => {
      expect(misfiled(['x.test.ts', 'orphan.spec.ts'], listed)).toEqual([
        { path: 'orphan.spec.ts', projects: [] },
      ]);
    });
  });
});
