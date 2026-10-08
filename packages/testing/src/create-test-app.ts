// SPDX-License-Identifier: MIT
import type { DynamicModule, INestApplication } from '@nestjs/common';
import { configForTest } from './config-for-test.ts';

/** What createTestApp hands the host factory. */
export interface HostOptions {
  /** The ids of the in-repo modules the app boots, such as core and planning. */
  readonly modules: readonly string[];
  /** The ConfigModule that configForTest built, which the host imports first (ADR 0060). */
  readonly config: DynamicModule;
}

/** A host app built in the test process. */
export interface TestApp {
  /** The Nest app, which listens on nothing. The test closes it. */
  readonly app: INestApplication;
  /** The ids of the modules the app booted, in boot order. */
  readonly modules: readonly string[];
}

/**
 * Builds the host app of apps/server, which exports it at @northmes/server/testing. The caller
 * passes it in, so this MIT package imports no AGPL code (ADR 0056).
 */
export type HostFactory = (options: HostOptions) => Promise<TestApp>;

export interface CreateTestAppOptions {
  /** The ids of the in-repo modules the app boots. Plugins are not supported (ADR 0037). */
  readonly modules: readonly string[];
  readonly hostFactory: HostFactory;
}

/**
 * Builds the host app in the test process with the in-repo modules that `modules` names and the
 * configuration of configForTest, and initialises it (ADR 0041). When init fails, it closes the app
 * and rejects with the init error. Vitest's module runner does not apply the resolve hook that
 * loads plugins, so a test of a built plugin boots the built server through bootBuilt instead
 * (ADR 0037).
 */
export async function createTestApp({
  modules,
  hostFactory,
}: CreateTestAppOptions): Promise<TestApp> {
  const testApp = await hostFactory({ modules, config: await configForTest() });
  try {
    await testApp.app.init();
  } catch (error) {
    // The caller never gets an app whose init failed, so close it here and keep the init error.
    await testApp.app.close().catch(() => {});
    throw error;
  }
  return testApp;
}
