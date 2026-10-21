// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatPlantDay } from '@northmes/contracts/format';
import { useId } from 'react';
import type { InventorySnapshot } from '../../inventory-data.ts';
import type { Projection } from '../../material-projection.ts';
import { plantDateOf } from '../../stock-facts.ts';

const width = 720;
const height = 200;
const pad = { top: 12, right: 12, bottom: 28, left: 12 };

/**
 * The projected balance as a step chart (design #729, SA1): the balance as a line that steps at
 * each counted movement, a dot per counted movement and a dashed ring for one not counted, the
 * span below zero shaded, the zero line and the now line, and a tick per plant date. The drawing
 * is decoration: the caption says the same in words and names the figure.
 */
export function StockArticleChart({
  snapshot,
  projection,
  caption,
}: {
  readonly snapshot: InventorySnapshot;
  readonly projection: Projection;
  readonly caption: string;
}) {
  const captionId = useId();
  const fromMs = snapshot.stockAsOfMs;
  const toMs = snapshot.projectedToMs;
  const counted = projection.steps.filter((step) => step.balance !== undefined);
  const balances = [projection.start, ...counted.map((step) => step.balance ?? 0)];
  const low = Math.min(0, ...balances);
  const high = Math.max(1, ...balances);
  const x = (ms: number) =>
    pad.left +
    ((Math.min(Math.max(ms, fromMs), toMs) - fromMs) / (toMs - fromMs)) *
      (width - pad.left - pad.right);
  const y = (value: number) =>
    pad.top + ((high - value) / (high - low)) * (height - pad.top - pad.bottom);

  // The line and the spans below zero, step by step.
  let balance = projection.start;
  let atMs = fromMs;
  let path = `M ${x(fromMs)} ${y(balance)}`;
  const below: { readonly from: number; readonly to: number; readonly value: number }[] = [];
  for (const step of counted) {
    const next = step.balance ?? balance;
    if (balance < 0) below.push({ from: atMs, to: step.movement.atMs, value: balance });
    path += ` H ${x(step.movement.atMs)} V ${y(next)}`;
    balance = next;
    atMs = step.movement.atMs;
  }
  if (balance < 0) below.push({ from: atMs, to: toMs, value: balance });
  path += ` H ${x(toMs)}`;

  // A tick per plant date, a day apart from when the stock was taken.
  const ticks: { readonly ms: number; readonly label: string }[] = [];
  const timeZone = snapshot.plant.timeZone;
  for (let ms = fromMs; ms < toMs; ms += 86_400_000) {
    const date = plantDateOf(ms, timeZone);
    if (ticks.at(-1)?.label === formatPlantDay(date)) continue;
    ticks.push({ ms, label: formatPlantDay(date) });
  }
  let running = projection.start;
  return (
    <figure aria-labelledby={captionId} className="m-0 flex flex-col gap-2">
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full text-foreground"
      >
        {below.map((span) => (
          <rect
            key={`${span.from}-${span.to}`}
            x={x(span.from)}
            y={y(0)}
            width={Math.max(1, x(span.to) - x(span.from))}
            height={y(span.value) - y(0)}
            className="fill-destructive-subtle"
          />
        ))}
        <line
          x1={pad.left}
          x2={width - pad.right}
          y1={y(0)}
          y2={y(0)}
          className="stroke-border"
          strokeDasharray="4 4"
        />
        <line
          x1={x(snapshot.nowMs)}
          x2={x(snapshot.nowMs)}
          y1={pad.top}
          y2={height - pad.bottom}
          className="stroke-info"
        />
        <path d={path} fill="none" stroke="currentColor" strokeWidth={2} />
        {projection.steps.map((step) => {
          if (step.balance !== undefined) running = step.balance;
          return step.balance === undefined ? (
            <circle
              key={step.movement.id}
              cx={x(step.movement.atMs)}
              cy={y(running)}
              r={5}
              fill="none"
              stroke="currentColor"
              strokeDasharray="2 2"
            />
          ) : (
            <circle
              key={step.movement.id}
              cx={x(step.movement.atMs)}
              cy={y(step.balance)}
              r={3.5}
              fill="currentColor"
            />
          );
        })}
        {ticks.map((tick) => (
          <text
            key={tick.ms}
            x={x(tick.ms)}
            y={height - 8}
            className="fill-muted-foreground text-[10px]"
          >
            {tick.label}
          </text>
        ))}
      </svg>
      <figcaption id={captionId} className="text-sm text-muted-foreground">
        {caption}
      </figcaption>
    </figure>
  );
}
