// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { join } from 'node:path';
import { within } from '@testing-library/react';
import { expect } from 'vitest';
import { svgOf } from './svg-of.ts';

/** The web's root, where index.html's source paths start. */
const webRoot = join(import.meta.dirname, '..');

/**
 * Expects the NorthMES logo in `container`: one image named NorthMES whose two files have no text
 * of their own, the file with the name in dark text shown in the light theme and the one with
 * light text in the dark theme, both 32 px tall. Their width and height attributes keep that size
 * before the stylesheet applies (BO1).
 */
export function expectLogo(container: HTMLElement): void {
  const logo = within(container).getByRole('img', { name: 'NorthMES' });
  const files = [...logo.querySelectorAll('img')];
  expect(files.map((file) => file.getAttribute('alt'))).toEqual(['', '']);
  const [light, dark] = files;
  expect(svgOf(light?.getAttribute('src') ?? '', webRoot)).toMatch(/fill=["']#1f2022["']/);
  expect(light?.getAttribute('class')).toContain('dark:hidden');
  expect(svgOf(dark?.getAttribute('src') ?? '', webRoot)).toMatch(/fill=["']#ececec["']/);
  expect(dark?.getAttribute('class')).toMatch(/(^|\s)hidden(\s|$)/);
  expect(dark?.getAttribute('class')).toContain('dark:block');
  for (const file of files) {
    expect(file.getAttribute('class')).toContain('h-8');
    expect([file.getAttribute('width'), file.getAttribute('height')]).toEqual(['108', '32']);
  }
}
