import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
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
const globalSetupPath = resolve(root, 'packages/testing/src/global-setup.ts');

function findProject(name: string): ProjectConfig | undefined {
  return config.test?.projects?.find((project) => project.test?.name === name);
}

function resolved(globalSetup: string | string[] | undefined): string[] {
  return [globalSetup ?? []].flat().map((path) => resolve(root, path));
}

describe('vitest projects', () => {
  it('the integration project includes **/*.int.test.ts and sets the global setup', () => {
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
    expect(effective).toEqual([globalSetupPath]);
    expect(existsSync(globalSetupPath), globalSetupPath).toBe(true);
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
    expect(resolved(findProject('integration')?.test?.globalSetup)).toEqual([globalSetupPath]);
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
});
