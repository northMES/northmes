// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic

/** An order's page in the URL: its open tab, General unless tab says History (design ui-222). */
export interface OrderPageSearch {
  readonly tab?: 'history';
}

/** The URL search of an order's page, for its route's validateSearch; another tab falls back. */
export function orderPageSearch(raw: Record<string, unknown>): OrderPageSearch {
  return raw.tab === 'history' ? { tab: 'history' } : {};
}
