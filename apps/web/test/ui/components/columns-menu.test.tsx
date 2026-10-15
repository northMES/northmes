// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ColumnsMenu } from '../../../src/ui/components/columns-menu/index.ts';

afterEach(cleanup);

const columns = [
  { id: 'code', label: 'Article number', alwaysShown: true },
  { id: 'name', label: 'Name' },
  { id: 'source', label: 'Source' },
];

describe('ColumnsMenu', () => {
  it('E06-S03 Columns lists a checkbox per column, the always shown one checked and disabled, and a click hands back the hidden columns', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ColumnsMenu columns={columns} hidden={[]} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Columns' }));
    const items = await screen.findAllByRole('menuitemcheckbox');
    expect(
      items.map((item) => [
        item.textContent,
        item.getAttribute('aria-checked'),
        item.getAttribute('aria-disabled'),
      ]),
    ).toEqual([
      ['Article number Always shown', 'true', 'true'],
      ['Name', 'true', null],
      ['Source', 'true', null],
    ]);
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Source' }));

    expect(onChange).toHaveBeenCalledWith(['source']);
  });
});
