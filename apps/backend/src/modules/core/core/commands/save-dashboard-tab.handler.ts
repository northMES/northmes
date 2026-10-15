// SPDX-License-Identifier: AGPL-3.0-or-later
import { saveDashboardTab } from '@northmes/core-contracts';
import { registerCommand } from '@northmes/sdk/commands';
import type { Selectable } from 'kysely';
import type { z } from 'zod';
import type { DashboardTabTable } from '../../infrastructure/database.ts';
import type { CoreContext } from './context.ts';

/** The dashboard tab row that core.saveDashboardTab acts on. */
export type DashboardTabRow = Selectable<DashboardTabTable>;

/**
 * The target of core.saveDashboardTab (ADR 0012, ADR 0078). The bus checks
 * core.dashboardTab:manage at a shared tab's scope, its company or its plant. A user's own tab
 * names its owner, so its owner saves it without the permission; row-level security finds no other
 * user's own tab, which answers NOT_FOUND like a tab that does not exist.
 */
export const dashboardTabTarget = {
  entity: 'Dashboard tab',
  scopeOf: async (id: string, { tx }: Pick<CoreContext, 'tx'>) =>
    (
      await tx
        .selectFrom('core.dashboard_tab')
        .select('scope_id')
        .where('id', '=', id)
        .executeTakeFirst()
    )?.scope_id,
  load: (id: string, { tx }: Pick<CoreContext, 'tx'>): Promise<DashboardTabRow | undefined> =>
    tx
      .selectFrom('core.dashboard_tab')
      .selectAll()
      .where('id', '=', id)
      .forUpdate()
      .executeTakeFirst(),
  ownerOf: (row: DashboardTabRow) => row.owner_id,
};

/**
 * The handler of core.saveDashboardTab: replaces the tab's widgets with the layout of one edit
 * session (design shell-454, option A). The trigger bumps the version, so a second session made on
 * the same version gets core.version_conflict.
 */
export const saveDashboardTabHandler = {
  target: dashboardTabTarget,
  async handle(
    { id, layout }: z.output<typeof saveDashboardTab.input>,
    { tx }: CoreContext<DashboardTabRow>,
  ): Promise<DashboardTabRow> {
    return tx
      .updateTable('core.dashboard_tab')
      .set({ widgets: JSON.stringify(layout) })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
  },
};

/** core.saveDashboardTab as the bus runs it, which DashboardService.save sends. */
export const SaveDashboardTabCommand = registerCommand(saveDashboardTab, saveDashboardTabHandler);
