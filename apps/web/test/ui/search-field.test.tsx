// SPDX-License-Identifier: AGPL-3.0-or-later
import { act, cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchField } from '../../src/ui/search-field.tsx';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function setup() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

describe('SearchField', () => {
  it('E04-S07 a search field is a searchbox named by its label that searches for the trimmed text after a pause in typing', async () => {
    const user = setup();
    const onSearch = vi.fn();
    render(<SearchField label="Search articles" value="" onSearch={onSearch} />);

    const field = screen.getByRole('searchbox', { name: 'Search articles' });
    await user.type(field, ' fläns ');
    expect(onSearch).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(onSearch).toHaveBeenCalledOnce();
    expect(onSearch).toHaveBeenCalledWith('fläns');
    expect(document.activeElement).toBe(field);
    expect(field.getAttribute('maxlength')).toBe('100');
  });

  it('E04-S07 Escape empties the field and searches for nothing at once, and focus stays in the field', async () => {
    const user = setup();
    const onSearch = vi.fn();
    render(<SearchField label="Search articles" value="fläns" onSearch={onSearch} />);

    const field = screen.getByRole('searchbox', { name: 'Search articles' }) as HTMLInputElement;
    await user.click(field);
    await user.keyboard('{Escape}');

    expect(field.value).toBe('');
    expect(onSearch).toHaveBeenCalledExactlyOnceWith('');
    expect(document.activeElement).toBe(field);
  });

  it('E04-S07 Clear search shows only with text, empties the field, searches for nothing and returns focus to the field', async () => {
    const user = setup();
    const onSearch = vi.fn();
    render(<SearchField label="Search articles" value="" onSearch={onSearch} />);
    const field = screen.getByRole('searchbox', { name: 'Search articles' }) as HTMLInputElement;
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();

    await user.type(field, 'hydraul');
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(field.value).toBe('');
    expect(onSearch).toHaveBeenCalledExactlyOnceWith('');
    expect(document.activeElement).toBe(field);
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
  });

  it('E04-S07 the field shows a new value from outside, such as after Clear filters', () => {
    const onSearch = vi.fn();
    const { rerender } = render(
      <SearchField label="Search articles" value="fläns" onSearch={onSearch} />,
    );

    rerender(<SearchField label="Search articles" value="" onSearch={onSearch} />);

    expect(
      (screen.getByRole('searchbox', { name: 'Search articles' }) as HTMLInputElement).value,
    ).toBe('');
    expect(onSearch).not.toHaveBeenCalled();
  });
});
