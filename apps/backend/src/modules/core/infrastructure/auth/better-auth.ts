// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Secrets, type ServerEnv, secretsConfig } from '@northmes/sdk/config';
import { betterAuth } from 'better-auth';
import { PostgresDialect } from 'kysely';
import type { Pool } from 'pg';
import { rolePool } from '../../../../db/pool.ts';
import { WEB_ORIGINS } from '../../../../http/web-origins.module.ts';
import { type AuthOptionsInput, authOptions } from './auth-options.ts';

/** The login of Better Auth's own pool (ADR 0010): rights on the auth schema only. */
const authRole = 'nm_auth';

/** A Better Auth instance with NorthMES's options. */
export function createAuth(input: AuthOptionsInput) {
  return betterAuth(authOptions(input));
}

/** The Better Auth instance of the server, with the API of every plugin it runs. */
export type Auth = ReturnType<typeof createAuth>;

/**
 * Better Auth for the server, on a pool of its own that logs in as nm_auth (ADR 0010). The pool
 * and the instance are created when first used, so pnpm northmes migrate, whose secrets hold
 * neither nm_auth's password nor Better Auth's secret, builds the app without them. The pool ends
 * when the app shuts down.
 */
@Injectable()
export class BetterAuth implements OnApplicationShutdown {
  #pool?: Pool;
  #auth?: Auth;

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService<ServerEnv, true>,
    @Inject(secretsConfig.KEY) private readonly secrets: Secrets,
    @Inject(WEB_ORIGINS) private readonly webOrigins: readonly string[],
  ) {}

  /** The instance, created on first use. */
  get auth(): Auth {
    if (!this.#auth) {
      const pool = rolePool(
        this.config.get('DATABASE_URL', { infer: true }),
        authRole,
        this.secrets.NORTHMES_DB_AUTH_PASSWORD ?? '',
      );
      this.#pool = pool;
      this.#auth = createAuth({
        dialect: new PostgresDialect({ pool }),
        baseURL: this.config.get('NORTHMES_PUBLIC_ORIGIN', { infer: true }),
        secret: this.secrets.NORTHMES_AUTH_SECRET ?? '',
        webOrigins: this.webOrigins,
      });
    }
    return this.#auth;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.#pool?.end();
  }
}
