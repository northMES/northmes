// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cn } from 'cn';
import { type ReactNode, useId } from 'react';
import { Badge } from '../../../../ui/primitives/badge.tsx';
import { ContributedWidget } from './dashboard-contributed-widget.tsx';
import { demoChartBars, demoListItems, demoTableRows, demoValue } from './dashboard-demo-data.ts';
import type { DashboardWidget as Widget } from './dashboard-tabs.graphql.ts';

/** What a widget's content reads: its id, which seeds the demo data, and its title. */
type Shown = Pick<Widget, 'id' | 'title'>;

/** A Value widget: one number, large. */
function ValueContent({ widget }: { readonly widget: Shown }) {
  return (
    <p data-testid="widget-value" className="font-mono text-3xl font-semibold tabular-nums">
      {demoValue(widget.id)}
    </p>
  );
}

/** A List widget: fictional production orders, each with its article. */
function ListContent({ widget }: { readonly widget: Shown }) {
  return (
    <ul className="flex flex-col divide-y divide-border">
      {demoListItems(widget.id).map(({ order, article }) => (
        <li key={order} className="flex items-baseline gap-2 py-1.5">
          <span className="font-mono">{order}</span>
          <span className="truncate text-muted-foreground">{article}</span>
        </li>
      ))}
    </ul>
  );
}

/** A Table widget: fictional rows under named columns. */
function TableContent({ widget }: { readonly widget: Shown }) {
  return (
    <table aria-label={widget.title} className="w-full text-left">
      <thead className="text-muted-foreground">
        <tr>
          <th scope="col" className="py-1 font-medium">
            Machine
          </th>
          <th scope="col" className="py-1 font-medium">
            Reason
          </th>
          <th scope="col" className="py-1 text-right font-medium">
            Minutes
          </th>
        </tr>
      </thead>
      <tbody>
        {demoTableRows(widget.id).map(({ machine, reason, minutes }, index) => (
          <tr key={index} className="border-t border-border">
            <td className="py-1">{machine}</td>
            <td className="py-1">{reason}</td>
            <td className="py-1 text-right font-mono tabular-nums">{minutes}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * A Chart widget: one bar per day. The bars are one image whose name lists the values, so a screen
 * reader hears the data the bars draw (WCAG 1.1.1). Chart colours and a chart library are open
 * (design shell-454, question 7), so the bars take the primary colour.
 */
function ChartContent({ widget }: { readonly widget: Shown }) {
  const bars = demoChartBars(widget.id);
  const top = Math.max(...bars.map(({ value }) => value));
  const label = `${widget.title}, demo data: ${bars.map(({ label, value }) => `${label} ${value}`).join(', ')}`;
  return (
    <div role="img" aria-label={label} className="flex h-full min-h-24 items-end gap-2">
      {bars.map(({ label, value }) => (
        <div key={label} className="flex h-full flex-1 flex-col justify-end gap-1">
          <div className="rounded-t-sm bg-primary" style={{ height: `${(value / top) * 100}%` }} />
          <span className="text-center text-xs text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  );
}

const contents = {
  VALUE: ValueContent,
  LIST: ListContent,
  TABLE: TableContent,
  CHART: ChartContent,
} as const;

/** The fictional content of one of core's four demo types. */
function DemoContent({
  widget,
  type,
}: {
  readonly widget: Shown;
  readonly type: keyof typeof contents;
}) {
  const Content = contents[type];
  return <Content widget={widget} />;
}

export interface DashboardWidgetProps {
  readonly widget: Pick<Widget, 'id' | 'type' | 'title'> & {
    readonly contribution?: string | null;
  };
  readonly className?: string;
  /** Before the title in edit mode: the move button (design shell-454, A7). */
  readonly leading?: ReactNode;
  /** After the Demo badge in edit mode: the Widget actions menu. */
  readonly trailing?: ReactNode;
}

/**
 * One widget of a tab: a region named by its title. Core's four types carry a Demo badge, since
 * they show fictional data (design shell-454, question 15); a widget that a module or plugin
 * contributes shows its own content (ADR 0068). In the grid it fills its cell and
 * scrolls inside; in the one-column list its height grows with its content (WCAG 1.4.10). In edit
 * mode its border is dashed, with the move button before the title and Widget actions after it.
 */
export function DashboardWidget({ widget, className, leading, trailing }: DashboardWidgetProps) {
  const titleId = useId();
  const contributed = widget.type === 'CONTRIBUTION';
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        'flex h-full flex-col gap-3 overflow-hidden rounded-xl bg-card p-4 text-sm text-card-foreground ring-1 ring-foreground/10',
        className,
      )}
    >
      <div className="flex items-start gap-2">
        {leading}
        <h2 id={titleId} className="mr-auto self-center text-sm leading-snug font-semibold">
          {widget.title}
        </h2>
        {!contributed && (
          <Badge variant="outline" className="self-center">
            Demo
          </Badge>
        )}
        {trailing}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {contributed ? (
          <ContributedWidget contribution={widget.contribution} title={widget.title} />
        ) : (
          <DemoContent widget={widget} type={widget.type} />
        )}
      </div>
    </section>
  );
}
