import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface PackageLock {
  packages: Record<string, { version?: string; integrity?: string; dependencies?: object }>;
}

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const dockerfile = read('Dockerfile');
const runLines = dockerfile.split('\n').filter((line) => /^RUN\b/.test(line));
const rootPnpm = (JSON.parse(read('package.json')) as { packageManager: string }).packageManager;

// Scorecard's Pinned-Dependencies check counts `npm install` in a Dockerfile as unpinned and
// `npm ci` as pinned (ADR 0050), so the image installs pnpm from a lockfile with its integrity.
describe('the NorthMES image (ADR 0080)', () => {
  it('ADR0050 installs no npm package without a lockfile', () => {
    expect(runLines.filter((line) => /\bnpm\s+(install|i|add)\b/.test(line))).toEqual([]);
  });

  it('ADR0050 installs pnpm with npm ci from deploy/pnpm', () => {
    expect(dockerfile).toMatch(/^COPY deploy\/pnpm\/package\.json deploy\/pnpm\/package-lock\.json /m);
    expect(runLines.some((line) => /\bnpm ci\b/.test(line))).toBe(true);
  });

  it('pins the pnpm version that the root packageManager names, with its integrity', () => {
    const lock = JSON.parse(read('deploy/pnpm/package-lock.json')) as PackageLock;
    const pnpm = lock.packages['node_modules/pnpm'];

    expect(`pnpm@${pnpm?.version}`).toBe(rootPnpm);
    expect(pnpm?.integrity).toMatch(/^sha512-/);
    expect(pnpm?.dependencies).toBeUndefined();
  });
});
