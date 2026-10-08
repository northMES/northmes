// SPDX-License-Identifier: AGPL-3.0-or-later
// Fixture module dispatch: owns the validatable command dispatch.releaseJob, which other modules
// may veto. Its handler writes nothing.
import { Module } from '@nestjs/common';
import { Field, ID, ObjectType, Query, Resolver } from '@nestjs/graphql';
import { defineCommandContract } from '@northmes/contracts';
import { defineModule } from '@northmes/sdk';
import { defineCommand } from '@northmes/sdk/commands';
import { z } from 'zod';

/** The contract, as the module's MIT contracts package would declare it. */
export const releaseJob = defineCommandContract({
  name: 'dispatch.releaseJob',
  target: 'existing',
  fields: z.object({}),
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

export const ReleaseJob = defineCommand(releaseJob, {
  returns: () => Job,
  async buildPayload({ id }) {
    return { jobId: id, quantity: 1500 };
  },
  async handle({ id }) {
    return { id, status: 'released' };
  },
});

@Module({ providers: [JobResolver, ReleaseJob] })
export class DispatchModule {}

export const dispatch = defineModule({
  id: 'dispatch',
  version: '0.0.0',
  northmes: '>=0.0.0-0 <0.1.0-0',
  commands: { 'dispatch.releaseJob': { validatable: true } },
  server: async () => ({ default: DispatchModule }),
});
