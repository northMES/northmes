import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

interface WorkspaceConfig {
  packages?: string[];
  pmOnFail?: string;
  allowBuilds?: Record<string, boolean>;
}

interface PackageJson {
  license?: string;
}

const root = fileURLToPath(new URL('../../', import.meta.url));

function readText(path: string): string {
  return readFileSync(`${root}${path}`, 'utf8');
}

function readWorkspace(): WorkspaceConfig {
  return parse(readText('pnpm-workspace.yaml')) as WorkspaceConfig;
}

function readPackageJson(path: string): PackageJson {
  return JSON.parse(readText(path)) as PackageJson;
}

describe('workspace', () => {
  it('pnpm-workspace.yaml sets pmOnFail ignore and refuses builds of cpu-features, protobufjs and ssh2', () => {
    const workspace = readWorkspace();

    expect(workspace.pmOnFail).toBe('ignore');
    for (const name of ['cpu-features', 'protobufjs', 'ssh2']) {
      expect(workspace.allowBuilds?.[name], name).toBe(false);
    }
  });

  it('every workspace package.json sets a license field', () => {
    const patterns = readWorkspace().packages ?? [];
    expect(patterns, 'packages globs in pnpm-workspace.yaml').not.toHaveLength(0);

    // Only the root package.json exists for now; the globs match nothing yet.
    const manifests = patterns
      .flatMap((pattern) => globSync(`${pattern}/package.json`, { cwd: root }))
      .filter((path) => !path.split('/').includes('node_modules'));

    expect(readPackageJson('package.json').license).toBe('AGPL-3.0-or-later');
    for (const path of manifests) {
      const { license } = readPackageJson(path);
      expect(license, path).toEqual(expect.any(String));
      expect(license, path).not.toBe('');
    }
  });
});
