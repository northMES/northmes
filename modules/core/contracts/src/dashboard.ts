// SPDX-License-Identifier: MIT
import { defineCommandContract } from '@northmes/contracts';
import { z } from 'zod';

/**
 * The dashboard's widget types of release 1, four demo types whose copies differ only in their
 * settings (design shell-454, maintainer 2026-10-10).
 */
export const dashboardWidgetTypes = ['list', 'table', 'value', 'chart'] as const;

export type DashboardWidgetType = (typeof dashboardWidgetTypes)[number];

/** The widget sizes, each a fixed width and height in grid units (design shell-454). */
export const dashboardWidgetSizes = ['small', 'medium', 'large', 'tall', 'wide'] as const;

export type DashboardWidgetSize = (typeof dashboardWidgetSizes)[number];

/** The sizes each widget type allows, its default first (design shell-454). */
export const dashboardSizesOf: Readonly<
  Record<DashboardWidgetType, readonly [DashboardWidgetSize, ...DashboardWidgetSize[]]>
> = {
  value: ['small'],
  list: ['medium', 'large', 'tall'],
  table: ['large', 'tall', 'wide'],
  chart: ['large', 'medium', 'wide'],
};

/** The columns of the stored layout, the 12-column grid that the narrower ones derive from. */
export const dashboardColumns = 12;

/** Each size's width and height in grid units at 12 columns (design shell-454). */
export const dashboardSizeUnits: Readonly<Record<DashboardWidgetSize, { w: number; h: number }>> = {
  small: { w: 3, h: 2 },
  medium: { w: 4, h: 4 },
  large: { w: 6, h: 4 },
  tall: { w: 6, h: 6 },
  wide: { w: 12, h: 4 },
};

/**
 * One widget of a tab's layout: its type, its size, its place in grid units at 12 columns and its
 * settings. The width and height follow from the size, so a stored layout cannot hold a size its
 * type does not allow, and a widget that does not fit the 12 columns is refused.
 */
export const dashboardWidget = z
  .object({
    id: z.string().min(1).max(64),
    type: z.enum(dashboardWidgetTypes),
    size: z.enum(dashboardWidgetSizes),
    x: z
      .int()
      .min(0)
      .max(dashboardColumns - 1),
    y: z.int().min(0).max(10_000),
    settings: z.object({ title: z.string().trim().min(1).max(80) }),
  })
  .refine(({ type, size }) => dashboardSizesOf[type].includes(size), {
    message: 'The widget type does not allow this size',
    path: ['size'],
  })
  .refine(({ size, x }) => x + dashboardSizeUnits[size].w <= dashboardColumns, {
    message: 'The widget does not fit the 12 columns',
    path: ['x'],
  });

export type DashboardWidget = z.output<typeof dashboardWidget>;

/** The most widgets one tab holds. */
export const dashboardMaxWidgets = 40;

/** True when two widgets of a 12-column layout cover a common cell. */
export function dashboardWidgetsOverlap(
  a: Pick<DashboardWidget, 'size' | 'x' | 'y'>,
  b: Pick<DashboardWidget, 'size' | 'x' | 'y'>,
): boolean {
  const sizeA = dashboardSizeUnits[a.size];
  const sizeB = dashboardSizeUnits[b.size];
  return a.x < b.x + sizeB.w && b.x < a.x + sizeA.w && a.y < b.y + sizeB.h && b.y < a.y + sizeA.h;
}

/**
 * A tab's layout at 12 columns (design shell-454): at most 40 widgets, each id once, and no two
 * widgets over one cell. A refusal names the later widget of a pair.
 */
export const dashboardLayout = z
  .array(dashboardWidget)
  .max(dashboardMaxWidgets)
  .superRefine((widgets, context) => {
    widgets.forEach((widget, index) => {
      const before = widgets.slice(0, index);
      if (before.some(({ id }) => id === widget.id)) {
        context.addIssue({
          code: 'custom',
          message: 'Another widget of the tab has this id',
          path: [index, 'id'],
        });
      } else if (before.some((other) => dashboardWidgetsOverlap(other, widget))) {
        context.addIssue({
          code: 'custom',
          message: 'The widget overlaps another widget',
          path: [index],
        });
      }
    });
  });

/** The most characters of a layout's JSON, 40 widgets with long titles and room to spare. */
const layoutJsonMax = 32_000;

/**
 * Saves the layout of one dashboard tab, one edit session from Edit layout to Done (design
 * shell-454, option A): its widgets as JSON, since a generated mutation input carries no list of
 * objects yet (ADR 0017, E05-S01), with the version the session started from. Changing a shared
 * tab needs core.dashboardTab:manage at the tab's scope; a user's own tab needs none, which the
 * bus lets through because the row is the user's own (ADR 0078).
 */
export const saveDashboardTab = defineCommandContract({
  name: 'core.saveDashboardTab',
  target: 'existing',
  fields: z.object({
    layout: z
      .string()
      .max(layoutJsonMax)
      .transform((text, context) => {
        try {
          return JSON.parse(text) as unknown;
        } catch {
          context.addIssue({ code: 'custom', message: 'The layout is not JSON' });
          return z.NEVER;
        }
      })
      .pipe(dashboardLayout),
  }),
  permission: 'core.dashboardTab:manage',
});
