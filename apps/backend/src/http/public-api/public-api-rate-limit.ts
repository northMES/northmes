// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { HttpStatus, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { ServerEnv } from '@northmes/sdk/config';
import { DATABASE, type ScopedDatabase } from '@northmes/sdk/data';
import { DomainError } from '@northmes/sdk/errors';
import { sql } from 'kysely';
import { type Principal, runAs } from '../../principal.ts';

/** The window of the public API's rate limits: one minute (ADR 0073 section 6). */
const WINDOW_MS = 60_000;

/** How often one process deletes the rows whose window and block have passed. */
const PRUNE_EVERY_MS = 60_000;

/** What a ThrottlerStorage answers for a hit, which the package's index does not export. */
type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

/** A row of core.rate_limit_hit. */
interface HitRow {
  readonly total_hits: number;
  readonly window_ends_at: Date;
  readonly blocked_until: Date | null;
}

/** The whole seconds from now until `at`, at least 0. */
function secondsUntil(at: Date, now: number): number {
  return Math.max(0, Math.ceil((at.getTime() - now) / 1000));
}

/**
 * The Postgres ThrottlerStorage of @nestjs/throttler that ADR 0064 and ADR 0073 require: each hit
 * is counted in core.rate_limit through core.rate_limit_hit, so every backend process of an
 * installation shares one count per key. A window is fixed: it starts with the first hit after the
 * last one ended. A hit past the limit blocks the key for blockDuration. At most once a minute, a
 * hit also deletes the rows whose window and block have passed, through core.rate_limit_prune.
 */
@Injectable()
export class PostgresThrottlerStorage implements ThrottlerStorage {
  readonly #logger = new Logger('PublicApiRateLimit');
  #prunedAt = Date.now();

  constructor(@Inject(DATABASE) private readonly db: ScopedDatabase<unknown>) {}

  /**
   * Counts one hit of `key` for `throttlerName`, with `ttl` and `blockDuration` in milliseconds,
   * and answers the record in seconds, as @nestjs/throttler's own storage does.
   */
  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const row = await runAs(null, () =>
      this.db.transaction(async (tx) => {
        const { rows } = await sql<HitRow>`
          select total_hits, window_ends_at, blocked_until
            from core.rate_limit_hit(${key}, ${throttlerName}, ${ttl}::integer,
                                     ${limit}::integer, ${blockDuration}::integer)`.execute(tx);
        return rows[0];
      }),
    );
    if (!row) throw new Error('core.rate_limit_hit answered no row');
    await this.#pruneWhenDue();
    const now = Date.now();
    const blocked = row.blocked_until !== null && row.blocked_until.getTime() > now;
    return {
      totalHits: row.total_hits,
      timeToExpire: secondsUntil(row.window_ends_at, now),
      isBlocked: blocked,
      timeToBlockExpire: row.blocked_until ? secondsUntil(row.blocked_until, now) : 0,
    };
  }

  /** Deletes every row whose window and block have passed, and answers how many it deleted. */
  async prune(): Promise<number> {
    this.#prunedAt = Date.now();
    return runAs(null, () =>
      this.db.transaction(async (tx) => {
        const { rows } = await sql<{ pruned: number }>`
          select core.rate_limit_prune() as pruned`.execute(tx);
        return rows[0]?.pruned ?? 0;
      }),
    );
  }

  /** Prunes once PRUNE_EVERY_MS have passed since the last prune; a failure is only logged. */
  async #pruneWhenDue(): Promise<void> {
    if (Date.now() - this.#prunedAt < PRUNE_EVERY_MS) return;
    try {
      await this.prune();
    } catch (error) {
      this.#logger.error(
        'Deleting the passed rate limit windows failed; the next prune tries again',
        error,
      );
    }
  }
}

/** Which of the public API's limits a request counts against. */
export type RateLimitKind = 'reads' | 'writes';

/**
 * The rate limits of the public REST API (ADR 0073 section 6, ADR 0082), off unless NORTHMES_API_RATE_LIMIT
 * is on. Each credential gets NORTHMES_API_RATE_LIMIT_READS reads (GET routes) and
 * NORTHMES_API_RATE_LIMIT_WRITES writes (POST routes) a minute, counted apart, in the
 * PostgresThrottlerStorage. The count is per credential, its core.credential id, never per client
 * address. A principal without a credential, such as a test credential that acts as a user, counts
 * per user.
 */
@Injectable()
export class PublicApiRateLimit {
  constructor(
    @Inject(PostgresThrottlerStorage) private readonly storage: PostgresThrottlerStorage,
    @Optional() @Inject(ConfigService) private readonly config?: ConfigService<ServerEnv, true>,
  ) {}

  /**
   * Counts one request of the principal and throws 429 core.request.rate_limited, with
   * details.retryAfterSeconds, once the principal is over its limit. With the limit off it counts
   * nothing.
   */
  async check(principal: Principal, kind: RateLimitKind): Promise<void> {
    if (this.config?.get('NORTHMES_API_RATE_LIMIT', { infer: true }) !== 'on') return;
    const limit =
      kind === 'reads'
        ? this.config.get('NORTHMES_API_RATE_LIMIT_READS', { infer: true })
        : this.config.get('NORTHMES_API_RATE_LIMIT_WRITES', { infer: true });
    const key = principal.credentialId ?? `user:${principal.userId}`;
    const record = await this.storage.increment(key, WINDOW_MS, limit, WINDOW_MS, kind);
    if (!record.isBlocked) return;
    const retryAfterSeconds = Math.max(1, record.timeToBlockExpire);
    throw new DomainError({
      status: HttpStatus.TOO_MANY_REQUESTS,
      code: 'core.request.rate_limited',
      message: `Too many requests. Try again in ${retryAfterSeconds} seconds.`,
      details: { retryAfterSeconds },
    });
  }
}
