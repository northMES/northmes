// SPDX-License-Identifier: AGPL-3.0-or-later
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { BootError } from '../../src/boot/boot-error.ts';
import { DEFAULT_VALIDATOR_TIMEOUT_MS } from '../../src/commands/command-bus.ts';
import { discoverValidators } from '../../src/commands/discover-validators.ts';
import { dispatch, HoldJob } from '../fixtures/commands/dispatch.ts';
import {
  holdRules,
  looseRules,
  patientRules,
  QuantityCap,
  strayRules,
} from '../fixtures/commands/misplaced-validators.ts';
import { QuantityLimit, releaseLimits } from '../fixtures/commands/validators.ts';

/** A Nest module that lists its providers through a module it imports, as an entity module does. */
@Module({ providers: [QuantityLimit] })
class ReleaseLimitsChecksModule {}

@Module({ imports: [ReleaseLimitsChecksModule] })
class NestedReleaseLimitsModule {}

/** Lists QuantityCap as a class provider with useClass. */
@Module({ providers: [{ provide: 'quantity-cap', useClass: QuantityCap }] })
class ClassProviderModule {}

describe('discoverValidators', () => {
  it('E02-S04 a validator on a command whose owner lists it with a validatable contract is registered, with no manifest', () => {
    const validators = discoverValidators([dispatch, releaseLimits]);

    expect(validators).toEqual([{ module: 'release-limits', validator: QuantityLimit.validator }]);
  });

  it('E02-S04 a validator that a module lists through a Nest module it imports is found', () => {
    const validators = discoverValidators([
      dispatch,
      { ...releaseLimits, module: NestedReleaseLimitsModule },
    ]);

    expect(validators).toEqual([{ module: 'release-limits', validator: QuantityLimit.validator }]);
  });

  it("E02-S04 a validator on a command whose owner's contract is not validatable stops boot, whatever the validator's copy says", () => {
    // dispatch lists HoldJob, whose contract is not validatable; hold-rules' copy says it is.
    const discover = () => discoverValidators([dispatch, holdRules]);

    expect(HoldJob.command.contract.name).toBe('dispatch.holdJob');
    expect(discover).toThrow(
      new BootError([
        'Validator hold-check of module hold-rules is on dispatch.holdJob, which no module declares validatable',
      ]),
    );
  });

  it('E02-S04 a validator from a module without dependsOn on the owner stops boot', () => {
    const discover = () => discoverValidators([dispatch, strayRules]);

    expect(discover).toThrow(BootError);
    expect(discover).toThrow(
      new BootError([
        'Validator quantity-cap of module stray-rules is on dispatch.releaseJob of module dispatch, which is not in the dependsOn of stray-rules',
      ]),
    );
  });

  it('E02-S04 a validator listed as a class provider with useClass is checked like the plain class', () => {
    const discover = () =>
      discoverValidators([dispatch, { ...strayRules, module: ClassProviderModule }]);

    expect(discover).toThrow(
      new BootError([
        'Validator quantity-cap of module stray-rules is on dispatch.releaseJob of module dispatch, which is not in the dependsOn of stray-rules',
      ]),
    );
  });

  it("E02-S04 a validator whose timeoutMs is 0 or longer than the host's limit stops boot", () => {
    const discover = () => discoverValidators([dispatch, patientRules]);

    // Owners declare no limit per command yet, so the host's default limit is the longest allowed.
    const limit = DEFAULT_VALIDATOR_TIMEOUT_MS;
    expect(discover).toThrow(
      new BootError([
        `Validator patient-check of module patient-rules sets timeoutMs to 60000. Set it above 0 and at most ${limit}, the limit of dispatch.releaseJob, or remove it`,
        `Validator instant-check of module patient-rules sets timeoutMs to 0. Set it above 0 and at most ${limit}, the limit of dispatch.releaseJob, or remove it`,
      ]),
    );
  });

  it('E02-S04 a validator whose timeoutMs is not a number stops boot', () => {
    const discover = () => discoverValidators([dispatch, looseRules]);

    // Compared with 0 and the limit, '500' and true would pass, and true would wait 1 ms.
    const limit = DEFAULT_VALIDATOR_TIMEOUT_MS;
    expect(discover).toThrow(
      new BootError([
        `Validator text-check of module loose-rules sets timeoutMs to '500'. Set it above 0 and at most ${limit}, the limit of dispatch.releaseJob, or remove it`,
        `Validator flag-check of module loose-rules sets timeoutMs to true. Set it above 0 and at most ${limit}, the limit of dispatch.releaseJob, or remove it`,
      ]),
    );
  });
});
