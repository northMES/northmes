import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
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

interface Resolved {
  name: string;
  environment: string;
  plugins: string[];
}

const root = fileURLToPath(new URL('../../', import.meta.url));
const config = join(root, 'vitest.config.ts');
const vitestBin = join(root, 'node_modules/vitest/vitest.mjs');

// The suffixes of a test file, and the folders no project collects. A `.spec.ts` file is a
// Playwright spec under e2e/ (docs/adr/0041-test-strategy-tdd-vitest-projects-testcontainers-and-
// playwright.md), run by Playwright and never by Vitest.
const testFilePattern = /\.test\.tsx?$|\.test-d\.ts$/;
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

// The projects Vitest resolves from the repository's config, each with its test environment and the
// names of the plugins in its Vite config. A script in a child process loads them through Vitest's
// Node API, so the answer comes from the same config a test run reads.
function resolved(): Resolved[] {
  const script = `
    import { createVitest } from 'vitest/node';
    const vitest = await createVitest({ config: ${JSON.stringify(config)}, root: ${JSON.stringify(root)}, watch: false });
    try {
      console.log(JSON.stringify(vitest.projects.map((project) => ({
        name: project.name,
        environment: project.config.environment,
        plugins: (project.vite.config.plugins ?? []).map((plugin) => plugin.name),
      }))));
    } finally {
      await vitest.close();
    }
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
    cwd: root,
    encoding: 'utf8',
    env: environment(),
    maxBuffer: 64 * 1024 * 1024,
  });
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as Resolved[];
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

// The files in the lcov report that a coverage run of the unit project writes under `directory`,
// by path relative to `directory`. The test files get Vitest's globals, so they import nothing from
// a tree that has no node_modules.
function covered(directory: string): string[] {
  const result = spawnSync(
    process.execPath,
    [
      vitestBin,
      'run',
      '--config',
      config,
      '--root',
      directory,
      '--project',
      'unit',
      '--globals',
      '--coverage',
    ],
    { cwd: root, encoding: 'utf8', env: environment(), maxBuffer: 64 * 1024 * 1024 },
  );
  expect(result.status, result.stderr).toBe(0);

  const lcov = readFileSync(join(directory, 'coverage/lcov.info'), 'utf8');
  return [...lcov.matchAll(/^SF:(.+)$/gm)]
    .map(([, file]) => relative(directory, resolve(directory, file ?? '')))
    .sort();
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

  describe('the web project', () => {
    it('the web project uses the React plugin and the happy-dom environment', () => {
      const projects = resolved();
      const web = projects.find((project) => project.name === 'web');
      const unit = projects.find((project) => project.name === 'unit');

      expect(web?.environment).toBe('happy-dom');
      expect(web?.plugins).toContain('vite:react-babel');
      expect(unit?.plugins.filter((name) => name.startsWith('vite:react'))).toEqual([]);
    }, 60_000);
  });

  describe('in a synthetic tree', () => {
    const suffixed = [
      'x.test.ts',
      'x.test.tsx',
      'x.int.test.ts',
      'x.ai.test.ts',
      'x.ops.test.ts',
      'x.test-d.ts',
    ];
    const ignoredFolderFixtures = [
      'dist',
      'packages/a/dist',
      'node_modules/pkg',
      'a/node_modules/pkg',
    ];
    const written = [
      ...suffixed,
      'e2e/x.spec.ts',
      ...suffixed.map((file) => `docs/sources/spike/${file}`),
      ...ignoredFolderFixtures.flatMap((folder) => suffixed.map((file) => `${folder}/${file}`)),
    ];
    let directory: string;
    let listed: Map<string, string[]>;

    beforeAll(() => {
      directory = realpathSync(mkdtempSync(join(tmpdir(), 'collection-')));
      for (const path of written) {
        mkdirSync(dirname(join(directory, path)), { recursive: true });
        writeFileSync(join(directory, path), 'export {};\n');
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

    it('a file named x.test.tsx lands in web only', () => {
      expect(listed.get('x.test.tsx')).toEqual(['web']);
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

      expect(projects).toEqual(expect.arrayContaining(['unit', 'integration', 'web', 'types']));
      expect(projects).not.toContain('ai');
      expect(projects).not.toContain('ops');
      expect(run.get('x.test.ts')).toEqual(['unit']);
      expect(run.get('x.test.tsx')).toEqual(['web']);
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

    it('files under dist and node_modules are never collected', () => {
      const paths = [...listed.keys()];
      const inIgnoredFolder = paths.filter((path) =>
        path.split('/').some((folder) => ignoredFolders.includes(folder)),
      );

      expect(paths, 'the tree has collected files').toContain('x.test.ts');
      expect(inIgnoredFolder).toEqual([]);
    });

    it('a Playwright spec under e2e lands in no project and is not a test file one must collect', () => {
      expect(listed.has('e2e/x.spec.ts')).toBe(false);
      expect(isCollectable('e2e/x.spec.ts')).toBe(false);
    });
  });

  // The coverage include follows the project globs, so a threshold on one domain later sees every
  // source file in it, also one that no test loads (docs/plan/11-quality-and-testing.md).
  describe('coverage in a synthetic tree', () => {
    const sources = [
      'x.ts',
      'packages/a/src/x.ts',
      'apps/a/src/x.tsx',
      'scripts/x.mjs',
      'scripts/x.mts',
    ];
    const left = [
      'docs/sources/spike/x.ts',
      'dist/x.ts',
      'packages/a/dist/x.ts',
      'node_modules/pkg/x.ts',
      'packages/a/test/fixtures/x.ts',
      'fixtures/x.mjs',
      'packages/a/src/x.d.ts',
      'x.test-d.ts',
      'x.int.test.ts',
      'x.test.tsx',
      'e2e/x.spec.ts',
      'vite.config.ts',
      'apps/web/vite.config.ts',
      'playwright.config.ts',
    ];
    let directory: string;

    beforeAll(() => {
      directory = realpathSync(mkdtempSync(join(tmpdir(), 'coverage-')));
      for (const path of [...sources, ...left]) {
        mkdirSync(dirname(join(directory, path)), { recursive: true });
        writeFileSync(join(directory, path), 'export const one = 1;\n');
      }
      writeFileSync(join(directory, 'x.test.ts'), "it('runs', () => {});\n");
    });

    afterAll(() => {
      rmSync(directory, { recursive: true, force: true });
    });

    it('coverage include follows the project globs and leaves out docs/sources, dist, fixtures, Playwright specs and config files', () => {
      expect(covered(directory)).toEqual([...sources].sort());
    }, 60_000);
  });
});
