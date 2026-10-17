// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Inject, Injectable } from '@nestjs/common';
import { DATABASE, type ScopedDatabase } from '@northmes/sdk/data';
import { sql } from 'kysely';
import { type Principal, runAs } from '../../../../principal.ts';
import {
  INTEGRATION_KEY_LENGTH,
  INTEGRATION_KEY_PREFIX,
} from '../../infrastructure/auth/auth-options.ts';
import type { CoreDatabase } from '../../infrastructure/database.ts';
import { AuthService } from './auth.service.ts';
import { accessAt, type GrantRow } from './principal.service.ts';

/** The shape of an integration token's secret: the prefix and the letters Better Auth draws. */
const secretShape = new RegExp(`^${INTEGRATION_KEY_PREFIX}[A-Za-z]{${INTEGRATION_KEY_LENGTH}}$`);

/** The live credential of an integration token, as the resolver answers it (ADR 0073). */
export interface IntegrationCredential {
  /** The id of the core.credential row, which the audit trail records. */
  readonly id: string;
  readonly name: string;
  readonly companyId: string;
  /** The company node or the plant node where the token holds its roles. */
  readonly scopeId: string;
  readonly expiresAt: Date;
}

/** A presented integration token, resolved: its credential and the principal it acts as. */
export interface ResolvedIntegration {
  readonly credential: IntegrationCredential;
  readonly principal: Principal;
}

/** A row of core.use_integration_credential. */
interface CredentialRow {
  readonly id: string;
  readonly scope_id: string;
  readonly binding_scope_id: string;
  readonly name: string;
  readonly expires_at: Date;
}

/**
 * Resolves a presented integration token to its credential and principal (ADR 0073 section 5),
 * the seam that the public API's credential guard calls. A token acts as its own principal, of
 * type integration, never as the person who created it: it holds its roles at its binding, the
 * company or one plant, and nothing anywhere else.
 */
@Injectable()
export class IntegrationCredentialService {
  constructor(
    @Inject(DATABASE) private readonly db: ScopedDatabase<CoreDatabase>,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  /**
   * The credential and principal of an nms_int_ secret, or null for any other text, a secret whose
   * hash Better Auth does not hold, a key that expired or was revoked, or a credential row that is
   * revoked or expired. The principal acts at the company, or at the plant whose slug is `plant`,
   * which must lie at or below the binding, else core.plant_forbidden. Each call writes the
   * credential's last_used_at, at most once a minute. The secret goes to no log, error or row.
   */
  async resolve(secret: string, plant?: string): Promise<ResolvedIntegration | null> {
    if (!secretShape.test(secret)) return null;
    const keyId = await this.auth.verifyIntegrationKey(secret);
    if (!keyId) return null;
    const found = await this.#use(keyId);
    if (!found) return null;
    const { credential, rows } = found;
    const principal: Principal = {
      userId: '',
      type: 'integration',
      credentialId: credential.id,
      surface: 'api',
      companyId: credential.companyId,
      ...accessAt(rows, plant),
    };
    return { credential, principal };
  }

  /**
   * The live credential of the key and its grant rows, in one transaction without scopes, through
   * core's definer functions, since the company is not known before the credential is read.
   */
  async #use(
    keyId: string,
  ): Promise<{ credential: IntegrationCredential; rows: GrantRow[] } | undefined> {
    return runAs(null, () =>
      this.db.transaction(async (tx) => {
        const { rows: found } = await sql<CredentialRow>`
          select id, scope_id, binding_scope_id, name, expires_at
            from core.use_integration_credential(${keyId})`.execute(tx);
        const [row] = found;
        if (!row) return undefined;
        const { rows } = await sql<GrantRow>`
          select id, parent_id, slug, permissions
            from core.credential_grants(${row.id})`.execute(tx);
        const credential: IntegrationCredential = {
          id: row.id,
          name: row.name,
          companyId: row.scope_id,
          scopeId: row.binding_scope_id,
          expiresAt: row.expires_at,
        };
        return { credential, rows };
      }),
    );
  }
}
