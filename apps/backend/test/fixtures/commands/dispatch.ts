// SPDX-License-Identifier: AGPL-3.0-or-later
// Fixture module dispatch: owns the validatable command dispatch.releaseJob, which other modules
// may veto, and dispatch.holdJob, which they may not. Its handlers write nothing.
import { Module } from '@nestjs/common';
import { Field, ID, ObjectType, Query, Resolver } from '@nestjs/graphql';
import { defineCommandContract } from '@northmes/contracts';
import { defineCommand } from '@northmes/sdk/commands';
import { z } from 'zod';
import type { InRepoModule } from '../../../src/modules.ts';

/** The contract, as the module's MIT contracts package would declare it. */
export const releaseJob = defineCommandContract({
  name: 'dispatch.releaseJob',
  target: 'existing',
  fields: z.object({}),
  permission: 'dispatch.job:release',
  validatable: true,
  payload: z.object({ jobId: z.uuid(), quantity: z.number() }),
});

@ObjectType('Job', { registerIn: () => DispatchModule })
export class Job {
  @Field(() => ID) id!: string;
  @Field(() => String) status!: string;
}

/** The module's own reads, which give the schema a Query root. */
@Resolver(() => Job)
export class JobResolver {
  @Query(() => [Job])
  dispatchJobs(): Job[] {
    return [];
  }
}

/** A job with `id` at version 1, at the plant the request names. */
async function jobAtPlant(id: string, { plantId }: { readonly plantId: string | undefined }) {
  return { id, version: 1, scope_id: plantId ?? '' };
}

/** Every job is at the plant the request names, where a job command runs. */
const jobTarget = {
  entity: 'Job',
  scopeOf: async (_id: string, { plantId }: { readonly plantId: string | undefined }) => plantId,
  load: jobAtPlant,
};

export const ReleaseJob = defineCommand(releaseJob, {
  returns: () => Job,
  // The fixture reads no table: every job it is asked for exists at version 1, at the request's
  // plant.
  target: jobTarget,
  async buildPayload({ id }) {
    return { jobId: id, quantity: 1500 };
  },
  async handle({ id }) {
    return { id, status: 'released' };
  },
});

/** A command whose contract is not validatable, so no validator may be on it. */
export const holdJob = defineCommandContract({
  name: 'dispatch.holdJob',
  target: 'existing',
  fields: z.object({}),
  permission: 'dispatch.job:hold',
});

export const HoldJob = defineCommand(holdJob, {
  returns: () => Job,
  target: jobTarget,
  async handle({ id }) {
    return { id, status: 'held' };
  },
});

@Module({ providers: [JobResolver, ReleaseJob, HoldJob] })
export class DispatchModule {}

export const dispatch: InRepoModule = {
  id: 'dispatch',
  module: DispatchModule,
  permissions: { 'dispatch.job': ['release', 'hold'] },
};
