// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Inject, Injectable } from '@nestjs/common';
import { type DashboardWidget, dashboardWidget, saveDashboardTab } from '@northmes/core-contracts';
import { COMMAND_BUS, type CommandBus, parseCommandInput } from '@northmes/sdk/commands';
import { DATABASE, type ScopedDatabase } from '@northmes/sdk/data';
import { currentPrincipal, type Principal } from '../../../principal.ts';
import type { CoreDatabase } from '../infrastructure/database.ts';
import { can } from './access/access.ts';
import { companyOf, forbidden } from './access/request-scope.ts';
import {
  type DashboardTabRow,
  SaveDashboardTabCommand,
} from './commands/save-dashboard-tab.handler.ts';

/** Who sees a tab: everyone at the company, everyone at the plant, or its owner alone. */
export type DashboardTabScope = 'company' | 'plant' | 'own';

/** A dashboard tab as the service hands it out. */
export interface DashboardTabRecord {
  readonly id: string;
  readonly name: string;
  readonly scope: DashboardTabScope;
  readonly version: number;
  /**
   * True when the principal may change the tab's layout: an own tab, or a shared tab where the
   * principal holds core.dashboardTab:manage (design shell-454, A1 and A4).
   */
  readonly canEdit: boolean;
  /** The widgets the layout allows, in the order the tab stores them. */
  readonly widgets: readonly DashboardWidget[];
}

/** The order of the kinds of tabs in the tab row: the company's, the plant's, the user's own. */
const scopeOrder: Readonly<Record<DashboardTabScope, number>> = { company: 0, plant: 1, own: 2 };

/** The permission that changes a shared tab (ADR 0078). */
const managePermission = 'core.dashboardTab:manage';

/** Who sees a tab row, at a request whose plant belongs to companyId. */
function kindOf(row: Pick<DashboardTabRow, 'owner_id' | 'scope_id'>, companyId: string) {
  if (row.owner_id !== null) return 'own';
  return row.scope_id === companyId ? 'company' : 'plant';
}

/** A tab row as the service hands it out. */
function toRecord(
  row: Pick<DashboardTabRow, 'id' | 'name' | 'owner_id' | 'scope_id' | 'version' | 'widgets'>,
  principal: Principal,
  companyId: string,
): DashboardTabRecord {
  const scope = kindOf(row, companyId);
  return {
    id: row.id,
    name: row.name,
    scope,
    version: row.version,
    canEdit: scope === 'own' || can(principal, managePermission, row.scope_id),
    widgets: allowedWidgets(row.widgets),
  };
}

/** The principal of a request at a plant, its plant and the plant's company. */
function atPlant(): { principal: Principal; plantId: string; companyId: string } {
  const principal = currentPrincipal();
  const plantId = principal?.plantId;
  if (!principal || !plantId) {
    throw forbidden('The dashboard is at a plant, and the request names none');
  }
  return { principal, plantId, companyId: companyOf(principal, plantId) };
}

/**
 * Core's dashboard tabs (ADR 0078). Reads need no permission beyond opening the request's plant,
 * and row-level security answers only the shared tabs of the plant and its company and the
 * principal's own tabs. A save goes through the command bus as core.saveDashboardTab.
 */
@Injectable()
export class DashboardService {
  constructor(
    @Inject(DATABASE) private readonly db: ScopedDatabase<CoreDatabase>,
    @Inject(COMMAND_BUS) private readonly bus: CommandBus,
  ) {}

  /** The tabs at the request's plant: the company's, then the plant's, then the user's own. */
  async tabs(): Promise<DashboardTabRecord[]> {
    const { principal, plantId, companyId } = atPlant();
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
      .map((row) => toRecord(row, principal, companyId))
      .sort((a, b) => scopeOrder[a.scope] - scopeOrder[b.scope]);
  }

  /** Saves one edit session of a tab: core.saveDashboardTab with this input. */
  async save(input: unknown): Promise<DashboardTabRecord> {
    const { principal, companyId } = atPlant();
    const row = await this.bus.run(
      SaveDashboardTabCommand.command,
      parseCommandInput(saveDashboardTab, input),
    );
    return toRecord(row, principal, companyId);
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
