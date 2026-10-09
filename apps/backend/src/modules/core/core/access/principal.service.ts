// SPDX-License-Identifier: AGPL-3.0-or-later
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { DATABASE, type ScopedDatabase } from '@northmes/sdk/data';
import { DomainError } from '@northmes/sdk/errors';
import { sql } from 'kysely';
import {
  PLANT_HEADER,
  type Principal,
  PrincipalResolver,
  runAs,
  type ScopeGrant,
} from '../../../../principal.ts';
import type { CoreDatabase } from '../../infrastructure/database.ts';
import { accessOf, atPlant, canOpen } from './access.ts';
import { AuthService } from './auth.service.ts';

/** The bearer token of an Authorization header. */
const bearer = /^Bearer\s+(\S+)$/i;

/** A row of the principal's query: one scope node and what is granted directly at it. */
interface GrantRow {
  readonly id: string;
  readonly parent_id: string | null;
  readonly permissions: string[];
  /** The plant's slug, for a plant node. */
  readonly slug: string | null;
}

/**
 * The refusal of a request whose x-northmes-plant names a plant that its principal may not open,
 * or no plant at all: one answer for both, so it never tells whether a plant exists (ADR 0007).
 */
export function plantForbidden(plant: string): DomainError {
  return new DomainError({
    code: 'core.plant_forbidden',
    status: HttpStatus.FORBIDDEN,
    message: `You cannot open plant ${plant}. Choose one of your plants.`,
  });
}

/**
 * The refusal of every request of a user who signed in with a temporary password and has not set
 * a new one (ADR 0051 rule 13, D2 SI16). Only the new password step and sign-out answer them.
 */
export function passwordChangeRequired(): DomainError {
  return new DomainError({
    code: 'core.password_change_required',
    status: HttpStatus.FORBIDDEN,
    message: 'You signed in with a temporary password. Choose a new password to continue.',
  });
}

/**
 * Resolves the principal of a request (ADR 0010, ADR 0011): from the JWT in its Authorization
 * header to the user, and from the user's role assignments to its scope tree, permissions and
 * scope sets, in one query per request.
 */
@Injectable()
export class PrincipalService extends PrincipalResolver {
  constructor(
    @Inject(DATABASE) private readonly db: ScopedDatabase<CoreDatabase>,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {
    super();
  }

  /**
   * The principal of a request with these headers, or null when it carries no bearer token, one
   * that is not a valid JWT of this API, or the JWT of a blocked user. x-northmes-plant names the
   * request's plant by its slug. A user who must set a new password is refused with
   * core.password_change_required.
   */
  async resolve(headers: Headers): Promise<Principal | null> {
    const token = bearer.exec(headers.get('authorization') ?? '')?.[1];
    if (!token) return null;
    const userId = await this.auth.userOfToken(token);
    if (!userId) return null;
    const { rows, blocked, mustChangePassword } = await this.#grants(userId);
    // A blocked user's JWT may outlive the block by its lifetime; the user's next request fails.
    if (blocked) return null;
    if (mustChangePassword) throw passwordChangeRequired();
    return this.#principal(userId, rows, headers.get(PLANT_HEADER) ?? undefined);
  }

  /**
   * The principal of a user at the plant whose slug is `plant`. Its scope tree holds every node of
   * the companies where the user holds a role, each with the installed permissions of the roles
   * assigned at it, and its scope sets are narrowed to the plant and its company (ADR 0008); without
   * a plant they are empty. A plant the user may not open, or no plant with that slug, throws
   * core.plant_forbidden (ADR 0007).
   */
  async forUser(userId: string, plant?: string): Promise<Principal> {
    return this.#principal(userId, (await this.#grants(userId)).rows, plant);
  }

  /**
   * The grant rows of a user, one per scope node of the companies where the user holds a role, and
   * whether the user is blocked or must set a new password, in one transaction. It runs without scopes, since they come from
   * the grants, so it reads core.role through core.principal_grants, which the policy of core.role
   * does not bind.
   */
  async #grants(
    userId: string,
  ): Promise<{ rows: GrantRow[]; blocked: boolean; mustChangePassword: boolean }> {
    return runAs(null, () =>
      this.db.transaction(async (tx) => {
        const user = await tx
          .selectFrom('core.user_directory')
          .select(['banned', 'must_change_password'])
          .where('id', '=', userId)
          .executeTakeFirst();
        const { rows } = await sql<GrantRow>`
          select id, parent_id, slug, permissions from core.principal_grants(${userId})`.execute(
          tx,
        );
        return {
          rows,
          blocked: user?.banned === true,
          mustChangePassword: user?.must_change_password === true,
        };
      }),
    );
  }

  /** The principal of a user with these grant rows at the plant whose slug is `plant`. */
  #principal(userId: string, rows: readonly GrantRow[], plant: string | undefined): Principal {
    const nodes: ScopeGrant[] = rows.map((row) => ({
      id: row.id,
      parentId: row.parent_id,
      permissions: row.permissions,
    }));
    const access = accessOf(nodes);
    if (plant === undefined) return { userId, plantId: undefined, ...atPlant(access, undefined) };
    const plantId = rows.find(({ slug }) => slug === plant)?.id;
    if (plantId === undefined || !canOpen(access, plantId)) throw plantForbidden(plant);
    return { userId, plantId, ...atPlant(access, plantId) };
  }
}
