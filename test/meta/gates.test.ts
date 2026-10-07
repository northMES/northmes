import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

interface PackageJson {
  scripts?: Record<string, string>;
}

const root = fileURLToPath(new URL('../../', import.meta.url));

function readPackageJson(path: string): PackageJson {
  return JSON.parse(readFileSync(`${root}${path}`, 'utf8')) as PackageJson;
}

const rootScripts = readPackageJson('package.json').scripts ?? {};

describe('gates', () => {
  it('test:handoff runs pnpm check', () => {
    expect(rootScripts['test:handoff']).toBe('pnpm check');
  });
});
