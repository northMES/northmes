import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
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
});
