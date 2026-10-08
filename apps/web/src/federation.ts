// SPDX-License-Identifier: AGPL-3.0-or-later
import * as ApolloClient from '@apollo/client';
import * as ApolloReact from '@apollo/client/react';
import type { ModuleFederation } from '@module-federation/runtime';
import * as WebSdk from '@northmes/web-sdk';
import * as TanstackRouter from '@tanstack/react-router';
import * as React from 'react';
import * as JsxRuntime from 'react/jsx-runtime';
import * as ReactDOM from 'react-dom';

/**
 * The shell's own module for each share key in packages/web-build/shared.mjs (ADR 0019). The shell
 * runs no federation build plugin, so it hands the runtime the modules it renders with, and a remote
 * always gets the same React, router and Apollo Client as the shell.
 */
const shellModules: Record<string, () => Promise<unknown>> = {
  react: async () => React,
  'react-dom': async () => ReactDOM,
  'react/jsx-runtime': async () => JsxRuntime,
  '@tanstack/react-router': async () => TanstackRouter,
  '@apollo/client': async () => ApolloClient,
  '@apollo/client/react': async () => ApolloReact,
  '@northmes/web-sdk': async () => WebSdk,
};

/** In dev, React's JSX transform imports react/jsx-dev-runtime, which a production build lacks. */
const devModules: Record<string, () => Promise<unknown>> = {
  'react/jsx-dev-runtime': () => import('react/jsx-dev-runtime'),
};

/**
 * Registers the shell's module for every share key with the runtime, once at boot. Remotes declare
 * each key with import: false and requiredVersion: false, so they bundle no copy and require no
 * version, and the shell's module is the only one the runtime holds for a key.
 */
export function shareSingletons(
  runtime: Pick<ModuleFederation, 'registerShared'>,
  { dev }: { readonly dev: boolean },
): void {
  const modules = dev ? { ...shellModules, ...devModules } : shellModules;
  runtime.registerShared(
    Object.fromEntries(
      Object.entries(modules).map(([key, load]) => [
        key,
        {
          scope: 'default',
          get: async () => {
            const module = await load();
            return () => module;
          },
          shareConfig: { singleton: true, requiredVersion: false },
        },
      ]),
    ),
  );
}
