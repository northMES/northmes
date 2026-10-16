// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { defineWebModule, useContributions } from '@northmes/web-sdk';
import { createRoute } from '@tanstack/react-router';
import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ShellModule } from '../src/modules.ts';
import { companies, fakeApi, renderShellAt, viewer } from './settings-fixtures.tsx';

afterEach(cleanup);

/** A page that lists the contributions to the dashboard's slot, as the dashboard reads them. */
function Widgets() {
  const contributions = useContributions('core/dashboard/widgets/v1');
  return (
    <ul aria-label="Widgets">
      {contributions.map(({ id, label }) => (
        <li key={id}>{label}</li>
      ))}
    </ul>
  );
}

/** A module with a page at /$plant/board and two dashboard widgets, each behind a permission. */
const board: ShellModule = {
  label: 'Board',
  order: 20,
  links: [{ label: 'Board', icon: 'Table', link: ({ plant }) => ({ href: `/${plant}/board` }) }],
  contributions: ['Late orders', 'Article count'].map((label, index) => ({
    id: `board.widget-${index}`,
    slot: 'core/dashboard/widgets/v1',
    label,
    order: 20 - index,
    permission: index === 0 ? 'board.order:read' : 'core.article:read',
    moduleId: 'board',
    moduleLabel: 'Board',
  })),
  module: defineWebModule({
    id: 'board',
    version: '0.1.0',
    routes: (plantRoute) =>
      createRoute({ getParentRoute: () => plantRoute, path: 'board', component: Widgets }),
  }),
};

describe('contributions in the shell (ADR 0068)', () => {
  it("gives a slot the modules' contributions by order, only those whose permission the user holds at the plant", async () => {
    const { fetch } = fakeApi({
      CoreCompanies: companies,
      CoreViewer: () => viewer(['core.article:read'], []),
    });
    renderShellAt('/plant-a/board', [board], { fetch });

    const list = await screen.findByRole('list', { name: 'Widgets' });
    await screen.findByText('Article count');
    expect(list.textContent).toBe('Article count');
  });

  it('draws no sidebar group for a module whose screens are only contributions', async () => {
    const { fetch } = fakeApi({
      CoreCompanies: companies,
      CoreViewer: () => viewer(['core.article:read'], []),
    });
    const widgetsOnly: ShellModule = {
      label: 'Article count',
      order: 30,
      links: [],
      contributions: [],
      module: defineWebModule({ id: 'example-article-count', version: '0.1.0' }),
    };
    renderShellAt('/plant-a/board', [board, widgetsOnly], { fetch });

    const sidebar = await screen.findByRole('navigation', { name: 'Main' });
    await screen.findByRole('list', { name: 'Widgets' });
    expect(within(sidebar).getByRole('link', { name: 'Board' })).toBeDefined();
    expect(within(sidebar).queryByText('Article count')).toBeNull();
  });
});
