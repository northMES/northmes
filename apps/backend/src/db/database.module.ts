// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  type DynamicModule,
  Global,
  Inject,
  Module,
  type OnApplicationShutdown,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Secrets, type ServerEnv, secretsConfig } from '@northmes/sdk/config';
import { DATABASE } from '@northmes/sdk/data';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { appPool } from './pool.ts';
import { noPoolDatabase, scopedDatabase } from './scoped-database.ts';

/**
 * What the app connects to: 'app' is the nm_app pool and the ScopedDatabase on it. 'none' is
 * pnpm northmes migrate, whose secrets hold only the owner password, so it constructs no pool
 * (ADR 0060).
 */
export type DatabaseMode = 'app' | 'none';

/**
 * Provides the server's one nm_app pool, under the Pool class, and the ScopedDatabase on it under
 * DATABASE. Global, so every module's Nest module injects DATABASE without importing this one; it
 * holds no resolvers, so it adds nothing to the schema. The pool ends when the app shuts down. In
 * mode 'none' there is no pool to end.
 */
@Global()
@Module({})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Optional() @Inject(Pool) private readonly pool?: Pool) {}

  /**
   * The module for `mode`. With 'none' it provides no Pool, and DATABASE is a ScopedDatabase whose
   * every transaction rejects, so a module's Nest module still resolves.
   */
  static forRoot(mode: DatabaseMode): DynamicModule {
    if (mode === 'none') {
      return {
        module: DatabaseModule,
        providers: [{ provide: DATABASE, useValue: noPoolDatabase }],
        exports: [DATABASE],
      };
    }
    return {
      module: DatabaseModule,
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
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool?.end();
  }
}
