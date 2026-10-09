// SPDX-License-Identifier: AGPL-3.0-or-later
import { cleanup, render, screen } from '@testing-library/react';
import { Ban } from 'lucide-react';
import { afterEach, describe, expect, it } from 'vitest';
import { StatusBadge } from '../../../src/ui/components/status-badge/index.ts';

afterEach(cleanup);

describe('StatusBadge', () => {
  it('E04-S07 the text carries the state, and the icon beside it is hidden from screen readers', () => {
    render(
      <StatusBadge tone="destructive" icon={Ban}>
        Blocked
      </StatusBadge>,
    );

    const badge = screen.getByText('Blocked');
    expect(badge.getAttribute('data-tone')).toBe('destructive');
    expect(badge.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
