// SPDX-License-Identifier: AGPL-3.0-or-later
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchField } from '../../src/ui/search-field.tsx';

afterEach(cleanup);

/** Waits longer than the field's pause in typing, so a pending search would have run. */
function afterThePause(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 400));
}

describe('SearchField', () => {
  it('E04-S07 a search field is a searchbox named by its label that searches for the trimmed text after a pause in typing', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<SearchField label="Search articles" value="" onSearch={onSearch} />);

    const field = screen.getByRole('searchbox', { name: 'Search articles' });
    await user.type(field, ' fläns ');
    expect(onSearch).not.toHaveBeenCalled();
    await waitFor(() => expect(onSearch).toHaveBeenCalled());
    await afterThePause();

    expect(onSearch).toHaveBeenCalledExactlyOnceWith('fläns');
    expect(document.activeElement).toBe(field);
    expect(field.getAttribute('maxlength')).toBe('100');
  });

  it('E04-S07 Escape empties the field and searches for nothing at once, and focus stays in the field', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<SearchField label="Search articles" value="fläns" onSearch={onSearch} />);

    const field = screen.getByRole('searchbox', { name: 'Search articles' }) as HTMLInputElement;
    await user.click(field);
    await user.keyboard('{Escape}');
    await afterThePause();

    expect(field.value).toBe('');
    expect(onSearch).toHaveBeenCalledExactlyOnceWith('');
    expect(document.activeElement).toBe(field);
  });

  it('E04-S07 Clear search shows only with text, empties the field, searches for nothing and returns focus to the field', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    const { rerender } = render(
      <SearchField label="Search articles" value="" onSearch={onSearch} />,
    );
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
    // The search "hydraul" is in effect, as after typing and the pause.
    rerender(<SearchField label="Search articles" value="hydraul" onSearch={onSearch} />);

    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    await afterThePause();

    const field = screen.getByRole('searchbox', { name: 'Search articles' }) as HTMLInputElement;
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

  it('E06-S06 the field gives its input the id it takes, so a page can move focus to it', () => {
    render(
      <SearchField id="articles-search" label="Search articles" value="" onSearch={vi.fn()} />,
    );

    expect(screen.getByRole('searchbox', { name: 'Search articles' }).id).toBe('articles-search');
  });
});
