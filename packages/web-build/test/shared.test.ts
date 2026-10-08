// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { singletons } from '../shared.mjs';

describe('singletons', () => {
  it('E02-S05 the singleton list adds react/jsx-dev-runtime in dev, where the JSX transform imports it', () => {
    expect(singletons({ dev: true })).toEqual([...singletons(), 'react/jsx-dev-runtime']);
    expect(singletons()).not.toContain('react/jsx-dev-runtime');
  });
});
