// SPDX-License-Identifier: AGPL-3.0-or-later
import { GridLayout, useContainerWidth } from 'react-grid-layout';
import { columnsFor, gridLayout, readingOrder } from './dashboard-layout.ts';
import type { DashboardTab } from './dashboard-tabs.graphql.ts';
import { DashboardWidget } from './dashboard-widget.tsx';

/** The grid's row height and gaps in px (design shell-454, Breakpoints and sizes). */
const rowHeight = 72;
const gap = 16;

/** The least height of a widget of each size in the one-column list: the grid's own height. */
const listHeights = {
  SMALL: 'min-h-40',
  MEDIUM: 'min-h-84',
  LARGE: 'min-h-84',
  TALL: 'min-h-128',
  WIDE: 'min-h-84',
} as const;

/**
 * The open tab's widgets (design shell-454, option A). The grid is measured on its container: 12
 * columns from 900 px and 6 from 600 px through react-grid-layout, which places each widget in its
 * cell; below 600 px the widgets form an ordered list in reading order, without the library, and
 * each grows with its content (WCAG 1.4.10). Either way the widgets come in reading order in the
 * DOM, row by row, so the tab order follows what the eye reads (WCAG 2.4.3). Viewing moves
 * nothing: edit mode brings the move button and the resize handle.
 */
export function DashboardGrid({ tab }: { readonly tab: DashboardTab }) {
  const { width, containerRef, mounted } = useContainerWidth();
  const columns = columnsFor(width);
  const widgets = readingOrder(tab.widgets);
  const label = `Widgets of ${tab.name}`;
  return (
    <div ref={containerRef}>
      {mounted && columns !== 1 ? (
        // react-grid-layout puts its own element between the list and its items; it has no role,
        // so each item still belongs to the list.
        // biome-ignore lint/a11y/useSemanticElements: an ol may hold only li, and the library's div sits between.
        <div role="list" aria-label={label}>
          <GridLayout
            width={width}
            layout={gridLayout(widgets, columns)}
            gridConfig={{
              cols: columns,
              rowHeight,
              margin: [gap, gap],
              containerPadding: [0, 0],
            }}
            dragConfig={{ enabled: false }}
            resizeConfig={{ enabled: false }}
            className="dashboard-grid"
          >
            {widgets.map((widget) => (
              // biome-ignore lint/a11y/useSemanticElements: the library places each item as a div.
              <div key={widget.id} role="listitem">
                <DashboardWidget widget={widget} />
              </div>
            ))}
          </GridLayout>
        </div>
      ) : (
        <ol aria-label={label} className="flex flex-col gap-4">
          {widgets.map((widget) => (
            <li key={widget.id}>
              <DashboardWidget widget={widget} className={listHeights[widget.size]} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
