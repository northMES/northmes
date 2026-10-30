// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { expect, plant, test } from '../fixtures.ts';

// The time header of the order Gantt (#892, ADR 0089 Header tiers): at every zoom level, with
// Hide closed time on and off, no two labels of a tier overlap and none starts inside a gap. The
// gaps come before the labels, so no gap is drawn over one. The boxes are the browser's own, so
// the check covers the real fonts the unit test of the time scale can only estimate, and the
// labels must render at the sizes that estimate assumes. A label may run on over a short gap
// inside its own cell, behind it; the now label is not a tier label and is left out.

/** The Gantt page of the seed plant with its search. */
function ganttHref(search: Record<string, string>): string {
  return `${planningLinks.gantt({ plant }).href}?${new URLSearchParams(search).toString()}`;
}

const levels = [
  { zoom: 'hours', from: '2026-11-04' },
  { zoom: 'day', from: '2026-11-04' },
  { zoom: 'week', from: '2026-11-02' },
  { zoom: '4weeks', from: '2026-11-02' },
] as const;

test.use({ viewport: { width: 1440, height: 900 } });

test.describe('the time header of the order Gantt', () => {
  for (const { zoom, from } of levels) {
    for (const hideClosed of [true, false]) {
      test(`#892 at ${zoom} with Hide closed time ${hideClosed ? 'on' : 'off'}, the labels of a tier draw at their size over the gaps, neither overlap nor start in a gap, and pass axe`, async ({
        page,
        signIn,
        checkA11y,
      }) => {
        await signIn(ganttHref({ zoom, from }));
        const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
        await expect(gantt).toBeVisible();
        const toggle = page.getByRole('button', { name: 'Hide closed time' });
        // Hide closed time is on by default.
        if (!hideClosed) await toggle.click();
        await expect(toggle).toHaveAttribute('aria-pressed', String(hideClosed));
        const header = gantt.getByRole('columnheader', { name: 'Time' });
        await expect(header.locator('[data-tier="top"]').first()).toBeVisible();

        const layout = await header.evaluate((element) => {
          const box = (each: Element) => {
            const rect = each.getBoundingClientRect();
            return { left: rect.left, right: rect.right };
          };
          const gaps = [...element.querySelectorAll('[data-header-gap]')];
          const labels = [...element.querySelectorAll('[data-tier]')].filter(
            (each) => (each.textContent ?? '') !== '',
          );
          return {
            gaps: gaps.map(box),
            labels: labels.map((each) => ({
              ...box(each),
              tier: each.getAttribute('data-tier') ?? '',
              text: each.textContent ?? '',
              fontSize: getComputedStyle(each).fontSize,
            })),
            gapsBehindLabels: gaps.every((gap) =>
              labels.every(
                (label) =>
                  (gap.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
              ),
            ),
          };
        });

        expect(layout.labels.length).toBeGreaterThan(1);
        expect(layout.gaps.length > 0).toBe(hideClosed);
        expect(layout.gapsBehindLabels).toBe(true);
        // The time scale fits each label at these sizes: 12 px on top, the 11 px tick size below.
        for (const label of layout.labels) {
          expect(label.fontSize, `${label.text} size`).toBe(label.tier === 'top' ? '12px' : '11px');
        }
        for (const tier of ['top', 'bottom']) {
          const labels = layout.labels
            .filter((label) => label.tier === tier)
            .sort((a, b) => a.left - b.left);
          for (const [index, label] of labels.entries()) {
            const next = labels[index + 1];
            if (next !== undefined) {
              expect(label.right, `${label.text} ends before ${next.text}`).toBeLessThanOrEqual(
                next.left + 0.5,
              );
            }
          }
        }
        for (const label of layout.labels) {
          for (const gap of layout.gaps) {
            expect(
              label.left >= gap.left - 0.5 && label.left < gap.right - 0.5,
              `${label.text} starts inside a gap`,
            ).toBe(false);
          }
        }

        await checkA11y(
          `the time header at ${zoom}, Hide closed time ${hideClosed ? 'on' : 'off'}`,
        );
      });
    }
  }
});
