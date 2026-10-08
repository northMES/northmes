import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prepareDatabase, startStack } from './stack.mjs';

// These tests start no container and touch no database: a fake starter stands in for
// Testcontainers and the database steps do nothing. dev-up.int.test.ts runs the real ones.
let stateDir: string;

beforeEach(() => {
  stateDir = mkdtempSync(join(tmpdir(), 'northmes-stack-'));
});

afterEach(() => {
  rmSync(stateDir, { recursive: true, force: true });
});

type ContainerSettings = { image: string; password: string; reuse: boolean };

/** A starter that starts nothing: it records each start's settings and counts stop calls. */
function fakeContainers() {
  const starts: ContainerSettings[] = [];
  const stop = vi.fn(async () => {});
  async function startContainer(settings: ContainerSettings) {
    starts.push(settings);
    return { getHost: () => '127.0.0.1', getPort: () => 54_320, stop };
  }
  return { starts, stop, startContainer };
}

/** Database steps that do nothing, since the container is a fake. */
async function prepare() {}

/** Starts the stack with env as its own environment, and says whether it reused its container. */
async function reusesUnder(env: Readonly<Record<string, string>>): Promise<boolean | undefined> {
  const containers = fakeContainers();
  await startStack({ stateDir, env, startContainer: containers.startContainer, prepare });
  return containers.starts[0]?.reuse;
}

describe('startStack', () => {
  it('E02-S08 the stack reuses its Postgres container only with NORTHMES_STACK_REUSE=1 and never in CI', async () => {
    expect(await reusesUnder({})).toBe(false);
    expect(await reusesUnder({ NORTHMES_STACK_REUSE: 'true' })).toBe(false);
    expect(await reusesUnder({ NORTHMES_STACK_REUSE: '1' })).toBe(true);
    // GitHub Actions sets CI=true in every job.
    expect(await reusesUnder({ NORTHMES_STACK_REUSE: '1', CI: 'true' })).toBe(false);
  });

  it('E02-S08 stop leaves a reused container running and stops any other container once', async () => {
    const reused = fakeContainers();
    const notReused = fakeContainers();
    const withReuse = await startStack({
      stateDir,
      env: { NORTHMES_STACK_REUSE: '1' },
      startContainer: reused.startContainer,
      prepare,
    });
    const withoutReuse = await startStack({
      stateDir,
      env: {},
      startContainer: notReused.startContainer,
      prepare,
    });

    await withReuse.stop();
    await withoutReuse.stop();

    expect(reused.stop).not.toHaveBeenCalled();
    expect(notReused.stop).toHaveBeenCalledTimes(1);
  });

  it('E02-S08 the stack takes its port after the database steps, which run without PORT', async () => {
    // The port is free only until a process binds it, and the database steps take seconds, so the
    // stack takes the port once they are done.
    const stepEnvs: Readonly<Record<string, string>>[] = [];
    const { startContainer } = fakeContainers();
    const stack = await startStack({
      stateDir,
      env: {},
      startContainer,
      prepare: async (env) => {
        stepEnvs.push(env);
      },
    });

    expect(stepEnvs).toHaveLength(1);
    expect(stepEnvs[0]?.DATABASE_URL).toBe('postgres://127.0.0.1:54320/northmes');
    expect(stepEnvs[0]).not.toHaveProperty('PORT');
    expect(stepEnvs[0]).not.toHaveProperty('NORTHMES_PUBLIC_ORIGIN');
    expect(Number(stack.env.PORT)).toBeGreaterThan(0);
    expect(stack.env.NORTHMES_PUBLIC_ORIGIN).toBe(`http://127.0.0.1:${stack.env.PORT}`);
  });

  it('E02-S08 the stack reports each step before it runs it', async () => {
    // pnpm dev and pnpm demo show these lines, since the output of pnpm northmes appears only when
    // a step fails.
    const events: string[] = [];
    const { startContainer } = fakeContainers();

    await startStack({
      stateDir,
      env: {},
      startContainer: async (settings) => {
        events.push('<container started>');
        return startContainer(settings);
      },
      northmes: async (args) => {
        events.push(`<pnpm northmes ${args.join(' ')}>`);
        return { exitCode: 0, stdout: '', stderr: '' };
      },
      prepare: (env, options) =>
        prepareDatabase(env, {
          ...options,
          seed: async () => {
            events.push('<seed>');
          },
        }),
      log: (line) => events.push(line),
    });

    expect(events).toEqual([
      expect.stringMatching(/^Starting Postgres from postgres:18@sha256:/),
      '<container started>',
      'Creating the database roles: pnpm northmes db bootstrap',
      '<pnpm northmes db bootstrap>',
      'Migrating the database: pnpm northmes migrate',
      '<pnpm northmes migrate>',
      'Seeding the fictional articles and production orders',
      '<seed>',
    ]);
  });
});
