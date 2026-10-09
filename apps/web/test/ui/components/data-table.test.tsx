// SPDX-License-Identifier: AGPL-3.0-or-later
import { cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DataTable,
  type DataTableColumn,
  type DataTablePaging,
  type DataTableProps,
  type DataTableSort,
} from '../../../src/ui/components/data-table/index.ts';

afterEach(cleanup);

interface Article {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly group: string;
}

// Fictional articles; the server returns them sorted and paged.
const articles: readonly Article[] = [
  { id: 'a1', code: 'AX-20411', name: 'Fläns DN80 rostfri', group: 'Flanges' },
  { id: 'a2', code: 'AX-20410', name: 'Fläns DN50 rostfri', group: 'Flanges' },
  { id: 'a3', code: 'AX-31007', name: 'Hydraulslang 12 mm', group: 'Hoses' },
];

const columns: readonly DataTableColumn<Article>[] = [
  { id: 'code', header: 'Article number', sortable: true, cell: (article) => article.code },
  { id: 'name', header: 'Name', sortable: true, cell: (article) => article.name },
  { id: 'group', header: 'Article group', cell: (article) => article.group },
];

const nameDescending: DataTableSort = { id: 'name', desc: true };

function paging(overrides: Partial<DataTablePaging> = {}): DataTablePaging {
  return {
    page: 1,
    pageSize: 3,
    totalCount: 8,
    hasPreviousPage: false,
    hasNextPage: true,
    onPrevious: vi.fn(),
    onNext: vi.fn(),
    ...overrides,
  };
}

function table(props: Partial<DataTableProps<Article>> = {}) {
  return (
    <DataTable
      label="Articles"
      columns={columns}
      rows={articles}
      getRowId={(article) => article.id}
      sort={nameDescending}
      onSortChange={vi.fn()}
      {...props}
    />
  );
}

/** The text of each cell of each body row. */
function bodyRows(): string[][] {
  const [, ...rows] = within(screen.getByRole('table', { name: 'Articles' })).getAllByRole('row');
  return rows.map((row) =>
    within(row)
      .getAllByRole('cell')
      .map((cell) => cell.textContent ?? ''),
  );
}

describe('DataTable', () => {
  it('E06-S03 a data table is a table named by its label, with a header per column and a row per item in the order the server sent', () => {
    render(table());

    const grid = screen.getByRole('table', { name: 'Articles' });
    expect(
      within(grid)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Article number', 'Name', 'Article group']);
    expect(bodyRows()).toEqual([
      ['AX-20411', 'Fläns DN80 rostfri', 'Flanges'],
      ['AX-20410', 'Fläns DN50 rostfri', 'Flanges'],
      ['AX-31007', 'Hydraulslang 12 mm', 'Hoses'],
    ]);
  });

  it('E06-S03 sortable headers are buttons whose aria-sort shows the sort; Enter sorts a column ascending and Space flips it, with focus on the header', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    const { rerender } = render(table({ onSortChange }));
    const header = (name: string) => screen.getByRole('columnheader', { name });

    expect(header('Name').getAttribute('aria-sort')).toBe('descending');
    expect(header('Article number').getAttribute('aria-sort')).toBe('none');
    expect(header('Article group').hasAttribute('aria-sort')).toBe(false);
    expect(within(header('Article group')).queryByRole('button')).toBeNull();

    await user.tab();
    const codeButton = screen.getByRole('button', { name: 'Article number' });
    expect(document.activeElement).toBe(codeButton);
    await user.keyboard('{Enter}');
    expect(onSortChange).toHaveBeenLastCalledWith({ id: 'code', desc: false });

    rerender(table({ onSortChange, sort: { id: 'code', desc: false } }));
    expect(header('Article number').getAttribute('aria-sort')).toBe('ascending');
    expect(header('Name').getAttribute('aria-sort')).toBe('none');
    await user.keyboard(' ');

    expect(onSortChange).toHaveBeenLastCalledWith({ id: 'code', desc: true });
    expect(document.activeElement).toBe(codeButton);
  });

  it('E06-S03 the pager shows the row range and moves with Next and Previous, and Tab skips a disabled Previous', async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(table({ columns: columns.slice(2), paging: paging({ onNext }) }));

    expect(screen.getByText('Rows 1 to 3 of 8')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Previous' }).hasAttribute('disabled')).toBe(true);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Next' }));
    await user.keyboard('{Enter}');

    expect(onNext).toHaveBeenCalledOnce();
  });

  it('E06-S03 the last page shows the rest of the range, and focus moves from Next to Previous when Next becomes disabled', async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    const { rerender } = render(
      table({ paging: paging({ page: 2, hasPreviousPage: true, onNext }) }),
    );
    expect(screen.getByText('Rows 4 to 6 of 8')).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Next' }));

    rerender(
      table({
        rows: articles.slice(0, 2),
        paging: paging({ page: 3, hasPreviousPage: true, hasNextPage: false, onNext }),
      }),
    );

    expect(screen.getByText('Rows 7 to 8 of 8')).toBeDefined();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Previous' }));
  });

  it('E06-S03 a list without a total shows Previous and Next without a row range', () => {
    render(table({ paging: paging({ totalCount: undefined }) }));

    expect(screen.queryByText(/^Rows /)).toBeNull();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDefined();
  });

  it('E06-S03 a loading table keeps its header and sort buttons, is busy, and shows skeleton rows in place of the rows', () => {
    render(table({ loading: true }));

    const grid = screen.getByRole('table', { name: 'Articles' });
    expect(grid.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('button', { name: 'Article number' })).toBeDefined();
    expect(within(grid).queryByText('AX-20411')).toBeNull();
    expect(within(grid).getAllByRole('row', { hidden: true }).length).toBeGreaterThan(1);
  });

  it('E02-S05 a numeric column aligns its header and cells to the end, and a hidden header still names its column', () => {
    interface Line {
      readonly id: string;
      readonly quantity: string;
    }
    const lineColumns: readonly DataTableColumn<Line>[] = [
      { id: 'quantity', header: 'Quantity', numeric: true, cell: (line) => line.quantity },
      { id: 'actions', header: 'Actions', headerHidden: true, cell: () => 'Release' },
    ];
    render(
      <DataTable
        label="Lines"
        columns={lineColumns}
        rows={[{ id: 'l1', quantity: '1,200' }]}
        getRowId={(line) => line.id}
      />,
    );

    const grid = screen.getByRole('table', { name: 'Lines' });
    const quantityHeader = within(grid).getByRole('columnheader', { name: 'Quantity' });
    expect(quantityHeader.className).toContain('text-end');
    expect(within(grid).getByRole('cell', { name: '1,200' }).className).toContain('text-end');
    const actionsHeader = within(grid).getByRole('columnheader', { name: 'Actions' });
    expect(actionsHeader.querySelector('.sr-only')?.textContent).toBe('Actions');
  });
});

