import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import vitestConfig from '../../vitest.config.ts';

interface ProjectConfig {
  extends?: boolean;
  test?: {
    name?: string;
    include?: string[];
    exclude?: string[];
    globalSetup?: string | string[];
  };
}

interface VitestConfig {
  test?: {
    globalSetup?: string | string[];
    projects?: ProjectConfig[];
  };
}

const root = fileURLToPath(new URL('../../', import.meta.url));
const config = vitestConfig as VitestConfig;
// The harness starts the container first; the server's setup then prepares its database.
const globalSetupPaths = [
  resolve(root, 'packages/testing/src/global-setup.ts'),
  resolve(root, 'apps/backend/test/global-setup.ts'),
];

function findProject(name: string): ProjectConfig | undefined {
  return config.test?.projects?.find((project) => project.test?.name === name);
}

function resolved(globalSetup: string | string[] | undefined): string[] {
  return [globalSetup ?? []].flat().map((path) => resolve(root, path));
}

describe('vitest projects', () => {
  it('the integration project includes **/*.int.test.ts and runs the harness global setup, then the server one', () => {
    const integration = findProject('integration');

    expect(integration, 'project named integration').toBeDefined();
    expect(integration?.extends).toBe(true);
    expect(integration?.test?.include).toEqual(['**/*.int.test.ts']);
    expect(integration?.test?.exclude).toEqual(
      expect.arrayContaining(['**/node_modules/**', '**/dist/**', 'docs/sources/**']),
    );
    const effective = [
      ...resolved(config.test?.globalSetup),
      ...resolved(integration?.test?.globalSetup),
    ];
    expect(effective).toEqual(globalSetupPaths);
    for (const path of globalSetupPaths) {
      expect(existsSync(path), path).toBe(true);
    }
  });

  it('only the integration project runs a global setup', () => {
    const projects = config.test?.projects ?? [];
    const others = projects.filter((project) => project.test?.name !== 'integration');

    // A root-level globalSetup is inherited by every project that extends the root.
    expect(config.test?.globalSetup, 'root test.globalSetup').toBeUndefined();
    expect(others.map((project) => project.test?.name)).toContain('unit');
    for (const project of others) {
      expect(project.test?.globalSetup, `project ${project.test?.name}`).toBeUndefined();
    }
    expect(resolved(findProject('integration')?.test?.globalSetup)).toEqual(globalSetupPaths);
  });
});

describe('the harness needs no .env file', () => {
  it('git ls-files lists no .env file', () => {
    const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
      .split('\0')
      .filter(Boolean);

    expect(tracked, 'tracked files').toContain('package.json');
    expect(
      tracked.filter((path) => {
        const name = posix.basename(path);
        return name === '.env' || name.startsWith('.env.');
      }),
    ).toEqual([]);
  });

  it('the harness source mentions no .env, dotenv or loadEnvFile', () => {
    const sourceDir = resolve(root, 'packages/testing/src');
    const files = readdirSync(sourceDir, { recursive: true, withFileTypes: true }).filter((entry) =>
      entry.isFile(),
    );
    // process.env is not a file name: a .env counts only when no word character or dot precedes it.
    const envFileMention = /(^|[^\w.])\.env\b|dotenv|loadEnvFile/i;

    const names = files.map((entry) => entry.name);

    expect(names, 'harness source files').toContain('global-setup.ts');
    for (const entry of files) {
      const path = resolve(entry.parentPath, entry.name);
      expect(readFileSync(path, 'utf8'), path).not.toMatch(envFileMention);
    }
  });
});
