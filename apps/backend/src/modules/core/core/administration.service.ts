// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomUUIDv7 } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { DATABASE, type ScopedDatabase } from '@northmes/sdk/data';
import { sql, type Transaction } from 'kysely';
import { type Principal, runAs } from '../../../principal.ts';
import type { CoreDatabase } from '../infrastructure/database.ts';
import { companyAdminRoleKey } from '../permissions.ts';
import { type AccountRecord, AuthService, EmailTaken } from './access/auth.service.ts';
import { temporaryPassword } from './commands/user-rules.ts';

/** A refusal of a CLI command that changes nothing: a blocked user, or input that clashes. */
export class AdministrationRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdministrationRefused';
  }
}

/** A company or a user that a CLI command names and that does not exist. */
export class AdministrationNotFound extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdministrationNotFound';
  }
}

/** A company to create with its first Company admin. */
export interface NewCompany {
  /** The company's id, a uuidv7, so a rerun with it replays. Without it, a fresh one. */
  readonly id?: string;
  readonly name: string;
  readonly adminUsername: string;
  /** The admin's email, which must be the existing user's when the username is taken. */
  readonly adminEmail: string;
  /** The name others see for a new admin. Without it, the username. */
  readonly adminName?: string;
}

/** What createCompany did. A new admin comes with the temporary password, shown once. */
export interface CreatedCompany {
  readonly companyId: string;
  readonly name: string;
  readonly adminUserId: string;
  readonly adminUsername: string;
  /** True when a run with the same id and input had created the company already. */
  readonly replayed: boolean;
  readonly temporaryPassword?: string;
}

/** A Company admin to add to a company that exists. */
export interface NewCompanyAdmin {
  readonly companyId: string;
  readonly username: string;
  /** The email of a new user; a username that no user has needs it. */
  readonly email?: string;
  /** The name others see for a new user. Without it, the username. */
  readonly name?: string;
}

/** What addCompanyAdmin did. A new user comes with the temporary password, shown once. */
export interface AddedCompanyAdmin {
  readonly companyId: string;
  readonly userId: string;
  readonly username: string;
  /** True when the user held Company admin at the company and was a member already. */
  readonly alreadyAdmin: boolean;
  readonly temporaryPassword?: string;
}

/** A company as northmes company list prints it. */
export interface CompanySummary {
  readonly id: string;
  readonly name: string;
  /** The number of its plants. */
  readonly plants: number;
  /** The usernames of the users who hold Company admin at the company node, sorted. */
  readonly admins: readonly string[];
}

/** A user whose password resetPassword reset, with the temporary password shown once. */
export interface PasswordReset {
  readonly userId: string;
  readonly username: string;
  readonly temporaryPassword: string;
}

/**
 * The principal of the CLI's transactions: it reads and writes the companies it names and nothing
 * else, so row-level security binds it as it binds a request. It names no user. The system
 * principal core.cli, which the audit trail records, arrives with the audit trail (#50).
 */
function cliPrincipal(companyIds: readonly string[]): Principal {
  return {
    userId: '00000000-0000-0000-0000-000000000000',
    plantId: undefined,
    readScopes: companyIds,
    writeScopes: companyIds,
    scopes: new Map(),
  };
}

const EMAIL_TAKEN = 'Another user has this email address. Give another one.';

/**
 * What the hosting partner does on the host through the CLI (ADR 0011, ADR 0066): create a
 * company with its first Company admin, add a Company admin to a company that has lost every one,
 * list the companies and reset a locked-out user's password. Each runs on the host's nm_app pool
 * under the scopes of the companies it changes, and Better Auth writes on its own nm_auth pool.
 * No GraphQL field or HTTP path reaches it. The reason each command requires is recorded with the
 * command once the audit trail arrives (#50).
 *
 * Better Auth's writes cannot join core's transaction, so each command is safe to run again
 * instead: a rerun after a failure finds the user, the organization and the membership of the
 * first run and finishes core's writes.
 */
@Injectable()
export class AdministrationService {
  constructor(
    @Inject(DATABASE) private readonly db: ScopedDatabase<CoreDatabase>,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  /** Runs fn in a transaction that reads and writes these companies only. */
  #inCompanies<Result>(
    companyIds: readonly string[],
    fn: (tx: Transaction<CoreDatabase>) => Promise<Result>,
  ): Promise<Result> {
    return runAs(cliPrincipal(companyIds), () => this.db.transaction(fn));
  }

