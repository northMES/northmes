// SPDX-License-Identifier: MIT
import * as sdk from '@northmes/sdk';
import { describe, expect, it } from 'vitest';

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
});
