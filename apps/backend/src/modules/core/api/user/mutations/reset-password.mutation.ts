// SPDX-License-Identifier: AGPL-3.0-or-later
import { resetPassword } from '@northmes/core-contracts';
import { defineCommand } from '@northmes/sdk/commands';
import { resetPasswordHandler } from '../../../core/commands/reset-password.handler.ts';
import { PasswordReset } from '../types/password-reset.type.ts';

/**
 * The mutation coreResetPassword, which the SDK generates from the contract of core.resetPassword
 * and which returns the user that resetPasswordHandler reset, with the temporary password.
 */
export const ResetPassword = defineCommand(resetPassword, {
  returns: () => PasswordReset,
  plantFree: true,
  ...resetPasswordHandler,
});
