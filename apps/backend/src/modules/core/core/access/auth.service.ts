// SPDX-License-Identifier: AGPL-3.0-or-later
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Inject, Injectable } from '@nestjs/common';
import { toNodeHandler } from 'better-auth/node';
import { BetterAuth } from '../../infrastructure/auth/better-auth.ts';

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

/**
 * The user of a JWT and the Better Auth session it was minted from. A JWT that the server signed
 * itself names no session.
 */
export interface TokenSession {
  readonly userId: string;
  readonly sessionId: string | undefined;
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

  /** Answers a request to /api/auth/* with Better Auth's handler. */
  handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
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
   * more JWTs. The caller's session stays; when the caller's JWT names no session, every session
   * ends. A JWT already minted from an ended session works until it expires (JWT_LIFETIME). It answers
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
   * The user id of a JWT that Better Auth signed for this API and that has not expired, or null
   * for any other token: a session token, an expired JWT, a JWT with another signature, issuer or
   * audience, or text that is no JWT.
   */
  async userOfToken(token: string): Promise<string | null> {
    return (await this.sessionOfToken(token))?.userId ?? null;
  }

  /**
   * The user of a JWT that userOfToken accepts and the session that minted it, which
   * /api/auth/token names as sid, or null for a token that userOfToken refuses.
   */
  async sessionOfToken(token: string): Promise<TokenSession | null> {
    const { payload } = await this.betterAuth.auth.api.verifyJWT({ body: { token } });
    if (typeof payload?.sub !== 'string') return null;
    return {
      userId: payload.sub,
      sessionId: typeof payload.sid === 'string' ? payload.sid : undefined,
    };
  }
}
