// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { IntegrationCredentialService } from '../../modules/core/core/access/integration-credential.service.ts';
import { INTEGRATION_KEY_PREFIX } from '../../modules/core/infrastructure/auth/auth-options.ts';
import type { Principal } from '../../principal.ts';

/** What the credential guard of the public API reads of a request. */
export interface PublicApiRequest {
  readonly headers: Headers;
  /**
   * The slug of the plant that the request's plant query parameter names, or undefined for a
   * request that acts at the company of its credential (ADR 0073).
   */
  readonly plant: string | undefined;
}

/**
 * The credential guard of the public REST family (ADR 0073 section 5, credentials by surface): the
 * seam that resolves a public API request's principal from its credential. It accepts the
 * credentials the public family takes, integration tokens and later OAuth access tokens, and never
 * the web's JWT or a cookie. It answers null for a request without such a credential, which the
 * route refuses with 401 core.unauthenticated. For a request without a plant, the principal's
 * companyId is the company the credential belongs to; a plant the credential cannot reach throws
 * core.plant_forbidden.
 *
 * The server provides BearerPublicApiCredentials; tests may provide their own through
 * AppOptions.publicApiCredentials.
 */
export abstract class PublicApiCredentials {
  abstract resolve(request: PublicApiRequest): Promise<Principal | null>;
}

/** The token of an Authorization header in the Bearer scheme. */
const bearer = /^Bearer\s+(\S+)$/i;

/**
 * The server's credential guard of the public API (ADR 0073, credentials by surface). The
 * credential comes only from Authorization: Bearer. A token with the prefix nms_int_ is verified
 * as an integration token by core's IntegrationCredentialService, which checks its hash, expiry and
 * revocation and decides the plant: a token bound to a plant acts there only, and one bound to the
 * company acts at the company or at any of its plants. Any other bearer, such as the web's JWT, a
 * cookie, another scheme and no header resolve to null. The cookie header is never read. An app
 * without core verifies no token, so every request resolves to null.
 */
@Injectable()
export class BearerPublicApiCredentials extends PublicApiCredentials {
  constructor(@Inject(ModuleRef) private readonly moduleRef: ModuleRef) {
    super();
  }

  async resolve({ headers, plant }: PublicApiRequest): Promise<Principal | null> {
    const token = bearer.exec(headers.get('authorization') ?? '')?.[1];
    if (!token?.startsWith(INTEGRATION_KEY_PREFIX)) return null;
    const integrations = this.#integrations();
    if (!integrations) return null;
    return (await integrations.resolve(token, plant))?.principal ?? null;
  }

  /** core's resolver of integration tokens, or undefined in an app without core. */
  #integrations(): IntegrationCredentialService | undefined {
    try {
      return this.moduleRef.get(IntegrationCredentialService, { strict: false });
    } catch {
      return undefined;
    }
  }
}
