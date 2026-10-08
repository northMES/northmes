// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { BootError } from '../../src/boot/boot-error.ts';
import { DEFAULT_VALIDATOR_TIMEOUT_MS } from '../../src/commands/command-bus.ts';
import { discoverValidators } from '../../src/commands/discover-validators.ts';
import { dispatch, JobResolver, ReleaseJob } from '../fixtures/commands/dispatch.ts';
import {
  HoldCheck,
  holdRules,
  InstantCheck,
  PatientCheck,
  patientRules,
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

  it('E02-S04 a validator listed as a class provider with useClass is checked like the plain class', () => {
    const discover = () =>
      discoverValidators(
        [dispatch, strayRules],
        [
          { module: 'dispatch', providers: [JobResolver, ReleaseJob] },
          {
            module: 'stray-rules',
            providers: [{ provide: 'quantity-cap', useClass: QuantityCap }],
          },
        ],
      );

    expect(discover).toThrow(
      new BootError([
        'Validator quantity-cap of module stray-rules is on dispatch.releaseJob of module dispatch, which is not in the dependsOn of stray-rules',
      ]),
    );
  });

  it("E02-S04 a validator whose timeoutMs is 0 or longer than the host's limit stops boot", () => {
    const discover = () =>
      discoverValidators(
        [dispatch, patientRules],
        [
          { module: 'dispatch', providers: [JobResolver, ReleaseJob] },
          { module: 'patient-rules', providers: [PatientCheck, InstantCheck] },
        ],
      );

    // Owners declare no limit per command yet, so the host's default limit is the longest allowed.
    const limit = DEFAULT_VALIDATOR_TIMEOUT_MS;
    expect(discover).toThrow(
      new BootError([
        `Validator patient-check of module patient-rules sets timeoutMs to 60000. Set it above 0 and at most ${limit}, the limit of dispatch.releaseJob, or remove it`,
        `Validator instant-check of module patient-rules sets timeoutMs to 0. Set it above 0 and at most ${limit}, the limit of dispatch.releaseJob, or remove it`,
      ]),
    );
  });
});
