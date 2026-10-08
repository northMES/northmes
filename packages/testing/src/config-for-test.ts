// SPDX-License-Identifier: MIT
import type { DynamicModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { loadEnv, serverEnvSchema } from '@northmes/sdk/config';

/** What a test app runs with unless the overrides say otherwise. PORT 0 lets the OS pick a port. */
const testDefaults: Readonly<Record<string, string>> = { NODE_ENV: 'test', PORT: '0' };

/**
 * The ConfigModule of a test app (ADR 0060). It validates the test defaults with the overrides on
 * top through loadEnv(serverEnvSchema), as boot validates the server's environment, and registers
 * the result through load. forRoot neither reads nor writes process.env: it ignores env files,
 * validates no predefined variable and gets no validate function, and ConfigService skips
 * process.env. Two apps built in one process therefore share no values. A bad key throws one
 * ConfigError.
 */
export function configForTest(
  overrides: Readonly<Record<string, string>> = {},
): Promise<DynamicModule> {
  const env = loadEnv(serverEnvSchema)({ ...testDefaults, ...overrides });
  return ConfigModule.forRoot({
    isGlobal: true,
    ignoreEnvFile: true,
    validatePredefined: false,
    skipProcessEnv: true,
    load: [() => env],
  });
}
