// SPDX-License-Identifier: AGPL-3.0-or-later
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { NavIcon } from '../../../src/ui/components/nav-icon/index.ts';
import { type NavIconName, navIconNames } from '../../../src/ui/lib/nav-icon-names.ts';

afterEach(cleanup);

/** The class of the svg that NavIcon renders for a name, such as "lucide lucide-package". */
function iconClass(name: string): string {
  const { container } = render(<NavIcon name={name as NavIconName} />);
  const svg = container.querySelector('svg');
  expect(svg?.getAttribute('aria-hidden')).toBe('true');
  return svg?.getAttribute('class') ?? '';
}

describe('NavIcon', () => {
  it('E04-S02 every name in navIconNames renders its own lucide icon, hidden from assistive technology', () => {
    const classes = navIconNames.map((name) => {
      const found = iconClass(name);
      cleanup();
      return found;
    });

    expect(classes[navIconNames.indexOf('Package')]).toContain('lucide-package');
    expect(new Set(classes).size).toBe(navIconNames.length);
    for (const found of classes) expect(found).not.toContain('lucide-shapes');
  });

  it('E04-S02 a name NavIcon does not know renders the fallback icon, Shapes', () => {
    expect(iconClass('NotAnIconName')).toContain('lucide-shapes');
  });
});
