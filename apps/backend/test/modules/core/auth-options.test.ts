// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { emptyPostgres } from '../../../src/modules/core/infrastructure/auth/auth-migration.ts';
import { disabledPaths } from '../../../src/modules/core/infrastructure/auth/auth-options.ts';
import { createAuth } from '../../../src/modules/core/infrastructure/auth/better-auth.ts';

/** The HTTP path of every endpoint of Better Auth with NorthMES's options. */
function endpointPaths(): string[] {
  const auth = createAuth({
    dialect: emptyPostgres,
    baseURL: 'http://127.0.0.1:4100',
    secret: 'a-test-secret-that-is-long-enough-for-better-auth',
    webOrigins: [],
  });
  return Object.values(auth.api as Record<string, { path?: string }>)
    .map(({ path }) => path)
    .filter((path): path is string => path !== undefined);
}

describe("Better Auth's HTTP paths", () => {
  it('E05-S05 every path of the admin and api-key plugins is disabled, so they run only through auth.api on the server', () => {
    const paths = endpointPaths();
    const serverSide = paths.filter((path) => /^\/(admin|api-key)\//.test(path));

    expect(serverSide.length).toBeGreaterThan(0);
    expect(serverSide.filter((path) => !disabledPaths.includes(path))).toEqual([]);
    // A path that Better Auth renamed would leave its new name open, so every listed path exists.
    expect(disabledPaths.filter((path) => !paths.includes(path))).toEqual([]);
  });
});
