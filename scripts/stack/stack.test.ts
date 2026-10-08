import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startStack } from './stack.mjs';

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
});
