// SPDX-License-Identifier: AGPL-3.0-or-later
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Checkbox } from '../../../src/ui/primitives/checkbox.tsx';

afterEach(cleanup);

describe('Checkbox', () => {
  it("E04-S01 a checkbox has the D1 look and shows keyboard focus with the D1 two-tone ring of app.css, not shadcn's ring", () => {
    render(<Checkbox aria-label="Show archived" />);

    // happy-dom applies no Tailwind, so the test reads the classes.
    const classes = screen.getByRole('checkbox', { name: 'Show archived' }).className.split(' ');
    expect(classes).toEqual(
      expect.arrayContaining(['border-input', 'bg-card', 'hover:border-foreground']),
    );
    expect(classes).not.toContain('outline-none');
    expect(classes.filter((name) => /^focus-visible:(ring|border)/.test(name))).toEqual([]);
  });
});
