// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject, Injectable } from '@nestjs/common';
import { type DashboardWidget, dashboardWidget } from '@northmes/core-contracts';
import { DATABASE, type ScopedDatabase } from '@northmes/sdk/data';
import { currentPrincipal } from '../../../principal.ts';
import type { CoreDatabase } from '../infrastructure/database.ts';
import { companyOf, forbidden } from './access/request-scope.ts';

/** Who sees a tab: everyone at the company, everyone at the plant, or its owner alone. */
export type DashboardTabScope = 'company' | 'plant' | 'own';

/** A dashboard tab as the service hands it out. */
export interface DashboardTabRecord {
  readonly id: string;
  readonly name: string;
  readonly scope: DashboardTabScope;
  readonly version: number;
  /** The widgets the layout allows, in the order the tab stores them. */
  readonly widgets: readonly DashboardWidget[];
}

/** The order of the kinds of tabs in the tab row: the company's, the plant's, the user's own. */
const scopeOrder: Readonly<Record<DashboardTabScope, number>> = { company: 0, plant: 1, own: 2 };

/**
 * Core's dashboard tabs (ADR 0078). Reads need no permission beyond opening the request's plant,
 * and row-level security answers only the shared tabs of the plant and its company and the
 * principal's own tabs.
 */
@Injectable()
export class DashboardService {
  constructor(@Inject(DATABASE) private readonly db: ScopedDatabase<CoreDatabase>) {}

  /** The tabs at the request's plant: the company's, then the plant's, then the user's own. */
  async tabs(): Promise<DashboardTabRecord[]> {
    const principal = currentPrincipal();
    const plantId = principal?.plantId;
    if (!principal || !plantId) {
      throw forbidden('The dashboard is at a plant, and the request names none');
    }
    const companyId = companyOf(principal, plantId);
    const rows = await this.db.transaction((tx) =>
      tx
        .selectFrom('core.dashboard_tab')
        .select(['id', 'name', 'scope_id', 'owner_id', 'version', 'position', 'widgets'])
        // The policies already hide other plants' tabs and other users' own tabs; this names
        // the rows the page shows, so a widened read scope never adds a tab.
        .where((eb) =>
          eb.or([
            eb.and([eb('scope_id', 'in', [companyId, plantId]), eb('owner_id', 'is', null)]),
            eb.and([eb('scope_id', '=', companyId), eb('owner_id', '=', principal.userId)]),
          ]),
        )
        .orderBy('position')
        .orderBy('id')
        .execute(),
    );
    return rows
      .map((row) => ({
        id: row.id,
        name: row.name,
        scope: (row.owner_id !== null
          ? 'own'
          : row.scope_id === companyId
            ? 'company'
            : 'plant') as DashboardTabScope,
        version: row.version,
        widgets: allowedWidgets(row.widgets),
      }))
      .sort((a, b) => scopeOrder[a.scope] - scopeOrder[b.scope]);
  }
}

/**
 * The widgets of a stored layout that the layout schema allows. A widget it refuses, such as one of
 * a type no longer offered, is left out, so the rest of the tab still shows.
 */
function allowedWidgets(stored: readonly unknown[]): DashboardWidget[] {
  return stored.flatMap((widget) => {
    const parsed = dashboardWidget.safeParse(widget);
    return parsed.success ? [parsed.data] : [];
  });
}
