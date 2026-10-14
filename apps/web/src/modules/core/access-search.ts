// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from 'zod';

/** A user's page in the URL: its open tab, General unless tab says Access (design core-304). */
export interface UserPageSearch {
  readonly tab?: 'access';
}

/** A role's page in the URL: its open tab, Permissions unless tab says Holders. */
export interface RolePageSearch {
  readonly tab?: 'holders';
}

/** New role in the URL: the role it starts from (Start from), by id. */
export interface NewRoleSearch {
  readonly from?: string;
}

/** The URL search of a user's page, for its route's validateSearch; another tab falls back. */
export function userPageSearch(raw: Record<string, unknown>): UserPageSearch {
  return raw.tab === 'access' ? { tab: 'access' } : {};
}

/** The URL search of a role's page, for its route's validateSearch; another tab falls back. */
export function rolePageSearch(raw: Record<string, unknown>): RolePageSearch {
  return raw.tab === 'holders' ? { tab: 'holders' } : {};
}

/** The URL search of New role, for its route's validateSearch; a value that is no id falls back. */
export function newRoleSearch(raw: Record<string, unknown>): NewRoleSearch {
  const from = z.uuid().safeParse(raw.from);
  return from.success ? { from: from.data } : {};
}

/** The dashboard in the URL: its open tab by id, the first tab without one (design shell-454). */
export interface DashboardSearch {
  readonly tab?: string;
}

/** The URL search of the dashboard, for its route's validateSearch; a value that is no id falls back. */
export function dashboardSearch(raw: Record<string, unknown>): DashboardSearch {
  return typeof raw.tab === 'string' && raw.tab.length > 0 && raw.tab.length <= 64
    ? { tab: raw.tab }
    : {};
}
