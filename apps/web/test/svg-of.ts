// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The SVG text that an image's address names: a data URL, as Vite inlines a small file, or a path
 * from `root`, such as a file under a build's /assets/ or a source path of index.html.
 */
export function svgOf(src: string, root: string): string {
  const inline = /^data:image\/svg\+xml(;base64)?,(.*)$/s.exec(src);
  if (inline === null) return readFileSync(join(root, src), 'utf8');
  const [, base64, data = ''] = inline;
  return base64 === undefined ? decodeURIComponent(data) : Buffer.from(data, 'base64').toString();
}
