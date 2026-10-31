// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { ZoomLevel } from '../../gantt-data.ts';
import { spanLabel } from '../../timeline/time-scale.ts';
import { useVisibleSpan, type VisibleStore } from '../../timeline/use-time-buffer.ts';

/**
 * The range text of the board and the Gantt: the span in view, which follows the scroll (ADR 0089,
 * The endless axis). It reads the span live, so a scroll redraws this text alone.
 */
export function VisibleSpanText({
  visible,
  zoom,
  timeZone,
}: {
  readonly visible: VisibleStore;
  readonly zoom: ZoomLevel;
  readonly timeZone: string;
}) {
  const span = useVisibleSpan(visible);
  return span === undefined ? null : spanLabel(span, zoom, timeZone);
}
