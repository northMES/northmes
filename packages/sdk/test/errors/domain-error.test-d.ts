// SPDX-License-Identifier: MIT
import { HttpStatus } from '@nestjs/common';
import { DomainError } from '@northmes/sdk/errors';
import { describe, it } from 'vitest';

describe('DomainError', () => {
  it('E05-S01 a DomainError takes only the statuses the exception filter maps to a GraphQL code', () => {
    new DomainError({ code: 'core.code_taken', status: HttpStatus.CONFLICT, message: 'Taken.' });
    new DomainError({ code: 'core.version_conflict', status: 409, message: 'Changed.' });

    new DomainError({
      code: 'core.broken',
      // @ts-expect-error a 500 reaches the client masked, without its code and details
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Broken.',
    });
    new DomainError({
      code: 'core.unprocessable',
      // @ts-expect-error 422 has no GraphQL code in the filter
      status: 422,
      message: 'Unprocessable.',
    });
  });
});
