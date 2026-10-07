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

  it('the other root scripts exist', () => {
    expect(rootScripts.gen).toBe('node scripts/gen.mjs');
    expect(rootScripts.test).toBe('vitest run');
    expect(rootScripts['test:unit']).toBe('vitest run --project unit');
    expect(rootScripts['test:int']).toBe('vitest run --project integration');
    expect(rootScripts['test:tz']).toBe('vitest run --project tz');
  });

  it('lint, typecheck and build go through turbo', () => {
    expect(rootScripts.lint).toBe('turbo run lint');
    expect(rootScripts.typecheck).toBe('turbo run typecheck');
    expect(rootScripts.build).toBe('turbo run build');
  });
});
