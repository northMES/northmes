// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { getConfig } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { announce } from '../src/ui/lib/announce.ts';

describe('the web test setup', () => {
  it('E04-S01 a findBy query waits up to 5 s, so a test on a loaded machine does not fail at 1 s', () => {
    expect(getConfig().asyncUtilTimeout).toBe(5000);
  });

  // The first test ends with a message still queued and drops its fake timer, as a test that ends
  // right after a save does. The setup resets the queue after each test, so the second speaks.
  describe('an announcement a test leaves queued', () => {
    it('E04-S07 is left queued by one test', () => {
      vi.useFakeTimers();
      announce('Article AX-20410 created');
      vi.useRealTimers();
    });

    it('E04-S07 does not keep the next test from speaking', async () => {
      vi.useFakeTimers();
      announce('Article AX-20411 created');
      await vi.runAllTimersAsync();
      vi.useRealTimers();

      expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe(
        'Article AX-20411 created',
      );
    });
  });
});
