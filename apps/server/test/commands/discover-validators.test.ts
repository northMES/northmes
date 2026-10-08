// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { BootError } from '../../src/boot/boot-error.ts';
import { discoverValidators } from '../../src/commands/discover-validators.ts';
import { dispatch, JobResolver, ReleaseJob } from '../fixtures/commands/dispatch.ts';
import {
  HoldCheck,
  holdRules,
  QuantityCap,
  strayRules,
} from '../fixtures/commands/misplaced-validators.ts';

describe('discoverValidators', () => {
  it('E02-S04 a validator on a command that is not validatable, or without dependsOn on the owner, stops boot', () => {
    const discover = () =>
      discoverValidators(
        [dispatch, holdRules, strayRules],
        [
          { module: 'dispatch', providers: [JobResolver, ReleaseJob] },
          { module: 'hold-rules', providers: [HoldCheck] },
          { module: 'stray-rules', providers: [QuantityCap] },
        ],
      );

    expect(discover).toThrow(BootError);
    expect(discover).toThrow(
      new BootError([
        'Validator hold-check of module hold-rules is on dispatch.holdJob, which no module declares validatable',
        'Validator quantity-cap of module stray-rules is on dispatch.releaseJob of module dispatch, which is not in the dependsOn of stray-rules',
      ]),
    );
  });
});
