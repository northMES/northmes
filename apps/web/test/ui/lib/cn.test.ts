// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { cn } from '../../../src/ui/lib/cn.ts';

describe('cn', () => {
  it('E04-S01 cn joins class names, drops falsy ones, and lets a later Tailwind class win over a conflicting one', () => {
    const loading = false;

    expect(cn('px-2 text-sm', loading && 'opacity-50', ['bg-card'], 'px-4', undefined)).toBe(
      'text-sm bg-card px-4',
    );
    expect(cn('bg-primary text-primary-foreground', 'bg-destructive')).toBe(
      'text-primary-foreground bg-destructive',
    );
  });
});
