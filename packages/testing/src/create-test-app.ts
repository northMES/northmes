// SPDX-License-Identifier: MIT
import type { DynamicModule, INestApplication } from '@nestjs/common';
import { configForTest } from './config-for-test.ts';
import type { TestDatabase } from './database.ts';

/** What createTestApp hands the host factory. */
export interface HostOptions {
  /** The ids of the in-repo modules the app boots, such as core and planning. */
  readonly modules: readonly string[];
  /** The ConfigModule that configForTest built, which the host imports first (ADR 0060). */
  readonly config: DynamicModule;
  /** The origins of the web app, as webOrigins in northmes.config.json lists them. */
  readonly webOrigins?: readonly string[];
}

/** A host app built in the test process. */
export interface TestApp {
  /** The Nest app, which listens on nothing. The test closes it. */
  readonly app: INestApplication;
  /** The ids of the modules the app booted, in boot order. */
  readonly modules: readonly string[];
}

/**
 * Builds the host app of apps/backend, which exports it at @northmes/backend/testing. The caller
 * passes it in, so this MIT package imports no AGPL code (ADR 0056).
 */
export type HostFactory = (options: HostOptions) => Promise<TestApp>;

export interface CreateTestAppOptions {
  /** The ids of the in-repo modules the app boots. Plugins are not supported (ADR 0037). */
  readonly modules: readonly string[];
  readonly hostFactory: HostFactory;
  /**
   * The database from useTestDatabase() that the app's pool logs in to as nm_app, and Better Auth's
   * pool as nm_auth. Without it, the app reaches no database.
   */
  readonly database?: Pick<TestDatabase, 'appUrl' | 'authUrl'>;
  /** The origins of the web app, webOrigins in northmes.config.json. It defaults to none. */
  readonly webOrigins?: readonly string[];
}

/**
 * The secret of Better Auth in a test app. It signs nothing outside the test, and every app on one
 * database uses it, so the JWT key one app stored decrypts in the next.
 */
const testAuthSecret = 'northmes-test-auth-secret-0123456789abcdef';

/** The password of a role in a URL from useTestDatabase(). */
function passwordOf(url: string): string {
  return decodeURIComponent(new URL(url).password);
}

/**
 * The configuration of a test app whose pools log in to `database`: DATABASE_URL without a login
 * and the passwords of nm_app and nm_auth as secrets, as the server reads them (ADR 0060). Without
 * a database, only Better Auth's secret is set.
 */
function configForDatabase(
  database: Pick<TestDatabase, 'appUrl' | 'authUrl'> | undefined,
): Promise<DynamicModule> {
  if (!database) return configForTest({}, { NORTHMES_AUTH_SECRET: testAuthSecret });
  const url = new URL(database.appUrl);
  url.username = '';
  url.password = '';
  return configForTest(
    { DATABASE_URL: url.href },
    {
      NORTHMES_DB_APP_PASSWORD: passwordOf(database.appUrl),
      NORTHMES_DB_AUTH_PASSWORD: passwordOf(database.authUrl),
      NORTHMES_AUTH_SECRET: testAuthSecret,
    },
  );
}

/**
 * Builds the host app in the test process with the in-repo modules that `modules` names and the
 * configuration of configForTest, with `database` when it is given, and initialises it
 * (ADR 0041). When init fails, it closes the app and rejects with the init error. Vitest's module
 * runner does not apply the resolve hook that loads plugins, so a test of a built plugin boots the
 * built server through bootBuilt instead (ADR 0037).
 */
export async function createTestApp({
  modules,
  hostFactory,
  database,
  webOrigins = [],
}: CreateTestAppOptions): Promise<TestApp> {
  const config = await configForDatabase(database);
  const testApp = await hostFactory({ modules, config, webOrigins });
  try {
    await testApp.app.init();
  } catch (error) {
    // The caller never gets an app whose init failed, so close it here and keep the init error.
    await testApp.app.close().catch(() => {});
    throw error;
  }
  return testApp;
}
