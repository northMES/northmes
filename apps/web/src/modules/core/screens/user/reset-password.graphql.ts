// SPDX-License-Identifier: AGPL-3.0-or-later
import { gql } from '@apollo/client';

export {
  CoreResetPasswordDocument as CoreResetPassword,
  type CoreResetPasswordMutation,
  type CoreResetPasswordMutationVariables,
} from './reset-password.graphql.gen.ts';

// Gives a user of the company a new temporary password, which the answer holds once. pnpm gen
// writes its typed document to reset-password.graphql.gen.ts; this block never runs.
if (false) {
  gql`
    mutation CoreResetPassword($input: CoreResetPasswordInput!) {
      coreResetPassword(input: $input) {
        user {
          id
          blocked
        }
        temporaryPassword
      }
    }
  `;
}
