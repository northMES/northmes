// SPDX-License-Identifier: AGPL-3.0-or-later
// Fixture modules release-limits and audit-rules: each vetoes every dispatch.releaseJob.
import { Module } from '@nestjs/common';
import { defineModule } from '@northmes/sdk';
import { CommandValidator } from '@northmes/sdk/commands';
import { releaseJob } from './dispatch.ts';

export const QuantityLimit = CommandValidator(releaseJob, {
  name: 'quantity-limit',
  async check({ quantity }) {
    return { verdict: 'veto', message: `Quantity ${quantity} is above the release limit of 1000` };
  },
});

@Module({ providers: [QuantityLimit] })
export class ReleaseLimitsModule {}

export const releaseLimits = defineModule({
  id: 'release-limits',
  version: '0.0.0',
  northmes: '>=0.0.0-0 <0.1.0-0',
  dependsOn: ['dispatch'],
  server: async () => ({ default: ReleaseLimitsModule }),
});

export const JobAudit = CommandValidator(releaseJob, {
  name: 'job-audit',
  async check() {
    return { verdict: 'veto', message: 'Jobs are not released during the audit' };
  },
});

@Module({ providers: [JobAudit] })
export class AuditRulesModule {}

/** Depends on release-limits, so the catalog boots it after release-limits. */
export const auditRules = defineModule({
  id: 'audit-rules',
  version: '0.0.0',
  northmes: '>=0.0.0-0 <0.1.0-0',
  dependsOn: ['dispatch', 'release-limits'],
  server: async () => ({ default: AuditRulesModule }),
});
