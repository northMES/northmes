// SPDX-License-Identifier: AGPL-3.0-or-later
import * as ApolloClient from '@apollo/client';
import * as ApolloReact from '@apollo/client/react';
import { createInstance, type ModuleFederation } from '@module-federation/runtime';
import { singletons } from '@northmes/web-build';
import * as WebSdk from '@northmes/web-sdk';
import * as TanstackRouter from '@tanstack/react-router';
import * as React from 'react';
import * as JsxDevRuntime from 'react/jsx-dev-runtime';
import * as JsxRuntime from 'react/jsx-runtime';
import * as ReactDOM from 'react-dom';
import { describe, expect, it, vi } from 'vitest';
import { shareSingletons } from '../src/federation.ts';

// One version for every package, as the catalog pins one version of each for the shell and every
// remote.
const versions = Object.fromEntries(singletons({ dev: true }).map((key) => [key, '1.2.3']));

/** The share keys that shareSingletons hands to the runtime in its one registerShared call. */
function registeredKeys(dev: boolean): string[] {
  const runtime = { registerShared: vi.fn() };
  shareSingletons(runtime, { dev, versions });
  expect(runtime.registerShared).toHaveBeenCalledOnce();
  return Object.keys(runtime.registerShared.mock.calls[0]?.[0] ?? {}).sort();
}

let runtimes = 0;

/** A federation runtime that holds the shell's shares, under a name no other test uses. */
function shellRuntime(): ModuleFederation {
  runtimes += 1;
  const runtime = createInstance({ name: `northmesShell${runtimes}`, remotes: [] });
  shareSingletons(runtime, { dev: true, versions });
  return runtime;
}

/** The module that runtime hands to code that loads the share key. */
async function moduleOf(runtime: ModuleFederation, key: string): Promise<unknown> {
  const factory = await runtime.loadShare(key);
  return factory === false ? false : factory();
}

describe('shareSingletons', () => {
  it('E02-S05 the registerShared keys equal the list in shared.mjs', () => {
    expect(registeredKeys(false)).toEqual(singletons().sort());
    expect(registeredKeys(true)).toEqual(singletons({ dev: true }).sort());
  });

  it("E02-S05 each share hands a remote the shell's own module instance", async () => {
    const runtime = shellRuntime();

    expect(await moduleOf(runtime, 'react')).toBe(React);
    expect(await moduleOf(runtime, 'react-dom')).toBe(ReactDOM);
    expect(await moduleOf(runtime, 'react/jsx-runtime')).toBe(JsxRuntime);
    expect(await moduleOf(runtime, 'react/jsx-dev-runtime')).toBe(JsxDevRuntime);
    expect(await moduleOf(runtime, '@tanstack/react-router')).toBe(TanstackRouter);
    expect(await moduleOf(runtime, '@apollo/client')).toBe(ApolloClient);
    expect(await moduleOf(runtime, '@apollo/client/react')).toBe(ApolloReact);
    expect(await moduleOf(runtime, '@northmes/web-sdk')).toBe(WebSdk);
  });

  it("E02-S05 a remote's consume-only entry for a key does not replace the shell's share", async () => {
    const shell = shellRuntime();
    // The entry that @module-federation/vite generates for a key a remote declares with
    // import: false: the version the remote was built against and a getter that throws.
    const remote = createInstance({
      name: 'planning',
      remotes: [],
      shared: {
        react: {
          version: '1.2.3',
          scope: 'default',
          get: async () => {
            throw new Error("Shared module 'react' must be provided by host");
          },
          shareConfig: { singleton: true, requiredVersion: false },
        },
      },
    });
    // What the remote's container does when the shell initialises it with its share scope.
    const scope = shell.shareScopeMap.default;
    if (scope === undefined) throw new Error('the shell registered no default share scope');
    remote.initShareScopeMap('default', scope);

    expect(await moduleOf(remote, 'react')).toBe(React);
  });
});
