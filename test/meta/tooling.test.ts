import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

interface TurboTask {
  cache?: boolean;
  dependsOn?: string[];
  outputs?: string[];
}

interface TurboConfig {
  tasks?: Record<string, TurboTask>;
}

const root = fileURLToPath(new URL('../../', import.meta.url));

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(`${root}${path}`, 'utf8')) as T;
}

describe('tooling', () => {
  it('turbo.json caches build, typecheck and lint and defines no test task', () => {
    const tasks = readJson<TurboConfig>('turbo.json').tasks ?? {};

    for (const name of ['build', 'typecheck', 'lint']) {
      expect(tasks[name], name).toBeDefined();
      expect(tasks[name]?.cache, name).not.toBe(false);
    }
    expect(Object.keys(tasks).filter((name) => name.startsWith('test'))).toEqual([]);
  });
});
