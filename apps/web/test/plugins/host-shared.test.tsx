// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import * as apolloClient from '@apollo/client';
import * as apolloClientReact from '@apollo/client/react';
import * as webSdk from '@northmes/web-sdk';
import { HOST_PROVIDED_WEB } from '@northmes/web-sdk';
import * as router from '@tanstack/react-router';
import * as react from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import * as reactDom from 'react-dom';
import { describe, expect, it } from 'vitest';
import { registerSharedModules, SHARED } from '../../src/plugins/host-shared.ts';

describe('the shared modules a plugin imports through the import map', () => {
  it("ADR 0075 registers the web build's own namespace of each shared specifier, once and read-only", () => {
    const target: Record<symbol, unknown> = {};

    registerSharedModules(target);
    registerSharedModules(target);

    const shared = target[SHARED] as Record<string, unknown>;
    expect(Object.keys(shared)).toEqual([...HOST_PROVIDED_WEB]);
    expect(shared).toEqual({
      react,
      'react-dom': reactDom,
      'react/jsx-runtime': jsxRuntime,
      '@tanstack/react-router': router,
      '@apollo/client': apolloClient,
      '@apollo/client/react': apolloClientReact,
      '@northmes/web-sdk': webSdk,
    });
    expect(shared.react).toBe(react);
    expect(Object.isFrozen(shared)).toBe(true);
    expect(Object.getOwnPropertyDescriptor(target, SHARED)).toMatchObject({
      writable: false,
      configurable: false,
    });
  });
});