  /**
   * Creates a company with its first Company admin (ADR 0066): the admin, unless the username is
   * taken, the Better Auth organization with the admin as its owner and the company's id as its
   * slug, the company node, the core.company row with its default roles, and core's Company admin
   * role for the admin at the company node. A new admin gets a temporary password, which they
   * must replace at the first sign-in; an existing user keeps theirs, and must have the email
   * given. A company with the id that already has this name and admin is a replay that changes
   * nothing; any other input under its id is refused.
   */
  async createCompany(input: NewCompany): Promise<CreatedCompany> {
    const companyId = input.id ?? randomUUIDv7();
    const { name, adminUsername } = input;
    const existing = await this.#inCompanies([companyId], (tx) =>
      tx.selectFrom('core.company').select('name').where('id', '=', companyId).executeTakeFirst(),
    );
    const found = await this.auth.userByUsername(adminUsername);
    if (existing) {
      const admins = await this.#inCompanies([companyId], (tx) => companyAdminIds(tx, companyId));
      if (existing.name !== name || !found || !admins.includes(found.id)) {
        throw new AdministrationRefused(
          `Company ${companyId} exists with other input. Give its name and admin, or another --id.`,
        );
      }
      return { companyId, name, adminUserId: found.id, adminUsername, replayed: true };
    }
    const { admin, password } = await this.#adminAccount(found, {
      username: adminUsername,
      email: input.adminEmail,
      ...(input.adminName ? { name: input.adminName } : {}),
    });
    const organizationId = await this.auth.ensureOrganization({
      name,
      slug: companyId,
      ownerId: admin.id,
    });
    await this.#inCompanies([companyId], async (tx) => {
      // Two runs with one id wait for each other, so only one of them writes the company.
      await sql`select pg_advisory_xact_lock(hashtextextended(${`core.create-company:${companyId}`}, 0))`.execute(
        tx,
      );
      await tx
        .insertInto('core.scope')
        .values({
          id: companyId,
          company_id: companyId,
          parent_id: null,
          kind: 'company',
          span: '(,)',
        })
        .onConflict((conflict) => conflict.doNothing())
        .execute();
      await tx
        .insertInto('core.company')
        .values({ id: companyId, organization_id: organizationId, name })
        .onConflict((conflict) => conflict.doNothing())
        .execute();
      await assignCompanyAdmin(tx, admin.id, companyId);
    });
    return {
      companyId,
      name,
      adminUserId: admin.id,
      adminUsername,
      replayed: false,
      ...(password ? { temporaryPassword: password } : {}),
    };
  }

  /**
   * Gives a user core's Company admin role at a company that exists (ADR 0066, M-58), the way back
   * for a company that has lost every Company admin. A username that no user has creates the user
   * with the email given and a temporary password. The user joins the company's organization as a
   * member before core's write, so a rerun after a failure between them assigns the role. A user
   * who holds the role and is a member already changes nothing, and a blocked user is refused.
   */
  async addCompanyAdmin(input: NewCompanyAdmin): Promise<AddedCompanyAdmin> {
    const { companyId, username } = input;
    const company = await this.#inCompanies([companyId], (tx) =>
      tx
        .selectFrom('core.company')
        .select('organization_id')
        .where('id', '=', companyId)
        .executeTakeFirst(),
    );
    if (!company) throw new AdministrationNotFound(`No company has the id ${companyId}.`);
    const found = await this.auth.userByUsername(username);
    if (!found && !input.email) {
      throw new AdministrationRefused(
        `No user has the username ${username}. Give --email to create the user.`,
      );
    }
    const { admin, password } = await this.#adminAccount(found, {
      username,
      email: input.email ?? found?.email ?? '',
      ...(input.name ? { name: input.name } : {}),
    });
    const member = await this.auth.isMember(admin.id, company.organization_id);
    if (!member) await this.auth.addToOrganization(admin.id, company.organization_id);
    const assigned = await this.#inCompanies([companyId], (tx) =>
      assignCompanyAdmin(tx, admin.id, companyId),
    );
    return {
      companyId,
      userId: admin.id,
      username,
      alreadyAdmin: member && !assigned,
      ...(password ? { temporaryPassword: password } : {}),
    };
  }

  /**
   * Every company of the installation, sorted by name, with its number of plants and the
   * usernames of its Company admins.
   */
  async listCompanies(): Promise<CompanySummary[]> {
    const ids = await this.#inCompanies([], (tx) =>
      tx.selectFrom('core.company').select('id').execute(),
    );
    const companyIds = ids.map(({ id }) => id);
    if (companyIds.length === 0) return [];
    return this.#inCompanies(companyIds, async (tx) => {
      const companies = await tx
        .selectFrom('core.company as c')
        .select([
          'c.id',
          'c.name',
          (eb) =>
            eb
              .selectFrom('core.plant as p')
              .select((count) => count.fn.countAll<string>().as('n'))
              .whereRef('p.company_id', '=', 'c.id')
              .as('plants'),
        ])
        .orderBy('c.name')
        .orderBy('c.id')
        .execute();
      const admins = await tx
        .selectFrom('core.role_assignment as a')
        .innerJoin('core.role as r', 'r.id', 'a.role_id')
        .innerJoin('core.user_directory as u', 'u.id', 'a.user_id')
        .select(['r.company_id', 'u.username'])
        .where('r.key', '=', companyAdminRoleKey)
        .where('r.origin', '=', 'module')
        .whereRef('a.scope_id', '=', 'r.company_id')
        .orderBy('u.username')
        .execute();
      return companies.map(({ id, name, plants }) => ({
        id,
        name,
        plants: Number(plants ?? 0),
        admins: admins.filter(({ company_id }) => company_id === id).map((a) => a.username),
      }));
    });
  }

  /**
   * Gives the user with this username a temporary password, which they must replace at the next
   * sign-in, and ends their sessions (ADR 0011, ADR 0051 rule 13). The old password stops working.
   * A blocked user is refused: unblock them first.
   */
  async resetPassword(username: string): Promise<PasswordReset> {
    const user = await this.auth.userByUsername(username);
    if (!user) throw new AdministrationNotFound(`No user has the username ${username}.`);
    if (user.banned) {
      throw new AdministrationRefused(
        `${username} is blocked. Unblock the user before you reset the password.`,
      );
    }
    const password = temporaryPassword();
    await this.auth.setPassword(user.id, password, { temporary: true });
    return { userId: user.id, username, temporaryPassword: password };
  }

  /**
   * The account of an admin to be: the user found, who must not be blocked and must have the
   * email given, or a new user with a temporary password.
   */
  async #adminAccount(
    found: AccountRecord | undefined,
    { username, email, name }: { username: string; email: string; name?: string },
  ): Promise<{ admin: { id: string }; password?: string }> {
    if (found) {
      if (found.banned) {
        throw new AdministrationRefused(`${username} is blocked. Unblock the user first.`);
      }
      if (found.email.toLowerCase() !== email.toLowerCase()) {
        throw new AdministrationRefused(
          `${username} has another email address. Give the user's own, or another username.`,
        );
      }
      return { admin: found };
    }
    const password = temporaryPassword();
    try {
      const { user } = await this.auth.createUser({
        username,
        email,
        password,
        temporary: true,
        ...(name ? { name } : {}),
      });
      return { admin: user, password };
    } catch (error) {
      if (error instanceof EmailTaken) throw new AdministrationRefused(EMAIL_TAKEN);
      throw error;
    }
  }
}

