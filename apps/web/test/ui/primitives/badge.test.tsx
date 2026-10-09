// SPDX-License-Identifier: AGPL-3.0-or-later
import { cleanup, render, screen } from '@testing-library/react';
import { Archive } from 'lucide-react';
import { afterEach, describe, expect, it } from 'vitest';
import { Badge } from '../../../src/ui/primitives/badge.tsx';

afterEach(cleanup);

describe('Badge', () => {
  it('E04-S01 a status badge reads as its text, and its icon is hidden from assistive technology', () => {
    render(<Badge icon={Archive}>Archived</Badge>);

    const badge = screen.getByText('Archived');
    expect(badge.textContent).toBe('Archived');
    expect(badge.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
