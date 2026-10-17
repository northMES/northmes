// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Injectable } from '@nestjs/common';
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
 * The integration token task of wave 4 implements it on core.credential. Until then the server
 * provides RefusingPublicApiCredentials, so no public route answers any request; tests provide
 * their own through AppOptions.publicApiCredentials.
 */
export abstract class PublicApiCredentials {
  abstract resolve(request: PublicApiRequest): Promise<Principal | null>;
}

/**
 * The credential guard while no public credential exists: it accepts none, so every public route
 * answers 401 core.unauthenticated, whatever the request carries.
 */
@Injectable()
export class RefusingPublicApiCredentials extends PublicApiCredentials {
  async resolve(): Promise<Principal | null> {
    return null;
  }
}