/** The users who hold core's Company admin role at the company node. */
async function companyAdminIds(
  tx: Transaction<CoreDatabase>,
  companyId: string,
): Promise<string[]> {
  const rows = await tx
    .selectFrom('core.role_assignment as a')
    .innerJoin('core.role as r', 'r.id', 'a.role_id')
    .select('a.user_id')
    .where('r.company_id', '=', companyId)
    .where('r.key', '=', companyAdminRoleKey)
    .where('r.origin', '=', 'module')
    .where('a.scope_id', '=', companyId)
    .execute();
  return rows.map(({ user_id }) => user_id);
}

/**
 * Gives the user core's Company admin role at the company node, once. True when this call wrote
 * the assignment, false when the user held it already. The CLI is not bound by the rule that the
 * assigner holds every permission of the role, which no GraphQL field skips.
 */
async function assignCompanyAdmin(
  tx: Transaction<CoreDatabase>,
  userId: string,
  companyId: string,
): Promise<boolean> {
  const role = await tx
    .selectFrom('core.role')
    .select('id')
    .where('company_id', '=', companyId)
    .where('key', '=', companyAdminRoleKey)
    .where('origin', '=', 'module')
    .executeTakeFirst();
  if (!role) {
    throw new Error(
      `Company ${companyId} has no ${companyAdminRoleKey} role; run northmes migrate first`,
    );
  }
  const written = await tx
    .insertInto('core.role_assignment')
    .values({
      id: randomUUIDv7(),
      user_id: userId,
      company_id: companyId,
      scope_id: companyId,
      role_id: role.id,
    })
    .onConflict((conflict) => conflict.columns(['user_id', 'scope_id', 'role_id']).doNothing())
    .returning('id')
    .executeTakeFirst();
  return written !== undefined;
}
