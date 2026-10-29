// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PageSection } from '../../../src/ui/components/page-section/index.ts';

afterEach(cleanup);

// The 16 px between stacked sections, between a section's heading row and its first block, and
// under the last section are read from the boxes the browser lays out in e2e/design-rules.spec.ts.

describe('PageSection', () => {
  it('E04-S07 a page section is a region named by its h2 that holds its lead and its content (#874)', () => {
    render(
      <PageSection title="Tool" lead="Created by the import.">
        <p>Code T-118</p>
      </PageSection>,
    );

    const section = screen.getByRole('region', { name: 'Tool' });
    expect(within(section).getByRole('heading', { level: 2 }).textContent).toBe('Tool');
    expect(within(section).getByText('Created by the import.')).toBeDefined();
    expect(within(section).getByText('Code T-118')).toBeDefined();
  });

  it('E04-S07 a page section shows its actions in the heading row and gives its h2 the id the page links to (#874)', () => {
    render(
      <PageSection
        id="order-demand"
        title="Demand"
        actions={<button type="button">Edit demand</button>}
      >
        <p>600 pcs</p>
      </PageSection>,
    );

    const section = screen.getByRole('region', { name: 'Demand' });
    expect(within(section).getByRole('button', { name: 'Edit demand' })).toBeDefined();
    expect(within(section).getByRole('heading', { level: 2 }).id).toBe('order-demand');
  });
});
