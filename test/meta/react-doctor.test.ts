import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

interface WorkspaceConfig {
  packages?: string[];
  catalog?: Record<string, string>;
}

interface PackageJson {
  name?: string;
  private?: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
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

// Every package a manifest names in any of its dependency fields.
function declared(manifest: PackageJson): string[] {
  return Object.keys({
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.peerDependencies,
    ...manifest.optionalDependencies,
  });
}

// react-doctor's license is a modified MIT text that restricts some AI-related uses, so it is a
// reviewed exception for a dev tool that runs in CI only and never ships
// (docs/adr/0020-frontend-libraries-tanstack-router-apollo-client-4-shadcn-ui-and-forms.md,
// docs/adr/0040-dependency-license-policy-ci-gate-and-sbom.md).
describe('react-doctor', () => {
  // A package without private: true can be published to npm, and a dependency it lists would reach
  // every project that installs it.
  it('no published @northmes package lists react-doctor in its dependencies', () => {
    const published = workspaceManifests().filter((path) => {
      const manifest = readPackageJson(path);
      return manifest.private !== true && manifest.name?.startsWith('@northmes/') === true;
    });

    expect(published, 'published workspace packages').toContain('packages/sdk/package.json');
    for (const path of published) {
      expect(declared(readPackageJson(path)), path).not.toContain('react-doctor');
    }
  });

  // Renovate and the catalog keep one exact version, and a dev dependency of the private root
  // package is installed for CI and never published.
  it('the root package takes react-doctor from the catalog as a dev dependency at an exact version', () => {
    const rootManifest = readPackageJson('package.json');

    expect(rootManifest.private).toBe(true);
    expect(rootManifest.devDependencies?.['react-doctor']).toBe('catalog:');
    expect(rootManifest.dependencies?.['react-doctor']).toBeUndefined();
    expect(readWorkspace().catalog?.['react-doctor']).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
