// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MockLink } from '@apollo/client/testing';
import { CoreBlockUser } from '../../../src/modules/core/screens/user/block-user.graphql.ts';
import { CoreResetPassword } from '../../../src/modules/core/screens/user/reset-password.graphql.ts';
import { CoreUnblockUser } from '../../../src/modules/core/screens/user/unblock-user.graphql.ts';
import { companyId } from './access-fixtures.ts';

/** What a company admin holds to read, block and reset users at the company. */
export const userAdmin = [
  'core.user:read',
  'core.role:read',
  'core.user:block',
  'core.user:resetPassword',
];

/** A fictional temporary password, as the API would make one. */
export const temporaryPassword = 'Rk7qTm3vXp9wHn4cLs2d';

/** coreResetPassword of the user, with the reason when one is typed. */
export function resetPasswordMutation(
  of: { readonly id: string },
  reason?: string,
): MockLink.MockedResponse {
  return {
    request: {
      query: CoreResetPassword,
      variables: { input: { id: of.id, companyId, ...(reason !== undefined && { reason }) } },
    },
    result: {
      data: {
        coreResetPassword: {
          __typename: 'PasswordReset',
          temporaryPassword,
          user: { __typename: 'User', id: of.id, blocked: false },
        },
      },
    },
  };
}

/** coreBlockUser of the user, without a reason. */
export function blockMutation(of: { readonly id: string }): MockLink.MockedResponse {
  return {
    request: { query: CoreBlockUser, variables: { input: { id: of.id, companyId } } },
    result: { data: { coreBlockUser: { __typename: 'User', id: of.id, blocked: true } } },
  };
}

/** coreUnblockUser of the user, without a reason. */
export function unblockMutation(of: { readonly id: string }): MockLink.MockedResponse {
  return {
    request: { query: CoreUnblockUser, variables: { input: { id: of.id, companyId } } },
    result: { data: { coreUnblockUser: { __typename: 'User', id: of.id, blocked: false } } },
  };
}
