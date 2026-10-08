import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { demoPlan } from '../../scripts/stack/demo.mjs';

interface LaunchJson {
  version?: string;
  configurations?: {
    name?: string;
    runtimeExecutable?: string;
    runtimeArgs?: string[];
    port?: number;
    autoPort?: boolean;
  }[];
}

interface PackageJson {
  scripts?: Record<string, string>;
}

const root = fileURLToPath(new URL('../../', import.meta.url));

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(`${root}${path}`, 'utf8')) as T;
}

describe('.claude/launch.json', () => {
  it('E02-S08 handoff-demo runs the built all process through the stack script on PORT', async () => {
    const { version, configurations = [] } = readJson<LaunchJson>('.claude/launch.json');
    const demo = configurations.find(({ name }) => name === 'handoff-demo');
    const { scripts = {} } = readJson<PackageJson>('package.json');

    // The format of Claude Code's desktop preview, which handoff reads too.
    expect(version).toBe('0.0.1');
    // handoff gives each demo a free port in PORT, and with autoPort the desktop preview passes one
    // in PORT when the configured port is taken. 3000 is handoff's dashboard.
    expect(demo).toEqual({
      name: 'handoff-demo',
      runtimeExecutable: 'pnpm',
      runtimeArgs: ['demo'],
      port: expect.any(Number),
      autoPort: true,
    });
    expect(demo?.port).not.toBe(3000);
    expect(scripts.demo).toBe('node scripts/stack/demo.mjs');

    // pnpm demo starts the stack, which took port 50001, and handoff gave the demo PORT 4567.
    const plan = await demoPlan({ PORT: '50001' }, { PORT: '4567' });

    expect(plan.build).toEqual({ name: 'build', command: 'pnpm', args: ['build'], env: {} });
    expect(plan.server).toEqual({
      name: 'server',
      command: 'node',
      args: ['apps/server/dist/main.js'],
      env: {
        NORTHMES_ROLE: 'all',
        PORT: '4567',
        NORTHMES_PUBLIC_ORIGIN: 'http://127.0.0.1:4567',
      },
    });
    expect(plan.boardUrl).toBe(
      'http://127.0.0.1:4567/019a0000-0000-7000-8000-00000000a001/planning/board',
    );
  });
});
