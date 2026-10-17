// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Inject, Injectable } from '@nestjs/common';
import { toNodeHandler } from 'better-auth/node';
import {
  CLIENT_ADDRESS_HEADER,
  INTEGRATION_KEY_CONFIG,
  sessionIsLive,
} from '../../infrastructure/auth/auth-options.ts';
import { BetterAuth } from '../../infrastructure/auth/better-auth.ts';
import { Secret } from './secret.ts';

/** A user to create: the email they sign in with, their username and their first password. */
export interface NewUser {
  /**
   * The user's id, a uuid of version 1 to 5, which Better Auth keeps. Without it, Better Auth makes
   * one.
   */
  readonly id?: string;
  readonly username: string;
  readonly password: string;
  /** The name others see. Without it, the username. */
  readonly name?: string;
  /** The email the user signs in with, unique among users. */
  readonly email: string;
  /**
   * True for a password that an admin hands out: the user must set a new one at their next
   * sign-in, and every other request is refused until they have (ADR 0051 rule 13).
   */
  readonly temporary?: boolean;
}

/** How a password is set: temporary for one an admin hands out. */
export interface PasswordOptions {
  /**
   * The user must set a new password at the next sign-in, and every session they hold ends, so
   * the old password and sessions stop working (ADR 0051 rule 13).
   */
  readonly temporary?: boolean;
}

/** The user of a JWT and the live Better Auth session it was minted from. */
export interface TokenSession {
  readonly userId: string;
  readonly sessionId: string;
}

/** Why the new password step refused a password, by NorthMES code. */
export type NewPasswordRefusal =
  | 'core.current_password_wrong'
  | 'core.password_too_short'
  | 'core.password_too_long'
  | 'core.password_unchanged'
  | 'core.password_change_not_required';

/** Better Auth's code for an email that another user has. */
const EMAIL_TAKEN = 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL';

/** Thrown by AuthService.createUser for an email that another user has. */
export class EmailTaken extends Error {
  constructor() {
    super('Another user has this email address');
    this.name = 'EmailTaken';
  }
}

/** Better Auth's code for a creator of an organization's api-key who is not a member of it. */
const NOT_MEMBER = 'USER_NOT_MEMBER_OF_ORGANIZATION';

/** Thrown by AuthService.createIntegrationKey for a creator outside the company's organization. */
export class NotOrganizationMember extends Error {
  constructor() {
    super("The creator is not a member of the company's organization");
    this.name = 'NotOrganizationMember';
  }
}

/** The api-key of an integration token to create (ADR 0073). */
export interface NewIntegrationKey {
  /** The Better Auth organization of the token's company, which the key references. */
  readonly organizationId: string;
  /** The user who creates the token, whom Better Auth checks to be a member of the organization. */
  readonly creatorId: string;
  readonly name: string;
  /** How many days the key lives, 1 to INTEGRATION_KEY_MAX_DAYS. */
  readonly expiresInDays: number;
}

/** An integration key that Better Auth created, with its secret, which only this answer holds. */
export interface CreatedIntegrationKey {
  readonly keyId: string;
  readonly secret: Secret;
  readonly expiresAt: Date;
}

/** A user as Better Auth holds them, for the CLI's commands, which find a user by username. */
export interface AccountRecord {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly banned: boolean;
}

/** Better Auth's handler as a Node request handler. */
type NodeHandler = (request: IncomingMessage, response: ServerResponse) => Promise<void>;

/**
 * Sign-in and the tokens it gives out (ADR 0010): Better Auth's HTTP handler, which core mounts on
 * /api/auth/*, and the check of the JWT a request carries as its bearer token.
 */
@Injectable()
export class AuthService {
  #handler?: NodeHandler;

  constructor(@Inject(BetterAuth) private readonly betterAuth: BetterAuth) {}

  /**
   * Answers a request to /api/auth/* with Better Auth's handler. The client's address goes to Better
   * Auth in CLIENT_ADDRESS_HEADER: Express's req.ip, which follows NORTHMES_TRUSTED_PROXY_HOPS, or
   * the connection's address. A value the client sent in that header is replaced.
   */
  handle(request: IncomingMessage & { ip?: string }, response: ServerResponse): Promise<void> {
    request.headers[CLIENT_ADDRESS_HEADER] = request.ip ?? request.socket.remoteAddress ?? '';
    this.#handler ??= toNodeHandler(this.betterAuth.auth);
    return this.#handler(request, response);
  }

  /**
   * Creates a user with a password through Better Auth's server API, with sign-up disabled on HTTP
   * (ADR 0011). An email that another user has throws EmailTaken.
   */
  async createUser({
    id,
    username,
    password,
    name,
    email,
    temporary = false,
  }: NewUser): Promise<{ user: { id: string } }> {
    try {
      return await this.betterAuth.auth.api.createUser({
        body: {
          email,
          password,
          name: name ?? username,
          // Better Auth writes the user with the id and the mark in its data.
          data: {
            ...(id ? { id } : {}),
            username,
            displayUsername: username,
            mustChangePassword: temporary,
          },
        },
      });
    } catch (error) {
      if ((error as { body?: { code?: string } }).body?.code === EMAIL_TAKEN)
        throw new EmailTaken();
      throw error;
    }
  }

