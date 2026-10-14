// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import indexHtml from '../../../index.html?raw';
import { announce, resetAnnouncements } from '../../../src/ui/lib/announce.ts';

/**
 * The body of the web's index.html before the app renders, without the app's script. It goes
 * through an inert template, since happy-dom would fetch the stylesheet a parsed document links.
 */
function indexBody(): string {
  const template = document.createElement('template');
  template.innerHTML = /<body>([\s\S]*)<\/body>/.exec(indexHtml)?.[1] ?? '';
  for (const script of template.content.querySelectorAll('script')) script.remove();
  return template.innerHTML;
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

  // A test's window can close while a message is still queued, as when a test file ends right
  // after a save. The timers then find no document, and the queue stops instead of throwing; the
  // next message on a page speaks as before.
  it('E04-S07 a queued message whose page has gone stops quietly, and the next message speaks', async () => {
    announce('Article AX-20410 created');
    vi.stubGlobal('document', undefined);

    await expect(vi.runAllTimersAsync()).resolves.not.toThrow();

    vi.unstubAllGlobals();
    announce('Article AX-20411 created');
    expect((await spoken()).at(-1)).toBe('Article AX-20411 created');
  });

  it('E04-S07 a reset drops the queued messages and their timer, and the next message speaks', async () => {
    announce('Article AX-20410 created');
    announce('Article AX-20411 created');

    resetAnnouncements();
    expect(vi.getTimerCount()).toBe(0);

    announce('Article AX-20412 created');
    expect(await spoken()).toEqual(['', 'Article AX-20412 created']);
  });
});
