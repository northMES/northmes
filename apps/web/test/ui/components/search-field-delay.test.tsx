// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchField } from '../../../src/ui/components/search-field/index.ts';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('SearchField delay (ADR 0090, The order filter)', () => {
  it('#940 searches after the pause a screen sets, 250 ms for the order filter', () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    render(<SearchField label="Filter orders" value="" onSearch={onSearch} delayMs={250} />);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter orders' }), {
      target: { value: '1003' },
    });
    act(() => vi.advanceTimersByTime(249));
    expect(onSearch).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));

    expect(onSearch).toHaveBeenCalledWith('1003');
  });
});
