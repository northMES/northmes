// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { OwnerTag } from '../../../src/ui/components/owner-tag/index.ts';

afterEach(cleanup);

describe('OwnerTag (design #728, the From the ERP tag)', () => {
  it('#728 names the owner of a value in words, with the lock as decoration', () => {
    render(<OwnerTag>From the ERP</OwnerTag>);

    const tag = screen.getByText('From the ERP');
    expect(tag.textContent).toBe('From the ERP');
    expect(tag.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
