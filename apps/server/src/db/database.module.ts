// SPDX-License-Identifier: AGPL-3.0-or-later
import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Secrets, type ServerEnv, secretsConfig } from '@northmes/sdk/config';
import { DATABASE } from '@northmes/sdk/data';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { appPool } from './pool.ts';
import { scopedDatabase } from './scoped-database.ts';

/**
 * Provides the server's one nm_app pool, under the Pool class, and the ScopedDatabase on it under
 * DATABASE. Global, so every module's Nest module injects DATABASE without importing this one; it
 * holds no resolvers, so it adds nothing to a subgraph. The pool ends when the app shuts down.
 */
@Global()
@Module({
  providers: [
    {
      provide: Pool,
      inject: [ConfigService, secretsConfig.KEY],
      useFactory: (config: ConfigService<ServerEnv, true>, secrets: Secrets) =>
        appPool(config.get('DATABASE_URL', { infer: true }), secrets.NORTHMES_DB_APP_PASSWORD),
    },
    {
      provide: DATABASE,
      inject: [Pool],
      useFactory: (pool: Pool) =>
        scopedDatabase(new Kysely({ dialect: new PostgresDialect({ pool }) })),
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(Pool) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
