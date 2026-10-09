// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The lucide-react icon names a nav entry can carry (ADR 0067), the release 1 icons of core and
 * planning and of Administration's Users and Roles that the D2 build notes list. ADR 0067 puts this list in @northmes/contracts once the
 * nav contract carries icons; until then the web keeps it, and NavIcon maps each name to its icon.
 */
export const navIconNames = [
  'Database',
  'Layers',
  'Drill',
  'Hammer',
  'Package',
  'Route',
  'CalendarDays',
  'Warehouse',
  'Handshake',
  'ChartGantt',
  'Table',
  'ClipboardList',
  'ListChecks',
  'CalendarCog',
  'Users',
  'Shield',
] as const;

/** One of navIconNames, such as "Package". */
export type NavIconName = (typeof navIconNames)[number];
