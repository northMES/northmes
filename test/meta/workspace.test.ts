import { spawnSync } from 'node:child_process';
import { existsSync, globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

interface WorkspaceConfig {
  packages?: string[];
  pmOnFail?: string;
  allowBuilds?: Record<string, boolean>;
  catalogMode?: string;
  catalog?: Record<string, string>;
  catalogs?: Record<string, Record<string, string>>;
}

interface PackageJson {
  license?: string;
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
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

function git(...args: string[]): string {
  return spawnSync('git', args, { cwd: root, encoding: 'utf8' }).stdout;
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

  it('the catalog pins exactly one TypeScript 6.0 version', () => {
    const workspace = readWorkspace();

    expect(workspace.catalogMode).toBe('strict');
    expect(workspace.catalog?.typescript).toMatch(/^6\.0\.\d+$/);
    for (const [name, catalog] of Object.entries(workspace.catalogs ?? {})) {
      expect(catalog.typescript, `catalogs.${name}`).toBeUndefined();
    }
    expect(readPackageJson('package.json').devDependencies?.typescript).toBe('catalog:');
  });

  it('.node-version and .nvmrc name the same Node major', () => {
    const major = (path: string) => Number.parseInt(readText(path).trim().replace(/^v/, ''), 10);

    const nodeVersion = major('.node-version');
    expect(nodeVersion).not.toBeNaN();
    expect(major('.nvmrc')).toBe(nodeVersion);
  });

  // handoff's Tester runs `pnpm check`. This stub keeps it green on the Node 24 worker
  // until the real gate (Node check, lint, typecheck, gen --check, Vitest projects) replaces it.
  it('the root check script is the temporary stub that runs only the unit project', () => {
    expect(readPackageJson('package.json').scripts?.check).toBe('vitest run --project unit');
  });
});

// This test runs git, so it needs a git work tree. In a worktree `.git` is a file; existsSync accepts both.
describe.skipIf(!existsSync(`${root}.git`))('repository', () => {
  it('.gitignore ignores internal material and build output, and none of it is tracked', () => {
    const ignored = [
      'docs/research/x.md',
      'docs/project-brief.md',
      'rp-manifest.md',
      'dist/x',
      'packages/sdk/dist/index.js',
      '.turbo/x',
      'coverage/x',
      'x.tsbuildinfo',
      '.env',
    ];

    expect(git('check-ignore', ...ignored).split('\n').filter(Boolean)).toEqual(ignored);
    expect(git('ls-files', 'docs/research', 'docs/project-brief.md', 'rp-manifest.md')).toBe('');
  });
});
