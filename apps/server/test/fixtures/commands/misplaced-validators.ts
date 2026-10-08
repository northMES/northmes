// SPDX-License-Identifier: AGPL-3.0-or-later
// Fixture modules whose validators the host refuses at boot (ADR 0037): hold-rules validates a
// command that dispatch does not declare validatable, and stray-rules validates dispatch.releaseJob
// without depending on dispatch.
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
