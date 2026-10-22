// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { within } from '@testing-library/react';
import { expect } from 'vitest';

/**
 * The SVG text an img's src names: a data URL, as Vite inlines a small file, or a path from the
 * web's root, as index.html's source names one.
 */
export function svgOf(src: string): string {
  const inline = /^data:image\/svg\+xml(;base64)?,(.*)$/s.exec(src);
  if (inline === null) return readFileSync(join(import.meta.dirname, '..', src), 'utf8');
  const [, base64, data = ''] = inline;
  return base64 === undefined ? decodeURIComponent(data) : Buffer.from(data, 'base64').toString();
}

/**
 * Expects the NorthMES logo in `container`: one image named NorthMES whose two files have no text
 * of their own, the file with the name in dark text shown in the light theme and the one with
 * light text in the dark theme, both 32 px tall.
 */
export function expectLogo(container: HTMLElement): void {
  const logo = within(container).getByRole('img', { name: 'NorthMES' });
  const files = [...logo.querySelectorAll('img')];
  expect(files.map((file) => file.getAttribute('alt'))).toEqual(['', '']);
  const [light, dark] = files;
  expect(svgOf(light?.getAttribute('src') ?? '')).toMatch(/fill=["']#1f2022["']/);
  expect(light?.getAttribute('class')).toContain('dark:hidden');
  expect(svgOf(dark?.getAttribute('src') ?? '')).toMatch(/fill=["']#ececec["']/);
  expect(dark?.getAttribute('class')).toMatch(/(^|\s)hidden(\s|$)/);
  expect(dark?.getAttribute('class')).toContain('dark:block');
  for (const file of files) expect(file.getAttribute('class')).toContain('h-8');
}
