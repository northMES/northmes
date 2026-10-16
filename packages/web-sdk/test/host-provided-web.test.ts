// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { HOST_PROVIDED_WEB, isHostProvidedWeb } from '../src/host-provided-web.ts';

describe('HOST_PROVIDED_WEB', () => {
  it('lists the shared web specifiers of ADR 0075 that the web build provides', () => {
    expect(HOST_PROVIDED_WEB).toEqual([
      'react',
      'react-dom',
      'react/jsx-runtime',
      '@tanstack/react-router',
      '@apollo/client',
      '@apollo/client/react',
      '@northmes/web-sdk',
    ]);
  });

  it('matches a shared specifier exactly and no other subpath, such as react-dom/client', () => {
    expect(isHostProvidedWeb('react/jsx-runtime')).toBe(true);
    expect(isHostProvidedWeb('@apollo/client/react')).toBe(true);
    expect(isHostProvidedWeb('react-dom/client')).toBe(false);
    expect(isHostProvidedWeb('@apollo/client/cache')).toBe(false);
    expect(isHostProvidedWeb('lodash')).toBe(false);
  });
});
