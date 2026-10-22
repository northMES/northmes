// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ProductLogo } from '../../../src/ui/components/product-logo/index.ts';
import { expectLogo } from '../../product-logo.ts';

afterEach(cleanup);

/** The web's root. */
const webRoot = join(import.meta.dirname, '..', '..', '..');

/** Each logo file the web ships, by the design file in docs/design/logo it copies. */
const copies = [
  ['src/ui/components/product-logo/northmes-logo.svg', 'northmes-logo.svg'],
  ['src/ui/components/product-logo/northmes-logo-on-dark.svg', 'northmes-logo-on-dark.svg'],
  ['src/boot/favicon.svg', 'northmes-icon-dark.svg'],
] as const;

describe('ProductLogo', () => {
  it('E04-S02 the logo is one image named NorthMES, drawn by the light file in the light theme and the on-dark file in the dark theme', () => {
    const { container } = render(<ProductLogo />);

    expectLogo(container);
  });

  it('E04-S02 the logo files the web ships are the files of docs/design/logo', () => {
    for (const [copy, design] of copies) {
      expect(readFileSync(join(webRoot, copy), 'utf8'), copy).toBe(
        readFileSync(join(webRoot, '..', '..', 'docs', 'design', 'logo', design), 'utf8'),
      );
    }
  });
});
