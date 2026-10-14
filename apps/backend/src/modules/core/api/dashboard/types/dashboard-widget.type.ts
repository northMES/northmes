// SPDX-License-Identifier: AGPL-3.0-or-later
import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import type { DashboardWidget as DashboardWidgetRecord } from '@northmes/core-contracts';

/** The widget types of release 1, four demo types (design shell-454). */
export enum DashboardWidgetType {
  LIST = 'list',
  TABLE = 'table',
  VALUE = 'value',
  CHART = 'chart',
}

registerEnumType(DashboardWidgetType, { name: 'DashboardWidgetType' });

/** A widget's size, a fixed width and height in grid units (design shell-454). */
export enum DashboardWidgetSize {
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large',
  TALL = 'tall',
  WIDE = 'wide',
}

registerEnumType(DashboardWidgetSize, { name: 'DashboardWidgetSize' });

/** One widget placed on a dashboard tab, with its place in grid units at 12 columns. */
@ObjectType('DashboardWidget')
export class DashboardWidget {
  /** The widget's id, unique within its tab. */
  @Field(() => ID) id!: string;
  @Field(() => DashboardWidgetType) type!: DashboardWidgetType;
  @Field(() => DashboardWidgetSize) size!: DashboardWidgetSize;
  /** The column of the widget's left edge, from 0. */
  @Field(() => Int) x!: number;
  /** The row of the widget's top edge, from 0. */
  @Field(() => Int) y!: number;
  /** The title its settings give it, which tells two copies of one type apart. */
  @Field(() => String) title!: string;
}

/** A stored widget as the DashboardWidget type answers it. */
export function toDashboardWidget(widget: DashboardWidgetRecord): DashboardWidget {
  return {
    id: widget.id,
    type: widget.type as DashboardWidgetType,
    size: widget.size as DashboardWidgetSize,
    x: widget.x,
    y: widget.y,
    title: widget.settings.title,
  };
}
