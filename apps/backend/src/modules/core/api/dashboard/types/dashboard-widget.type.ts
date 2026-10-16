// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import type { DashboardWidget as DashboardWidgetRecord } from '@northmes/core-contracts';

/**
 * The widget types of release 1: four demo types (design shell-454), and a widget that a module or
 * plugin contributes to core/dashboard/widgets/v1 (ADR 0068, M-32).
 */
export enum DashboardWidgetType {
  LIST = 'list',
  TABLE = 'table',
  VALUE = 'value',
  CHART = 'chart',
  CONTRIBUTION = 'contribution',
}

registerEnumType(DashboardWidgetType, {
  name: 'DashboardWidgetType',
  description: 'What a dashboard widget shows.',
  valuesMap: {
    LIST: { description: 'A list, one of the four demo types.' },
    TABLE: { description: 'A table, one of the four demo types.' },
    VALUE: { description: 'One value, one of the four demo types.' },
    CHART: { description: 'A chart, one of the four demo types.' },
    CONTRIBUTION: {
      description: 'A widget that a module or plugin contributes, named by contribution.',
    },
  },
});

/** A widget's size, a fixed width and height in grid units (design shell-454). */
export enum DashboardWidgetSize {
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large',
  TALL = 'tall',
  WIDE = 'wide',
}

registerEnumType(DashboardWidgetSize, {
  name: 'DashboardWidgetSize',
  description: "A widget's size, a fixed width and height in grid units.",
  valuesMap: {
    SMALL: { description: '3 columns wide and 2 rows high.' },
    MEDIUM: { description: '4 columns wide and 4 rows high.' },
    LARGE: { description: '6 columns wide and 4 rows high.' },
    TALL: { description: '6 columns wide and 6 rows high.' },
    WIDE: { description: '12 columns wide and 4 rows high.' },
  },
});

/** One widget placed on a dashboard tab, with its place in grid units at 12 columns. */
@ObjectType('DashboardWidget', {
  description: 'One widget placed on a dashboard tab, with its place in grid units at 12 columns.',
})
export class DashboardWidget {
  @Field(() => ID, { description: "The widget's id, unique within its tab." }) id!: string;
  @Field(() => DashboardWidgetType, { description: 'What the widget shows.' })
  type!: DashboardWidgetType;
  @Field(() => String, {
    nullable: true,
    description:
      'The id of the contribution a CONTRIBUTION widget shows, such as example-article-count.count; null for the other types.',
  })
  contribution!: string | null;
  @Field(() => DashboardWidgetSize, { description: "The widget's size." })
  size!: DashboardWidgetSize;
  @Field(() => Int, { description: "The column of the widget's left edge, from 0." }) x!: number;
  @Field(() => Int, { description: "The row of the widget's top edge, from 0." }) y!: number;
  @Field(() => String, {
    description: 'The title its settings give it, which tells two copies of one type apart.',
  })
  title!: string;
}

/** A stored widget as the DashboardWidget type answers it. */
export function toDashboardWidget(widget: DashboardWidgetRecord): DashboardWidget {
  return {
    id: widget.id,
    type: widget.type as DashboardWidgetType,
    contribution: widget.contribution ?? null,
    size: widget.size as DashboardWidgetSize,
    x: widget.x,
    y: widget.y,
    title: widget.settings.title,
  };
}
