// SPDX-License-Identifier: AGPL-3.0-or-later
import * as ApolloClient from '@apollo/client';
import * as ApolloReact from '@apollo/client/react';
import type { ModuleFederation } from '@module-federation/runtime';
import * as WebSdk from '@northmes/web-sdk';
import * as TanstackRouter from '@tanstack/react-router';
import * as React from 'react';
import * as JsxDevRuntime from 'react/jsx-dev-runtime';
import * as JsxRuntime from 'react/jsx-runtime';
import * as ReactDOM from 'react-dom';

/**
 * The shell's own module for each share key in packages/web-build/shared.mjs (ADR 0019). The shell
 * runs no federation build plugin, so it hands the runtime the modules it renders with, and a remote
 * always gets the same React, router and Apollo Client as the shell.
 */
const shellModules: Record<string, unknown> = {
  react: React,
  'react-dom': ReactDOM,
  'react/jsx-runtime': JsxRuntime,
  '@tanstack/react-router': TanstackRouter,
  '@apollo/client': ApolloClient,
  '@apollo/client/react': ApolloReact,
  '@northmes/web-sdk': WebSdk,
};

/** In dev, React's JSX transform imports react/jsx-dev-runtime, which is then shared too. */
const devModules: Record<string, unknown> = {
  'react/jsx-dev-runtime': JsxDevRuntime,
};

export interface ShareOptions {
  /** Whether the shell runs on the Vite dev server. */
  readonly dev: boolean;
  /** The version of the package behind each share key, as the shell's build read it. */
  readonly versions: Readonly<Record<string, string>>;
}

/**
 * Registers the shell's module for every share key with the runtime, once at boot. Remotes declare
 * each key with import: false and requiredVersion: false, so they bundle no copy.
 *
 * A remote still registers an entry of its own for each key, at the version it was built against,
 * whose getter throws. Each share therefore carries the version of the shell's package, which is the
 * remote's version too, because the catalog pins one version: the runtime prefers any other version
 * over an unknown one. Each share is also registered as loaded, and the runtime never replaces a
 * loaded share with an entry of the same version.
 */
export function shareSingletons(
  runtime: Pick<ModuleFederation, 'registerShared'>,
  { dev, versions }: ShareOptions,
): void {
  const modules = dev ? { ...shellModules, ...devModules } : shellModules;
  runtime.registerShared(
    Object.fromEntries(
      Object.entries(modules).map(([key, module]) => [
        key,
        {
          version: versions[key],
          scope: 'default',
          lib: () => module,
          shareConfig: { singleton: true, requiredVersion: false },
        },
      ]),
    ),
  );
}
