// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  CalendarCog,
  CalendarDays,
  ChartGantt,
  ClipboardList,
  Database,
  Drill,
  Hammer,
  Handshake,
  Layers,
  ListChecks,
  type LucideIcon,
  Package,
  Route,
  Shapes,
  Shield,
  Table,
  Users,
  Warehouse,
} from 'lucide-react';
import type { NavIconName } from '../../lib/nav-icon-names.ts';

const icons: Readonly<Record<NavIconName, LucideIcon>> = {
  Database,
  Layers,
  Drill,
  Hammer,
  Package,
  Route,
  CalendarDays,
  Warehouse,
  Handshake,
  ChartGantt,
  Table,
  ClipboardList,
  ListChecks,
  CalendarCog,
  Users,
  Shield,
};

/**
 * The icon of a nav entry by its lucide name (ADR 0067), decorative, since the entry's label names
 * it. A name the list does not hold, such as one from a plugin built against a newer list, draws
 * Shapes, so the module still loads.
 */
export function NavIcon({ name }: { readonly name: NavIconName }) {
  const Icon = Object.hasOwn(icons, name) ? icons[name] : Shapes;
  return <Icon aria-hidden />;
}
