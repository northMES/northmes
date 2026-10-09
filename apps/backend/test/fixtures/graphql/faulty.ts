// SPDX-License-Identifier: AGPL-3.0-or-later
// Fixture module faulty: each of its fields throws one kind of error, for the exception filter.
import {
  ForbiddenException,
  InternalServerErrorException,
  Module,
  NotFoundException,
} from '@nestjs/common';
import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { DomainError, type DomainErrorStatus } from '@northmes/sdk/errors';
import type { InRepoModule } from '../../../src/modules.ts';

/** The message that faultyServerError and faultyUnknown throw, which no client may read. */
export const UNKNOWN_ERROR_TEXT = 'connection to 10.0.0.7 refused for user nm_app';

@Resolver()
export class FaultyResolver {
  @Query(() => Boolean)
  faultyDomainError(@Args('status', { type: () => Int }) status: number): boolean {
    throw new DomainError({
      code: 'faulty.refused',
      // The tests also send statuses outside DomainErrorStatus, to see the filter mask them.
      status: status as DomainErrorStatus,
      message: `Refused with status ${status}`,
      details: { status },
    });
  }

  @Query(() => Boolean)
  faultyFieldErrors(): boolean {
    throw new DomainError({
      code: 'faulty.code_taken',
      status: 409,
      message: 'The code is already taken.',
      fieldErrors: [
        { path: ['code'], message: 'The code is already taken.', code: 'faulty.code_taken' },
      ],
    });
  }

  @Query(() => Boolean)
  faultyNotFound(): boolean {
    throw new NotFoundException('Thing t-9 was not found');
  }

  @Query(() => Boolean)
  faultyForbidden(): boolean {
    throw new ForbiddenException();
  }

  @Query(() => Boolean)
  faultyServerError(): boolean {
    throw new InternalServerErrorException(UNKNOWN_ERROR_TEXT);
  }

  @Query(() => Boolean)
  faultyUnknown(): boolean {
    throw new Error(UNKNOWN_ERROR_TEXT);
  }
}

@Module({ providers: [FaultyResolver] })
export class FaultyModule {}

export const faulty: InRepoModule = {
  id: 'faulty',
  module: FaultyModule,
};
