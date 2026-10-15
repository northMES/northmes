// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { emptyPostgres } from '../../../src/modules/core/infrastructure/auth/auth-migration.ts';
import {
  disabledPaths,
  renewedExpiry,
  SESSION_ABSOLUTE_LIFETIME_SECONDS,
  sessionIsLive,
} from '../../../src/modules/core/infrastructure/auth/auth-options.ts';
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

describe('the absolute lifetime of a session', () => {
  const hour = 60 * 60 * 1000;
  const createdAt = new Date('2026-10-15T06:00:00Z');
  const end = new Date(createdAt.getTime() + SESSION_ABSOLUTE_LIFETIME_SECONDS * 1000);
  const at = (hours: number) => new Date(createdAt.getTime() + hours * hour);

  it('E05-S05 a renewal keeps its own expiry while that comes before the absolute end', () => {
    expect(renewedExpiry(createdAt, at(13), at(1))).toEqual(at(13));
  });

  it('E05-S05 a renewal never extends a session past its absolute end', () => {
    expect(renewedExpiry(createdAt, at(35), at(23))).toEqual(end);
  });

  it('E05-S05 a session past its absolute end is not renewed', () => {
    expect(renewedExpiry(createdAt, at(37), at(25))).toBeNull();
  });

  it('E05-S05 a session is live until it expires or reaches its absolute end, whichever comes first', () => {
    expect(sessionIsLive({ createdAt, expiresAt: at(12) }, at(11))).toBe(true);
    expect(sessionIsLive({ createdAt, expiresAt: at(12) }, at(12))).toBe(false);
    expect(sessionIsLive({ createdAt, expiresAt: at(30) }, at(23))).toBe(true);
    expect(sessionIsLive({ createdAt, expiresAt: at(30) }, at(24))).toBe(false);
  });
});
