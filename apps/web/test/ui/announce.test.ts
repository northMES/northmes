// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { announce } from '../../src/ui/announce.ts';

/** The body of the web's index.html, as the browser loads it before the app renders. */
function indexBody(): string {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  return /<body>([\s\S]*)<\/body>/.exec(html)?.[1] ?? '';
}

/** The text of the polite region after each timer, with repeats in a row folded into one. */
async function spoken(): Promise<string[]> {
  const region = () => document.querySelector('[aria-live="polite"]')?.textContent ?? null;
  const states = [region()];
  while (vi.getTimerCount() > 0) {
    await vi.advanceTimersToNextTimerAsync();
    if (states.at(-1) !== region()) states.push(region());
  }
  return states as string[];
}

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = indexBody();
});

afterEach(async () => {
  await vi.runAllTimersAsync();
  vi.useRealTimers();
});

describe('announce', () => {
  it('E04-S07 announce speaks through the one polite live region of index.html, outside the app root', async () => {
    announce('Article AX-20410 saved');
    await spoken();

    const regions = document.querySelectorAll('[aria-live]');
    expect(regions).toHaveLength(1);
    const region = regions[0] as HTMLElement;
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.getAttribute('aria-atomic')).toBe('true');
    expect(region.closest('#root')).toBeNull();
    expect(region.textContent).toBe('Article AX-20410 saved');
  });

  it('E04-S07 a repeated message is cleared and set again, so it is read again', async () => {
    announce('Correlation id copied');
    announce('Correlation id copied');

    expect(await spoken()).toEqual(['', 'Correlation id copied', '', 'Correlation id copied']);
  });

  it('E04-S07 two messages in one tick arrive in order, each on its own', async () => {
    announce('3 articles archived');
    announce('61 articles match');

    expect(await spoken()).toEqual(['', '3 articles archived', '', '61 articles match']);
  });

  it('E04-S07 announce creates the region when the page has none', async () => {
    document.body.innerHTML = '<div id="root"></div>';

    announce('Order 1001 released');
    await spoken();

    expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe('Order 1001 released');
  });
});
