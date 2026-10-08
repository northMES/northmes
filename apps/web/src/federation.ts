// SPDX-License-Identifier: AGPL-3.0-or-later
import * as ApolloClient from '@apollo/client';
import * as ApolloReact from '@apollo/client/react';
import type { ModuleFederation } from '@module-federation/runtime';
import { apiPath } from '@northmes/contracts';
import * as WebSdk from '@northmes/web-sdk';
import { validateWebModule, type WebModule, type WebModuleEntry } from '@northmes/web-sdk';
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
 * A remote still registers an entry of its own for each key: the version it was built against and a
 * getter that throws. The runtime prefers any version over a share registered without one, so each
 * share carries the version of the shell's package, which equals the remote's because the catalog
 * pins one version of each package. Each share is also registered as loaded, and the runtime never
 * replaces a loaded share with an entry of the same version.
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

/** One module of the web module list that GET /api/v1/web/modules answers with (ADR 0019). */
export interface ListedModule extends WebModuleEntry {
  /** The Module Federation name of the module's remote. */
  readonly remoteName: string;
  /** The module's menu label, from the web block of its manifest. */
  readonly label: string;
  /** The module's menu position, from the web block of its manifest. */
  readonly order: number;
  /** The URL of the remote's mf-manifest.json. */
  readonly manifestUrl: string;
  /** The SHA-384 of the remote's mf-manifest.json, or null when the server misses its files. */
  readonly integrity: string | null;
}

/** Fetches the modules the server lists for this shell, in the server's order. */
export async function fetchModuleList(
  fetch: (url: string) => Promise<Response>,
): Promise<readonly ListedModule[]> {
  const response = await fetch(apiPath('web', 'modules'));
  if (!response.ok) {
    throw new Error(`The module list answered ${response.status} ${response.statusText}`.trim());
  }
  const { modules } = (await response.json()) as { readonly modules: readonly ListedModule[] };
  return modules;
}

/** The part of the Module Federation runtime that loads remotes, which tests replace. */
export interface FederationRuntime {
  registerRemotes(remotes: { name: string; entry: string }[]): void;
  loadRemote<T>(id: string): Promise<T | null>;
}

/**
 * A listed module after the shell tried to load its remote: the default export of the remote's
 * ./module entry, or null and the problem when the remote failed to load or exported a module that
 * differs from its list entry.
 */
export type LoadedModule =
  | { readonly listed: ListedModule; readonly module: WebModule }
  | { readonly listed: ListedModule; readonly module: null; readonly problem: string };

/**
 * Registers the remote of each listed module with the runtime, loads each remote's ./module entry,
 * all in parallel, and checks its default export against the list entry with validateWebModule. A
 * remote that fails leaves the others loading. The result keeps the list's order.
 */
export async function loadModules(
  list: readonly ListedModule[],
  runtime: FederationRuntime,
): Promise<LoadedModule[]> {
  runtime.registerRemotes(
    list.map(({ remoteName, manifestUrl }) => ({ name: remoteName, entry: manifestUrl })),
  );
  return Promise.all(
    list.map(async (listed): Promise<LoadedModule> => {
      try {
        const entry = await runtime.loadRemote<{ default?: unknown }>(
          `${listed.remoteName}/module`,
        );
        const module = entry?.default;
        const problems = validateWebModule(module, listed);
        if (problems.length > 0) return { listed, module: null, problem: problems.join('; ') };
        return { listed, module: module as WebModule };
      } catch (error) {
        return { listed, module: null, problem: messageOf(error) };
      }
    }),
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
