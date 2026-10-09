// SPDX-License-Identifier: AGPL-3.0-or-later
// Fixture modules whose validators the host refuses at boot (ADR 0037): hold-rules validates a
// command whose contract dispatch does not make validatable, stray-rules validates dispatch.releaseJob
// without depending on dispatch, patient-rules gives its validators time limits that the host
// does not allow, and loose-rules gives its validators time limits that are not numbers.
import { Module } from '@nestjs/common';
import { defineCommandContract } from '@northmes/contracts';
import { CommandValidator } from '@northmes/sdk/commands';
import { z } from 'zod';
import { releaseJob } from './dispatch.ts';
import type { InRepoModule } from '../../../src/modules.ts';

/**
 * hold-rules' copy of a dispatch contract that says the command is validatable. The contract that
 * dispatch's command is defined with does not.
 */
const holdJob = defineCommandContract({
  name: 'dispatch.holdJob',
  target: 'existing',
  fields: z.object({}),
  validatable: true,
  payload: z.object({ jobId: z.uuid() }),
});

export const HoldCheck = CommandValidator(holdJob, {
  name: 'hold-check',
  async check() {
    return { verdict: 'pass' };
  },
});

@Module({ providers: [HoldCheck] })
export class HoldRulesModule {}

export const holdRules: InRepoModule = {
  id: 'hold-rules',
  dependsOn: ['dispatch'],
  module: HoldRulesModule,
};

export const QuantityCap = CommandValidator(releaseJob, {
  name: 'quantity-cap',
  async check() {
    return { verdict: 'pass' };
  },
});

@Module({ providers: [QuantityCap] })
export class StrayRulesModule {}

/** Validates a command of dispatch, but does not depend on dispatch. */
export const strayRules: InRepoModule = {
  id: 'stray-rules',
  module: StrayRulesModule,
};

export const PatientCheck = CommandValidator(releaseJob, {
  name: 'patient-check',
  timeoutMs: 60_000,
  async check() {
    return { verdict: 'pass' };
  },
});

export const InstantCheck = CommandValidator(releaseJob, {
  name: 'instant-check',
  timeoutMs: 0,
  async check() {
    return { verdict: 'pass' };
  },
});

@Module({ providers: [PatientCheck, InstantCheck] })
export class PatientRulesModule {}

/** Depends on dispatch, but one validator's limit is longer than the host allows, one's is 0. */
export const patientRules: InRepoModule = {
  id: 'patient-rules',
  dependsOn: ['dispatch'],
  module: PatientRulesModule,
};

// A plugin is plain JavaScript, so nothing but boot stops a time limit that is not a number.
export const TextCheck = CommandValidator(releaseJob, {
  name: 'text-check',
  timeoutMs: '500' as unknown as number,
  async check() {
    return { verdict: 'pass' };
  },
});

export const FlagCheck = CommandValidator(releaseJob, {
  name: 'flag-check',
  timeoutMs: true as unknown as number,
  async check() {
    return { verdict: 'pass' };
  },
});

@Module({ providers: [TextCheck, FlagCheck] })
export class LooseRulesModule {}

/** Depends on dispatch, but its validators set timeoutMs to a string and to a boolean. */
export const looseRules: InRepoModule = {
  id: 'loose-rules',
  dependsOn: ['dispatch'],
  module: LooseRulesModule,
};
