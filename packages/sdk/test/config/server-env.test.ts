// SPDX-License-Identifier: MIT
import { ConfigError, loadEnv, serverEnvSchema } from '@northmes/sdk/config';
import { describe, expect, it } from 'vitest';

/** Calls fn and returns the ConfigError it throws, so a test can read its problems. */
function configErrorOf(fn: () => unknown): ConfigError {
  try {
    fn();
  } catch (error) {
    if (error instanceof ConfigError) return error;
    throw error;
  }
  throw new Error('expected a ConfigError, but nothing was thrown');
}

describe('serverEnvSchema', () => {
  it('E02-S01 a record without PORT fails naming PORT', () => {
    const error = configErrorOf(() =>
      loadEnv(serverEnvSchema)({ NORTHMES_PUBLIC_ORIGIN: 'https://mes.example.com' }),
    );

    expect(error.problems).toHaveLength(1);
    expect(error.problems[0]).toMatch(/^PORT: /);
  });

  it('E02-S01 PORT 0 is accepted as the number 0, so the operating system picks the port', () => {
    const env = loadEnv(serverEnvSchema)({
      PORT: '0',
      NORTHMES_PUBLIC_ORIGIN: 'https://mes.example.com',
    });

    expect(env.PORT).toBe(0);
  });

  it('E02-S01 a missing public origin, PORT 70000 and role web are listed together without their values', () => {
    const error = configErrorOf(() =>
      loadEnv(serverEnvSchema)({ PORT: '70000', NORTHMES_ROLE: 'web' }),
    );

    expect(error.problems.map((problem) => problem.split(':')[0]).sort()).toEqual([
      'NORTHMES_PUBLIC_ORIGIN',
      'NORTHMES_ROLE',
      'PORT',
    ]);
    expect(error.problems).toContain('PORT: must be an integer from 0 to 65535');
    expect(error.problems).toContain('NORTHMES_ROLE: must be all, api or worker');
    expect(error.message).not.toContain('70000');
    expect(error.message).not.toContain('web');
  });
});
