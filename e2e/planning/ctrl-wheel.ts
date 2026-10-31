// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { Page } from '@playwright/test';

/** Where a run of Ctrl+wheel events goes, and the element measured after each. */
export interface CtrlWheelRun {
  /** The selector of the element whose box is measured. */
  readonly measure: string;
  /** The point in the viewport the events are dispatched at. */
  readonly x: number;
  readonly y: number;
  readonly deltaY: number;
  readonly count: number;
}

/**
 * Dispatches Ctrl+wheel events at a point one at a time and returns the measured element's box
 * two animation frames after each. The run stays inside the page, because a round trip per event
 * from the test can take longer on a slow runner than the 150 ms after which a gesture ends and
 * settles at its rounded zoom (ADR 0090), and the next event would then zoom from that width.
 */
export async function ctrlWheelRun(
  page: Page,
  run: CtrlWheelRun,
): Promise<readonly { readonly x: number; readonly width: number }[]> {
  return page.evaluate(async ({ measure, x, y, deltaY, count }) => {
    const frames = () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    const boxes: { x: number; width: number }[] = [];
    for (let event = 0; event < count; event += 1) {
      const target = document.elementFromPoint(x, y);
      if (target === null) throw new Error(`Nothing is drawn at ${x}, ${y}`);
      target.dispatchEvent(
        new WheelEvent('wheel', {
          deltaY,
          ctrlKey: true,
          clientX: x,
          clientY: y,
          bubbles: true,
          cancelable: true,
          composed: true,
        }),
      );
      await frames();
      const element = document.querySelector(measure);
      if (element === null) throw new Error(`${measure} is not drawn`);
      const box = element.getBoundingClientRect();
      boxes.push({ x: box.x, width: box.width });
    }
    return boxes;
  }, run);
}
