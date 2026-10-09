// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject, Injectable } from '@nestjs/common';
import { DATABASE, type ScopedDatabase } from '@northmes/sdk/data';
import { currentPrincipal, type Principal } from '../../../principal.ts';
import type { CoreDatabase } from '../infrastructure/database.ts';
import { canOpen } from './access/access.ts';

/** A plant as core's service hands it out. */
export interface PlantRecord {
  /** The plant's scope id. */
  readonly id: string;
  /** The plant's segment of the web's URLs, which x-northmes-plant also names. */
  readonly slug: string;
  readonly name: string;
}

/** A company with the plants of it that a principal may open. */
export interface CompanyRecord {
  /** The company's scope id. */
  readonly id: string;
  readonly name: string;
  /** The plants the principal may open, sorted by name. */
  readonly plants: readonly PlantRecord[];
}

/** Reads companies and plants (ADR 0007). */
@Injectable()
export class CompanyService {
  constructor(@Inject(DATABASE) private readonly db: ScopedDatabase<CoreDatabase>) {}

  /**
   * The companies where the principal holds a role, sorted by name, each with the plants that the
   * principal may open: those where it, or the company, holds a role (ADR 0066). A company role
   * lists every plant of its company, and a company with no plant yet has an empty list. Without a
   * principal there are none. The list does not depend on the request's plant.
   */
  async companies(principal: Principal | null = currentPrincipal()): Promise<CompanyRecord[]> {
    if (!principal) return [];
    const companyIds = [...principal.scopes.values()]
      .filter(({ parentId }) => parentId === null)
      .map(({ id }) => id);
    if (companyIds.length === 0) return [];
    const rows = await this.db.transaction((tx) =>
      tx
        .selectFrom('core.company as c')
        .leftJoin('core.plant as p', 'p.company_id', 'c.id')
        .select([
          'c.id as companyId',
          'c.name as companyName',
          'p.id as plantId',
          'p.slug',
          'p.name as plantName',
        ])
        .where('c.id', 'in', companyIds)
        .orderBy('c.name')
        .orderBy('c.id')
        .orderBy('p.name')
        .orderBy('p.slug')
        .execute(),
    );
    const companies = new Map<string, { id: string; name: string; plants: PlantRecord[] }>();
    for (const row of rows) {
      const company = companies.get(row.companyId) ?? {
        id: row.companyId,
        name: row.companyName,
        plants: [],
      };
      companies.set(row.companyId, company);
      if (row.plantId !== null && row.slug !== null && row.plantName !== null) {
        if (canOpen(principal, row.plantId)) {
          company.plants.push({ id: row.plantId, slug: row.slug, name: row.plantName });
        }
      }
    }
    return [...companies.values()].filter(
      (company) => company.plants.length > 0 || canOpen(principal, company.id),
    );
  }
}
