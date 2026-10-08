// SPDX-License-Identifier: AGPL-3.0-or-later
// Fixture modules whose validators the host refuses at boot (ADR 0037): hold-rules validates a
// command that dispatch does not declare validatable, stray-rules validates dispatch.releaseJob
// without depending on dispatch, patient-rules gives its validators time limits that the host
// does not allow, and loose-rules gives its validators time limits that are not numbers.
import { Module } from '@nestjs/common';
import { defineCommandContract } from '@northmes/contracts';
import { defineModule } from '@northmes/sdk';
import { CommandValidator } from '@northmes/sdk/commands';
import { z } from 'zod';
import { releaseJob } from './dispatch.ts';

/**
 * hold-rules' copy of a dispatch contract that says the command is validatable. dispatch's
 * manifest does not declare it so.
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

export const holdRules = defineModule({
  id: 'hold-rules',
  version: '0.0.0',
  northmes: '>=0.0.0-0 <0.1.0-0',
  dependsOn: ['dispatch'],
  server: async () => ({ default: HoldRulesModule }),
});

export const QuantityCap = CommandValidator(releaseJob, {
  name: 'quantity-cap',
  async check() {
    return { verdict: 'pass' };
  },
});

@Module({ providers: [QuantityCap] })
export class StrayRulesModule {}

/** Validates a command of dispatch, but does not depend on dispatch. */
export const strayRules = defineModule({
  id: 'stray-rules',
  version: '0.0.0',
  northmes: '>=0.0.0-0 <0.1.0-0',
  server: async () => ({ default: StrayRulesModule }),
});

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
export const patientRules = defineModule({
  id: 'patient-rules',
  version: '0.0.0',
  northmes: '>=0.0.0-0 <0.1.0-0',
  dependsOn: ['dispatch'],
  server: async () => ({ default: PatientRulesModule }),
});

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
export const looseRules = defineModule({
  id: 'loose-rules',
  version: '0.0.0',
  northmes: '>=0.0.0-0 <0.1.0-0',
  dependsOn: ['dispatch'],
  server: async () => ({ default: LooseRulesModule }),
});
