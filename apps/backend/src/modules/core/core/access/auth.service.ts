// SPDX-License-Identifier: AGPL-3.0-or-later
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Inject, Injectable } from '@nestjs/common';
import { toNodeHandler } from 'better-auth/node';
import { BetterAuth } from '../../infrastructure/auth/better-auth.ts';

/**
 * The domain of the placeholder address of a user without one: Better Auth needs a unique email on
 * every user, and no mail reaches a .invalid address (ADR 0010; the maintainer confirms the scheme).
 */
export const PLACEHOLDER_EMAIL_DOMAIN = 'users.northmes.invalid';

/** A user to create: the username they sign in with and their first password. */
export interface NewUser {
  readonly username: string;
  readonly password: string;
  /** The name others see. Without it, the username. */
  readonly name?: string;
  /** The user's email. Without it, a placeholder under PLACEHOLDER_EMAIL_DOMAIN. */
  readonly email?: string;
}

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
   * (ADR 0011). Without an email, the user's email is a placeholder under PLACEHOLDER_EMAIL_DOMAIN.
   * An email that another user has throws EmailTaken.
   */
  async createUser({
    username,
    password,
    name,
    email,
  }: NewUser): Promise<{ user: { id: string } }> {
    try {
      return await this.betterAuth.auth.api.createUser({
        body: {
          email: email ?? `${username.toLowerCase()}@${PLACEHOLDER_EMAIL_DOMAIN}`,
          password,
          name: name ?? username,
          data: { username, displayUsername: username },
        },
      });
    } catch (error) {
      if ((error as { body?: { code?: string } }).body?.code === EMAIL_TAKEN)
        throw new EmailTaken();
      throw error;
    }
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
    const { payload } = await this.betterAuth.auth.api.verifyJWT({ body: { token } });
    return typeof payload?.sub === 'string' ? payload.sub : null;
  }
}
