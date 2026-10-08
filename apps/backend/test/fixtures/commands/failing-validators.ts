// SPDX-License-Identifier: AGPL-3.0-or-later
// Validators of dispatch.releaseJob that fail instead of answering in time: SlowCheck answers after
// its time limit, and BrokenCheck of the fixture module broken-rules throws on every run.
import { Module } from '@nestjs/common';
import { defineModule } from '@northmes/sdk';
import { CommandValidator } from '@northmes/sdk/commands';
import { releaseJob } from './dispatch.ts';

/** The time limit of SlowCheck. */
export const SLOW_CHECK_LIMIT_MS = 50;

/** How long SlowCheck takes to answer pass, far past its limit. */
export const SLOW_CHECK_ANSWERS_AFTER_MS = 5_000;

export const SlowCheck = CommandValidator(releaseJob, {
  name: 'slow-check',
  timeoutMs: SLOW_CHECK_LIMIT_MS,
  async check() {
    await new Promise((resolve) => setTimeout(resolve, SLOW_CHECK_ANSWERS_AFTER_MS));
    return { verdict: 'pass' };
  },
});

/** The text of the error that BrokenCheck throws, which the client must never read. */
export const BROKEN_CHECK_ERROR = 'relation "broken_rules.limit" does not exist';

export const BrokenCheck = CommandValidator(releaseJob, {
  name: 'broken-check',
  async check() {
    throw new Error(BROKEN_CHECK_ERROR);
  },
});

@Module({ providers: [BrokenCheck] })
export class BrokenRulesModule {}

export const brokenRules = defineModule({
  id: 'broken-rules',
  version: '0.0.0',
  northmes: '>=0.0.0-0 <0.1.0-0',
  dependsOn: ['dispatch'],
  server: async () => ({ default: BrokenRulesModule }),
});
