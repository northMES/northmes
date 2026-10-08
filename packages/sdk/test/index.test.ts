// SPDX-License-Identifier: MIT
import { readFileSync } from 'node:fs';
import * as sdk from '@northmes/sdk';
import { describe, expect, it } from 'vitest';

function readPackageFile(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

describe('@northmes/sdk root', () => {
  it('E02-S01 the root of @northmes/sdk exports defineModule, moduleNames and HOST_PROVIDED', () => {
    expect(Object.keys(sdk).sort()).toEqual([
      'HOST_PROVIDED',
      'defineModule',
      'isHostProvided',
      'moduleNames',
    ]);
    expect(sdk.moduleNames('planning').ownerRole).toBe('nm_mod_planning');
    expect(sdk.HOST_PROVIDED).toContain('graphql');
  });

  it('E02-S01 defineModule is tagged @internal', () => {
    // The JSDoc block that ends on the line directly above the declaration.
    const jsdoc = /\/\*\*((?:(?!\*\/)[\s\S])*)\*\/\n(?=export function defineModule\b)/.exec(
      readPackageFile('src/manifest.ts'),
    );

    expect(jsdoc, 'a JSDoc block directly above defineModule').not.toBeNull();
    expect(jsdoc?.[1]).toMatch(/(?:^|\s)@internal\b/);
  });

  it('E02-S01 packages/sdk carries its MIT LICENSE', () => {
    expect(readPackageFile('LICENSE')).toMatch(/^MIT License\n/);
  });
});
