// SPDX-License-Identifier: AGPL-3.0-or-later
// Fixture modules release-limits and audit-rules: each vetoes every dispatch.releaseJob.
import { Module } from '@nestjs/common';
import { CommandValidator } from '@northmes/sdk/commands';
import type { InRepoModule } from '../../../src/modules.ts';
import { releaseJob } from './dispatch.ts';

export const QuantityLimit = CommandValidator(releaseJob, {
  name: 'quantity-limit',
  async check({ quantity }) {
    return { verdict: 'veto', message: `Quantity ${quantity} is above the release limit of 1000` };
  },
});

@Module({ providers: [QuantityLimit] })
export class ReleaseLimitsModule {}

export const releaseLimits: InRepoModule = {
  id: 'release-limits',
  dependsOn: ['dispatch'],
  module: ReleaseLimitsModule,
};

export const JobAudit = CommandValidator(releaseJob, {
  name: 'job-audit',
  async check() {
    return { verdict: 'veto', message: 'Jobs are not released during the audit' };
  },
});

@Module({ providers: [JobAudit] })
export class AuditRulesModule {}

/** Depends on release-limits, so the catalog boots it after release-limits. */
export const auditRules: InRepoModule = {
  id: 'audit-rules',
  dependsOn: ['dispatch', 'release-limits'],
  module: AuditRulesModule,
};
