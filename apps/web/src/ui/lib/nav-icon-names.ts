// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic

/**
 * The lucide-react icon names a nav entry can carry (ADR 0067): the release 1 icons of core and
 * planning that the D2 build notes list, and those of the settings entries Users, Roles and People
 * (design shell-313), Tags for the article groups, and LayoutDashboard for the dashboard (design
 * shell-454). ADR 0067 puts this list in @northmes/contracts once the nav contract carries icons;
 * until then the web keeps it, and NavIcon maps each name to its icon.
 */
export const navIconNames = [
  'LayoutDashboard',
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
  'ChartNoAxesGantt',
  'Table',
  'ClipboardList',
  'ListChecks',
  'CalendarCog',
  'Users',
  'Shield',
  'Tags',
] as const;

/** One of navIconNames, such as "Package". */
export type NavIconName = (typeof navIconNames)[number];