  /**
   * Gives the user this password, on the credential account Better Auth signs them in with, which
   * it creates when the user has none. A temporary one marks the user as needing a new password
   * and ends every session they hold.
   */
  async setPassword(
    userId: string,
    password: string,
    { temporary = false }: PasswordOptions = {},
  ): Promise<void> {
    const { internalAdapter, password: hasher } = await this.betterAuth.auth.$context;
    const hash = await hasher.hash(password);
    const accounts = await internalAdapter.findAccounts(userId);
    if (accounts.some(({ providerId }) => providerId === 'credential')) {
      await internalAdapter.updatePassword(userId, hash);
    } else {
      await internalAdapter.linkAccount({
        providerId: 'credential',
        accountId: userId,
        password: hash,
        userId,
      });
    }
    await internalAdapter.updateUser(userId, {
      mustChangePassword: temporary,
      updatedAt: new Date(),
    });
    if (temporary) await internalAdapter.deleteUserSessions(userId);
  }

  /**
   * The new password step (D2, SI16): a user marked as needing a new password replaces the
   * temporary one, which they give as currentPassword, and the mark is cleared. Every other session
   * of the user ends, so a session that someone else opened with the temporary password mints no
   * more JWTs, and a JWT already minted from one is refused. The caller's session stays. It answers
   * the refusal's code, or undefined once the password is set: a wrong current password, a new one
   * shorter than Better Auth's minimum of 8 characters or longer than its maximum, one equal to the
   * temporary password, or a user who is not marked.
   */
  async setNewPassword(
    { userId, sessionId }: TokenSession,
    currentPassword: string,
    newPassword: string,
  ): Promise<NewPasswordRefusal | undefined> {
    const { internalAdapter, password: hasher } = await this.betterAuth.auth.$context;
    const user = (await internalAdapter.findUserById(userId)) as {
      mustChangePassword?: boolean;
    } | null;
    if (user?.mustChangePassword !== true) return 'core.password_change_not_required';
    const account = (await internalAdapter.findAccounts(userId)).find(
      ({ providerId }) => providerId === 'credential',
    );
    const hash = account?.password;
    if (!hash || !(await hasher.verify({ hash, password: currentPassword }))) {
      return 'core.current_password_wrong';
    }
    if (newPassword.length < hasher.config.minPasswordLength) return 'core.password_too_short';
    if (newPassword.length > hasher.config.maxPasswordLength) return 'core.password_too_long';
    if (newPassword === currentPassword) return 'core.password_unchanged';
    await internalAdapter.updatePassword(userId, await hasher.hash(newPassword));
    await internalAdapter.updateUser(userId, { mustChangePassword: false, updatedAt: new Date() });
    const others = (await internalAdapter.listSessions(userId)).filter(
      ({ id }) => id !== sessionId,
    );
    if (others.length > 0) await internalAdapter.deleteSessions(others.map(({ token }) => token));
    return undefined;
  }

  /**
   * Makes the user a member of the Better Auth organization of a company (ADR 0010), which lists
   * them among the company's users.
   */
  async addToOrganization(userId: string, organizationId: string): Promise<void> {
    await this.betterAuth.auth.api.addMember({
      body: { userId, organizationId, role: 'member' },
    });
  }

  /** The user with this username, stored in lower case, or undefined when there is none. */
  async userByUsername(username: string): Promise<AccountRecord | undefined> {
    const { adapter } = await this.betterAuth.auth.$context;
    const user = await adapter.findOne<{
      id: string;
      email: string;
      name: string;
      banned?: boolean | null;
    }>({ model: 'user', where: [{ field: 'username', value: username }] });
    if (!user) return undefined;
    return { id: user.id, email: user.email, name: user.name, banned: user.banned === true };
  }

  /** The id of the Better Auth organization with this slug, or undefined when there is none. */
  async organizationBySlug(slug: string): Promise<string | undefined> {
    const { adapter } = await this.betterAuth.auth.$context;
    const found = await adapter.findOne<{ id: string }>({
      model: 'organization',
      where: [{ field: 'slug', value: slug }],
    });
    return found?.id;
  }

  /**
   * Creates a Better Auth organization with the user as its owner member and returns its id (ADR
   * 0066). The CLI calls it on the server, where the organization plugin's rule that users create
   * no organization does not apply.
   */
  async createOrganization({
    name,
    slug,
    ownerId,
  }: {
    readonly name: string;
    readonly slug: string;
    readonly ownerId: string;
  }): Promise<string> {
    const created = await this.betterAuth.auth.api.createOrganization({
      body: { name, slug, userId: ownerId },
    });
    if (!created) throw new Error(`Better Auth created no organization with slug ${slug}`);
    return created.id;
  }

