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
   * (ADR 0011). The user's email is a placeholder under PLACEHOLDER_EMAIL_DOMAIN.
   */
  async createUser({ username, password, name }: NewUser): Promise<{ user: { id: string } }> {
    return this.betterAuth.auth.api.createUser({
      body: {
        email: `${username.toLowerCase()}@${PLACEHOLDER_EMAIL_DOMAIN}`,
        password,
        name: name ?? username,
        data: { username, displayUsername: username },
      },
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
