// SPDX-License-Identifier: AGPL-3.0-or-later
import * as apolloClient from '@apollo/client';
import * as apolloClientReact from '@apollo/client/react';
import * as webSdk from '@northmes/web-sdk';
import * as router from '@tanstack/react-router';
import * as react from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import * as reactDom from 'react-dom';

/** The key the files under /shared/ read the web build's modules from (ADR 0075). */
export const SHARED = Symbol.for('northmes.shared');

/**
 * Puts the web build's namespace of each shared web specifier on `target` under SHARED, frozen and
 * read-only, so a plugin's imports through the import map reach the same React, router and Apollo
 * as the shell. Runs before any plugin loads; a second call changes nothing.
 */
export function registerSharedModules(target: object = globalThis): void {
  if (Object.hasOwn(target, SHARED)) return;
  Object.defineProperty(target, SHARED, {
    value: Object.freeze({
      react,
      'react-dom': reactDom,
      'react/jsx-runtime': jsxRuntime,
      '@tanstack/react-router': router,
      '@apollo/client': apolloClient,
      '@apollo/client/react': apolloClientReact,
      '@northmes/web-sdk': webSdk,
    }),
    writable: false,
    configurable: false,
    enumerable: false,
  });
}