  /** Whether the user is a member of the organization, in any Better Auth role. */
  async isMember(userId: string, organizationId: string): Promise<boolean> {
    const { adapter } = await this.betterAuth.auth.$context;
    const member = await adapter.findOne<{ id: string }>({
      model: 'member',
      where: [
        { field: 'userId', value: userId },
        { field: 'organizationId', value: organizationId },
      ],
    });
    return member !== null;
  }

  /**
   * Blocks a user, as Better Auth's admin plugin bans one, on the server: the user cannot sign in,
   * and their sessions end, so no new JWT is minted. A JWT they already hold stops working at their
   * next request, because the principal of a blocked user is not resolved.
   */
  async block(userId: string, reason: string | undefined): Promise<void> {
    const { internalAdapter } = await this.betterAuth.auth.$context;
    await internalAdapter.updateUser(userId, {
      banned: true,
      banReason: reason ?? null,
      banExpires: null,
      updatedAt: new Date(),
    });
    await internalAdapter.deleteUserSessions(userId);
  }

  /** Unblocks a user, who can sign in again. */
  async unblock(userId: string): Promise<void> {
    const { internalAdapter } = await this.betterAuth.auth.$context;
    await internalAdapter.updateUser(userId, {
      banned: false,
      banReason: null,
      banExpires: null,
      updatedAt: new Date(),
    });
  }

  /**
   * Creates the api-key of an integration token through Better Auth's api-key plugin on the server
   * (ADR 0073): a key of the company's organization with the nms_int_ prefix, which the plugin
   * stores as a hash. The answer holds the secret, which nothing else holds afterwards, and when
   * the key expires. Better Auth refuses a creator who is not a member of the organization, which
   * throws NotOrganizationMember.
   */
  async createIntegrationKey({
    organizationId,
    creatorId,
    name,
    expiresInDays,
  }: NewIntegrationKey): Promise<CreatedIntegrationKey> {
    try {
      const created = await this.betterAuth.auth.api.createApiKey({
        body: {
          configId: INTEGRATION_KEY_CONFIG,
          organizationId,
          userId: creatorId,
          name,
          expiresIn: expiresInDays * 24 * 60 * 60,
        },
      });
      if (!created.expiresAt)
        throw new Error('Better Auth created an integration key without expiry');
      return {
        keyId: created.id,
        secret: new Secret(created.key),
        expiresAt: new Date(created.expiresAt),
      };
    } catch (error) {
      if ((error as { body?: { code?: string } }).body?.code === NOT_MEMBER) {
        throw new NotOrganizationMember();
      }
      throw error;
    }
  }

  /**
   * The id of the integration key whose secret this is, when Better Auth's api-key plugin verifies
   * it: its hash matches a key of the integration configuration that is enabled and has not
   * expired. Any other text answers null. The plugin deletes a key it finds expired.
   */
  async verifyIntegrationKey(secret: string): Promise<string | null> {
    const { valid, key } = await this.betterAuth.auth.api.verifyApiKey({
      body: { configId: INTEGRATION_KEY_CONFIG, key: secret },
    });
    return valid && key ? key.id : null;
  }

  /**
   * Deletes an integration key at once, so Better Auth verifies its secret no more (ADR 0073). It
   * deletes through Better Auth's adapter, since the plugin's delete endpoint needs a Better Auth
   * session, which the web's JWT is not. A key that is gone already is no error.
   */
  async deleteIntegrationKey(keyId: string): Promise<void> {
    const { adapter } = await this.betterAuth.auth.$context;
    await adapter.delete({
      model: 'apikey',
      where: [
        { field: 'id', value: keyId },
        { field: 'configId', value: INTEGRATION_KEY_CONFIG },
      ],
    });
  }

  /**
   * The user id of a JWT that Better Auth signed for this API, that has not expired and whose
   * session is live, or null for any other token: a session token, an expired JWT, a JWT with
   * another signature, issuer or audience, a JWT whose session signed out, was revoked, expired or
   * reached its absolute lifetime, or text that is no JWT. Checking the session ends a JWT with it,
   * instead of up to JWT_LIFETIME later.
   */
  async userOfToken(token: string): Promise<string | null> {
    return (await this.sessionOfToken(token))?.userId ?? null;
  }

  /**
   * The user of a JWT that userOfToken accepts and the session that minted it, which
   * /api/auth/token names as sid, or null for a token that userOfToken refuses. A JWT that names no
   * session, or a session of another user, is refused.
   */
  async sessionOfToken(token: string): Promise<TokenSession | null> {
    const { payload } = await this.betterAuth.auth.api.verifyJWT({ body: { token } });
    const userId = payload?.sub;
    const sessionId = payload?.sid;
    if (typeof userId !== 'string' || typeof sessionId !== 'string') return null;
    const { adapter } = await this.betterAuth.auth.$context;
    const session = await adapter.findOne<{ userId: string; createdAt: Date; expiresAt: Date }>({
      model: 'session',
      where: [{ field: 'id', value: sessionId }],
    });
    if (!session || session.userId !== userId) return null;
    const live = sessionIsLive(
      { createdAt: new Date(session.createdAt), expiresAt: new Date(session.expiresAt) },
      new Date(),
    );
    return live ? { userId, sessionId } : null;
  }
}
