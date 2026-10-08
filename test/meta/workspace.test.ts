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
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
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

// Every workspace package.json that the globs in pnpm-workspace.yaml match.
function workspaceManifests(): string[] {
  return (readWorkspace().packages ?? [])
    .flatMap((pattern) => globSync(`${pattern}/package.json`, { cwd: root }))
    .filter((path) => !path.split('/').includes('node_modules'));
}

// Every package a manifest names as a dependency, dev dependency or peer.
function declared(manifest: PackageJson): string[] {
  return Object.keys({
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.peerDependencies,
  });
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

    const manifests = workspaceManifests();

    expect(readPackageJson('package.json').license).toBe('AGPL-3.0-or-later');
    for (const path of manifests) {
      const { license } = readPackageJson(path);
      expect(license, path).toEqual(expect.any(String));
      expect(license, path).not.toBe('');
    }
  });

  it('E02-S01 packages/* and modules/*/contracts are MIT and every other workspace package is AGPL-3.0-or-later', () => {
    const mit = /^(packages\/[^/]+|modules\/[^/]+\/contracts)\/package\.json$/;
    const manifests = workspaceManifests();

    expect(manifests, 'workspace manifests').toContain('apps/server/package.json');
    for (const path of manifests) {
      const expected = mit.test(path) ? 'MIT' : 'AGPL-3.0-or-later';
      expect(readPackageJson(path).license, path).toBe(expected);
    }
  });

  it('E02-S01 every package that lists @northmes/testing also lists the peers it requires', () => {
    // The harness imports graphql, vitest and zod at run time and takes each from the package that
    // runs it, so a package that leaves one out reaches it only through another package's folder.
    const testing = readPackageJson('packages/testing/package.json');
    const required = Object.keys(testing.peerDependencies ?? {}).filter(
      (name) => testing.peerDependenciesMeta?.[name]?.optional !== true,
    );
    const users = ['package.json', ...workspaceManifests()].filter((path) =>
      declared(readPackageJson(path)).includes('@northmes/testing'),
    );

    expect(required).toEqual(expect.arrayContaining(['graphql', 'vitest', 'zod']));
    expect(users).toContain('apps/server/package.json');
    for (const path of users) {
      const missing = required.filter((name) => !declared(readPackageJson(path)).includes(name));
      expect(missing, path).toEqual([]);
    }
  });

  it('E02-S01 modules/planning/domain lists @northmes/testing for the scheduler contract suite', () => {
    // E03-S09 runs the Scheduler contract suite from @northmes/testing in the domain package's tests
    // (plan 14), and listing the harness now keeps that run from changing the lockfile.
    const domain = readPackageJson('modules/planning/domain/package.json');

    expect(domain.devDependencies?.['@northmes/testing']).toBe('workspace:*');
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

  it('E02-S01 .gitignore ignores the local stack state and the drop-in plugins at the root only', () => {
    const ignored = [
      '.northmes/dev.env',
      '.northmes/secrets/x',
      'plugins/example-validator/dist/server.js',
    ];

    expect(git('check-ignore', ...ignored).split('\n').filter(Boolean)).toEqual(ignored);
    // Test fixtures hold plugins as well, and they are committed.
    expect(git('check-ignore', 'apps/server/test/fixtures/plugins/x/package.json')).toBe('');
  });

  it('E02-S01 .gitattributes marks the schema snapshots and the *.gen.* files as generated', () => {
    const generated = [
      'schema/api.graphql',
      'schema/supergraph.graphql',
      'modules/planning/schema.graphql',
      'modules/planning/web/src/documents.gen.ts',
    ];

    for (const path of generated) {
      expect(git('check-attr', 'linguist-generated', '--', path).trim(), path).toBe(
        `${path}: linguist-generated: true`,
      );
    }
  });
});
