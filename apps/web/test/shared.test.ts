// SPDX-License-Identifier: AGPL-3.0-or-later
import * as ApolloClient from '@apollo/client';
import * as ApolloReact from '@apollo/client/react';
import { singletons } from '@northmes/web-build';
import * as WebSdk from '@northmes/web-sdk';
import * as TanstackRouter from '@tanstack/react-router';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as JsxDevRuntime from 'react/jsx-dev-runtime';
import * as JsxRuntime from 'react/jsx-runtime';
import { describe, expect, it, vi } from 'vitest';
import { shareSingletons } from '../src/federation.ts';

type Shares = Record<string, { get: () => Promise<() => unknown> }>;

/** What shareSingletons hands to the runtime in its one registerShared call. */
function registered(dev: boolean): Shares {
  const runtime = { registerShared: vi.fn() };
  shareSingletons(runtime, { dev });
  expect(runtime.registerShared).toHaveBeenCalledOnce();
  return runtime.registerShared.mock.calls[0]?.[0] ?? {};
}

function registeredKeys(dev: boolean): string[] {
  return Object.keys(registered(dev)).sort();
}

/** The module a share hands to a remote that loads it. */
async function moduleOf(shares: Shares, key: string): Promise<unknown> {
  const share = shares[key];
  if (share === undefined) throw new Error(`no share for ${key}`);
  return (await share.get())();
}

describe('shareSingletons', () => {
  it('E02-S05 the registerShared keys equal the list in shared.mjs', () => {
    expect(registeredKeys(false)).toEqual(singletons().sort());
    expect(registeredKeys(true)).toEqual(singletons({ dev: true }).sort());
  });

  it("E02-S05 each share hands a remote the shell's own module instance", async () => {
    const shares = registered(true);

    expect(await moduleOf(shares, 'react')).toBe(React);
    expect(await moduleOf(shares, 'react-dom')).toBe(ReactDOM);
    expect(await moduleOf(shares, 'react/jsx-runtime')).toBe(JsxRuntime);
    expect(await moduleOf(shares, 'react/jsx-dev-runtime')).toBe(JsxDevRuntime);
    expect(await moduleOf(shares, '@tanstack/react-router')).toBe(TanstackRouter);
    expect(await moduleOf(shares, '@apollo/client')).toBe(ApolloClient);
    expect(await moduleOf(shares, '@apollo/client/react')).toBe(ApolloReact);
    expect(await moduleOf(shares, '@northmes/web-sdk')).toBe(WebSdk);
  });
});
