// SPDX-License-Identifier: MIT
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
