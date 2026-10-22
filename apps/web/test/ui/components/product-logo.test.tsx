// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, it } from 'vitest';
import { ProductLogo } from '../../../src/ui/components/product-logo/index.ts';
import { expectLogo } from '../../product-logo.ts';

afterEach(cleanup);

describe('ProductLogo', () => {
  it('E04-S02 the logo is one image named NorthMES, drawn by the light file in the light theme and the on-dark file in the dark theme', () => {
    const { container } = render(<ProductLogo />);

    expectLogo(container);
  });
});
