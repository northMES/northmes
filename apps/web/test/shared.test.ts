// SPDX-License-Identifier: AGPL-3.0-or-later
import { singletons } from '@northmes/web-build';
import { describe, expect, it, vi } from 'vitest';
import { shareSingletons } from '../src/federation.ts';

/** The share keys that shareSingletons hands to the runtime in one registerShared call. */
function registeredKeys(dev: boolean): string[] {
  const runtime = { registerShared: vi.fn() };
  shareSingletons(runtime, { dev });
  expect(runtime.registerShared).toHaveBeenCalledOnce();
  return Object.keys(runtime.registerShared.mock.calls[0]?.[0] ?? {}).sort();
}

describe('shareSingletons', () => {
  it('E02-S05 the registerShared keys equal the list in shared.mjs', () => {
    expect(registeredKeys(false)).toEqual(singletons().sort());
    expect(registeredKeys(true)).toEqual(singletons({ dev: true }).sort());
  });
});
