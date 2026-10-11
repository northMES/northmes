// SPDX-License-Identifier: AGPL-3.0-or-later
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FilterChip } from '../../../src/ui/components/filter-chip/index.ts';

afterEach(cleanup);

describe('FilterChip', () => {
  it('E06-S03 a chip names its filter and the picked values with their counts, and its button removes the filter', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      <FilterChip
        label="Article group"
        values={[
          { label: 'Hoses', count: 21 },
          { label: 'Shafts', count: 40 },
        ]}
        removeLabel="Remove the article group filter"
        onRemove={onRemove}
      />,
    );

    expect(screen.getByText('Article group:').parentElement?.textContent).toBe(
      'Article group: Hoses 21, Shafts 40',
    );
    await user.click(screen.getByRole('button', { name: 'Remove the article group filter' }));

    expect(onRemove).toHaveBeenCalledOnce();
  });
});
