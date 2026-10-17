// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { GanttSnapshot } from '../../gantt-data.ts';
import type { TimeScale } from '../../timeline/time-scale.ts';
import { startsBeforeRelease } from './gantt-block-states.ts';
import type { JobOrderRow } from './gantt-rows.ts';

/** Above this many visible links the view draws the selected order's links only (plan 18). */
export const linkLimit = 200;

/** A visible job order row with the vertical centre of its block. */
export interface LinkRow {
  readonly row: JobOrderRow;
  readonly centerY: number;
}

/** One link from a predecessor row's release point to a successor row's start. */
export interface GanttLink {
  readonly id: string;
  readonly orderId: string;
  readonly fromId: string;
  readonly toId: string;
  /** The release point, where the lead time starts. */
  readonly x1: number;
  readonly y1: number;
  /** The release instant, where the lead time ends; equals x1 without lead time. */
  readonly x2: number;
  /** The successor's start. */
  readonly x3: number;
  readonly y2: number;
  /** The lead time is drawn as a dashed segment from x1 to x2. */
  readonly dashed: boolean;
  /** The successor starts before its release: the conflict style with the striped head. */
  readonly broken: boolean;
  readonly selected: boolean;
}

/**
 * The links of the visible rows (plan 18, Blocks, links and the selection): one per successor row
 * whose predecessor row is visible too, from the release point through the release instant to the
 * successor's start. Above the limit, the selected order's links alone; the selected order's links
 * come last, so they draw on top.
 */
export function linksOf(
  rows: readonly LinkRow[],
  snapshot: GanttSnapshot,
  scale: TimeScale,
  selectedOrderId: string | undefined,
): { readonly links: GanttLink[]; readonly limited: boolean } {
  const byId = new Map(rows.map((each) => [each.row.id, each]));
  const links: GanttLink[] = [];
  for (const { row, centerY } of rows) {
    const release = row.analysis?.release;
    const placement = row.jobOrder.placement;
    if (release === undefined || placement === undefined) continue;
    const from = byId.get(release.fromJobOrderId);
    if (from === undefined) continue;
    const startMs = snapshot.settings.retoolOverlapsLeadTime
      ? placement.runStartMs
      : placement.setupStartMs;
    links.push({
      id: `${from.row.id}-${row.id}`,
      orderId: row.order.id,
      fromId: from.row.id,
      toId: row.id,
      x1: scale.x(release.pointMs),
      y1: from.centerY,
      x2: scale.x(release.atMs),
      x3: scale.x(startMs),
      y2: centerY,
      dashed: release.atMs > release.pointMs,
      broken: startsBeforeRelease(row, snapshot.settings.retoolOverlapsLeadTime),
      selected: row.order.id === selectedOrderId,
    });
  }
  const limited = links.length > linkLimit;
  const shown = limited ? links.filter((link) => link.selected) : links;
  shown.sort((a, b) => Number(a.selected) - Number(b.selected));
  return { links: shown, limited };
}

/** The path of a link's solid part: down from the release instant, then across to the start. */
function solidPath(link: GanttLink): string {
  const forward = link.x3 >= link.x2;
  const end = forward ? link.x3 - 6 : link.x3 + 6;
  return `M${link.x2} ${link.y1} L${link.x2} ${link.y2} L${end} ${link.y2}`;
}

/** The arrowhead at the successor's start, pointing the way the link runs. */
function arrow(link: GanttLink): string {
  const forward = link.x3 >= link.x2;
  const tip = link.x3;
  const back = forward ? tip - 7 : tip + 7;
  return `${tip},${link.y2} ${back},${link.y2 - 4} ${back},${link.y2 + 4}`;
}

/**
 * The SVG link overlay over the time area (plan 18, Shared pieces): a 1.5 px line in the
 * foreground token, the lead time dashed, an arrowhead at the successor's start; a broken link in
 * the late-foreground token with the striped head; the selected order's links on top at full
 * opacity. Links are not focusable: the relation lives in the successor row's name.
 */
export function GanttLinks({
  links,
  width,
  height,
}: {
  readonly links: readonly GanttLink[];
  readonly width: number;
  readonly height: number;
}) {
  return (
    <svg
      aria-hidden
      data-links
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="pointer-events-none absolute top-0 left-0 overflow-visible"
    >
      <title>Links between operations</title>
      <defs>
        <pattern
          id="gantt-link-stripes"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="2" height="4" fill="currentColor" />
        </pattern>
      </defs>
      {links.map((link) => (
        <g
          key={link.id}
          data-link={link.id}
          data-broken={link.broken || undefined}
          data-selected={link.selected || undefined}
          style={{ color: link.broken ? 'var(--late-foreground)' : 'var(--foreground)' }}
          opacity={link.selected || link.broken ? 1 : 0.6}
        >
          {link.dashed && (
            <path
              data-lead
              d={`M${link.x1} ${link.y1} L${link.x2} ${link.y1}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={link.selected || link.broken ? 2 : 1.5}
              strokeDasharray="4 3"
            />
          )}
          <path
            d={solidPath(link)}
            fill="none"
            stroke="currentColor"
            strokeWidth={link.selected || link.broken ? 2 : 1.5}
          />
          {link.broken && (
            <rect
              data-striped-head
              x={link.x3 + 2}
              y={link.y2 - 7}
              width="10"
              height="14"
              fill="url(#gantt-link-stripes)"
              stroke="currentColor"
              strokeWidth="1"
            />
          )}
          <polygon points={arrow(link)} fill="currentColor" />
        </g>
      ))}
    </svg>
  );
}
