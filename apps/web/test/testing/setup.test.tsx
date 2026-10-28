// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it, vi } from 'vitest';
import { announce } from '../../src/ui/lib/announce.ts';

/**
 * The web test setup (test/setup.ts) resets the announcer after each test. The two tests run in
 * this order: the first leaves a message queued and drops its fake timer, as a test that ends
 * right after a save does; the second speaks, which it could not if the queue were still busy
 * with the first one's message. ui/lib/announce.test.ts covers resetAnnouncements itself; this
 * pair covers that the setup calls it.
 */
describe('the web test setup resets the announcer after each test', () => {
  it('E04-S07 a test leaves a message queued with its timer pending', () => {
    vi.useFakeTimers();
    announce('Article AX-20410 created');
    expect(vi.getTimerCount()).toBe(1);
    vi.useRealTimers();
  });

  it('E04-S07 the next test speaks its own message', async () => {
    vi.useFakeTimers();
    announce('Article AX-20411 created');
    await vi.runAllTimersAsync();
    vi.useRealTimers();

    expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe(
      'Article AX-20411 created',
    );
  });
});
