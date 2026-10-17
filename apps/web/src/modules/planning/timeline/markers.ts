// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { TimeScale } from './time-scale.ts';

/** The kinds of vertical markers and bands of the marker layer (plan 18, Additions the core needs). */
export type MarkerKind =
  | 'deadline'
  | 'now'
  | 'frozen'
  | 'lateBand'
  | 'earliestStart'
  | 'latestStart'
  | 'latestEnd'
  | 'wait'
  | 'freeFloat';

/** A marker at one instant, or a band over a span, on one row or on every row. */
export interface MarkerDescriptor {
  readonly kind: MarkerKind;
  /** The instant of a point marker. */
  readonly atMs?: number;
  /** The span of a band, [fromMs, toMs). */
  readonly fromMs?: number;
  readonly toMs?: number;
  /** The row the marker belongs to, or `all` for one over every row. */
  readonly rowId: string | 'all';
  /** The visible label, such as the deadline's plant time; a band has none. */
  readonly label?: string;
  /** What the marker stands for, which the row's name carries; the marker itself is decorative. */
  readonly accessibleText: string;
}

/** A marker placed on the axis. */
export interface PlacedMarker {
  readonly kind: MarkerKind;
  readonly rowId: string | 'all';
  readonly x: number;
  /** The width of a band, none for a point marker. */
  readonly widthPx?: number;
  readonly label?: string;
  readonly accessibleText: string;
  /** The descriptors this marker stands for: one, or the ones merged into it. */
  readonly merged: readonly MarkerDescriptor[];
}

/**
 * The markers inside the visible range, placed on the scale (plan 18): a band is clipped to the
 * range, a point marker outside it is dropped, and point markers of one row that fall within 1 px
 * of each other become one marker with their labels joined, so a deadline and a latest end on the
 * same instant read as one.
 */
export function placeMarkers(
  markers: readonly MarkerDescriptor[],
  scale: TimeScale,
): PlacedMarker[] {
  const { fromMs, toMs } = scale.range;
  const placed: PlacedMarker[] = [];
  for (const marker of markers) {
    if (marker.atMs !== undefined) {
      if (marker.atMs < fromMs || marker.atMs >= toMs) continue;
      const x = scale.x(marker.atMs);
      const near = placed.find(
        (other) =>
          other.widthPx === undefined && other.rowId === marker.rowId && Math.abs(other.x - x) <= 1,
      );
      if (near !== undefined) {
        const labels = [near.label, marker.label].filter((label) => label !== undefined);
        const index = placed.indexOf(near);
        placed[index] = {
          ...near,
          ...(labels.length > 0 && { label: labels.join(', ') }),
          accessibleText: `${near.accessibleText}, ${marker.accessibleText}`,
          merged: [...near.merged, marker],
        };
        continue;
      }
      placed.push({
        kind: marker.kind,
        rowId: marker.rowId,
        x,
        ...(marker.label !== undefined && { label: marker.label }),
        accessibleText: marker.accessibleText,
        merged: [marker],
      });
    } else if (marker.fromMs !== undefined && marker.toMs !== undefined) {
      const start = Math.max(marker.fromMs, fromMs);
      const end = Math.min(marker.toMs, toMs);
      if (end <= start) continue;
      const x = scale.x(start);
      placed.push({
        kind: marker.kind,
        rowId: marker.rowId,
        x,
        widthPx: Math.max(0, scale.x(end) - x),
        ...(marker.label !== undefined && { label: marker.label }),
        accessibleText: marker.accessibleText,
        merged: [marker],
      });
    }
  }
  return placed;
}
