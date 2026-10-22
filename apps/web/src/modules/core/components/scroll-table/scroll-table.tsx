// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { ReactNode } from 'react';

/**
 * A table that scrolls sideways in its own region at narrow widths, as DataTable's scrollLabel
 * does (design core-304, NO11): the region is named "<label>, scrolls sideways" and takes focus,
 * so the keyboard scrolls it too (WCAG 2.1.1), whether or not the table holds a link.
 */
export function ScrollTable({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <section
      aria-label={`${label}, scrolls sideways`}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a region that scrolls sideways takes focus, so the keyboard scrolls it (WCAG 2.1.1).
      tabIndex={0}
      className="overflow-x-auto rounded-md focus-visible:outline-2 focus-visible:outline-(--focus-outline) [&>[data-slot=table-container]]:overflow-visible"
    >
      {children}
    </section>
  );
}
