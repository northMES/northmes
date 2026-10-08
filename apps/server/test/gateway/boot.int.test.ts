// SPDX-License-Identifier: AGPL-3.0-or-later
import type { INestApplication } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { boot } from '../../src/boot/boot.ts';
import { serverEnvKeys, useServerEnv } from '../fixtures/server-env.ts';
import { alpha } from '../fixtures/subgraphs/alpha.ts';
import { fixtureCatalog } from '../fixtures/subgraphs/catalog.ts';
import { zeta } from '../fixtures/subgraphs/non-null-contribution.ts';
import { delta, epsilon } from '../fixtures/subgraphs/two-owners.ts';
import { gamma } from '../fixtures/subgraphs/unprefixed.ts';

/** Collects the lines boot writes. */
function recordingLog() {
  return { info: vi.fn<(line: string) => void>(), error: vi.fn<(line: string) => void>() };
}

/** The message of a boot whose fixture modules break each NorthMES rule once. */
const everyRuleBroken = [
  'refused to start (3 problems)',
  '- [NORTHMES_ROOT_FIELD_PREFIX] Query.ping of subgraph "gamma" must start with "gamma" and an upper-case letter',
  '- [NORTHMES_TYPE_OWNERSHIP] Dimensions is defined in subgraphs "delta" and "epsilon"; one module owns a type that is not an entity',
  '- [NORTHMES_CONTRIBUTED_FIELD_NULLABLE] Thing.zetaWeight must be nullable: subgraph "zeta" adds it to an entity that subgraph "alpha" owns',
].join('\n');

describe('boot with a composition error', () => {
  const env = useServerEnv();
  let app: INestApplication | undefined;

  // ConfigModule writes the validated environment into process.env, as it does in the server. The
  // stubs remove these keys for each test, and unstubAllEnvs takes them out again afterwards.
  beforeEach(() => {
    for (const key of serverEnvKeys) vi.stubEnv(key, undefined);
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
    vi.unstubAllEnvs();
  });

  it('E02-S03 a composition error exits with code 1', async () => {
    const log = recordingLog();
    const exit = vi.fn<(code: number) => void>();

    app = await boot({
      env,
      ...fixtureCatalog(alpha, gamma, delta, epsilon, zeta),
      exit,
      log,
    });

    expect(app).toBeUndefined();
    expect(exit.mock.calls).toEqual([[1]]);
    expect(log.error.mock.calls).toEqual([[everyRuleBroken]]);
  });
});
