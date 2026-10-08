// SPDX-License-Identifier: AGPL-3.0-or-later
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { HostFactory } from '@northmes/testing';
import { Pool, type PoolClient } from 'pg';
import { AppModule } from './app.module.ts';
import { imageVersion, importServers, inRepoCatalog } from './boot/boot.ts';
import type { CatalogEntry } from './catalog/check-catalog.ts';
import { builtShellDir } from './web/static-mounts.ts';
import { serveWeb } from './web/web.module.ts';

/**
 * The host factory that createTestApp from @northmes/testing calls (ADR 0041). It runs the boot
 * steps of ADR 0002 that come before listening, in the test process: the catalog of the in-repo
 * modules that `modules` names, the server entry of each of them that has one, then the Nest app
 * with the test's ConfigModule as AppModule's first import and a subgraph per server entry. The app
 * listens on nothing. A catalog problem throws one BootError. A provider that fails to build
 * rejects with its error, where Nest would by default abort the process and the Vitest worker with
 * it.
 */
export const hostFactory: HostFactory = createHostFactory();

/**
 * The host factory of hostFactory, whose app serves the web files under webDir: the shell from
 * shell/ and each module's built remote from modules/<id>/.
 */
export function hostFactoryWithWebFiles(webDir: string): HostFactory {
  return createHostFactory(webDir);
}

/**
 * Builds the app of hostFactory and serves its web files as boot does: the built shell and each
 * module's remote from web/dist/ of its package, or the files under webDir when it is given.
 */
function createHostFactory(webDir?: string): HostFactory {
  return async ({ modules, config }) => {
    const catalog = await inRepoCatalog((specifier) => import(specifier), { modules });
    const servers = await importServers(catalog);
    const app = await NestFactory.create<NestExpressApplication>(
      AppModule.forRoot(config, servers),
      {
        logger: ['error', 'warn'],
        abortOnError: false,
      },
    );
    const web =
      webDir === undefined ? { shellDir: builtShellDir, catalog } : filesIn(webDir, catalog);
    serveWeb(app, { northmes: imageVersion(), ...web });
    return { app, modules: catalog.map(({ manifest }) => manifest.id) };
  };
}

/** The shell in <webDir>/shell/ and each module's remote in <webDir>/modules/<id>/. */
function filesIn(webDir: string, catalog: readonly CatalogEntry[]) {
  return {
    shellDir: join(webDir, 'shell'),
    catalog: catalog.map((entry) => ({
      ...entry,
      webDir: join(webDir, 'modules', entry.manifest.id),
    })),
  };
}

/** What statementsDuring returns. */
export interface StatementsDuring<Result> {
  /** What fn resolved to. */
  readonly result: Result;
  /** The SQL text of each statement the pool sent while fn ran, in the order it sent them. */
  readonly statements: readonly string[];
}

/** The SQL text of the first argument of a pg query call: a string or a query config. */
function statementText(query: unknown): string {
  if (typeof query === 'string') return query;
  const text = (query as { text?: unknown } | null)?.text;
  return typeof text === 'string' ? text : '';
}

/**
 * Runs fn and records every statement that the app's nm_app pool sends until fn settles, such as
 * the reads of one GraphQL request. A test counts them, for example to show that the rows a list
 * references are read in one batch and not once per row. The pool's clients are wrapped only while
 * fn runs.
 */
export async function statementsDuring<Result>(
  app: INestApplication,
  fn: () => Promise<Result>,
): Promise<StatementsDuring<Result>> {
  const pool = app.get(Pool);
  const statements: string[] = [];
  const wrapped = new Set<PoolClient>();
  // The pool emits acquire before it hands a client out, also an idle one it reuses.
  const wrap = (client: PoolClient) => {
    if (wrapped.has(client)) return;
    wrapped.add(client);
    const query: (...args: unknown[]) => unknown = client.query;
    client.query = ((...args: unknown[]) => {
      statements.push(statementText(args[0]));
      return Reflect.apply(query, client, args);
    }) as PoolClient['query'];
  };
  pool.on('acquire', wrap);
  try {
    return { result: await fn(), statements };
  } finally {
    pool.off('acquire', wrap);
    // Each client reads query from pg's Client prototype again.
    for (const client of wrapped) Reflect.deleteProperty(client, 'query');
  }
}
