// SPDX-License-Identifier: AGPL-3.0-or-later
import { Body, Controller, Headers, HttpCode, HttpStatus, Inject, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { Public } from '../../../../principal.ts';
import { AuthService, type NewPasswordRefusal } from '../../core/access/auth.service.ts';

/** The route of the new password step, outside Better Auth's /api/auth. */
export const NEW_PASSWORD_PATH = '/api/account/password';

/** The bearer token of an Authorization header. */
const bearer = /^Bearer\s+(\S+)$/i;

/** The body of the route: the temporary password the user signed in with, and the new one. */
const newPasswordBody = z.object({
  currentPassword: z.string(),
  newPassword: z.string(),
});

/** The status and message of each refusal, which the web words by its code. */
const refusals: Readonly<Record<NewPasswordRefusal, { status: number; message: string }>> = {
  'core.current_password_wrong': {
    status: HttpStatus.BAD_REQUEST,
    message: 'The temporary password is wrong. Sign in again.',
  },
  'core.password_too_short': {
    status: HttpStatus.BAD_REQUEST,
    message: 'Use at least 8 characters.',
  },
  'core.password_too_long': {
    status: HttpStatus.BAD_REQUEST,
    message: 'Use at most 128 characters.',
  },
  'core.password_unchanged': {
    status: HttpStatus.BAD_REQUEST,
    message: 'Choose a password other than the temporary one.',
  },
  'core.password_change_not_required': {
    status: HttpStatus.CONFLICT,
    message: 'Your password is not temporary. Nothing changed.',
  },
};

/**
 * The new password step (ADR 0051 rule 13, D2 SI16 to SI18, issue #416): a user who signed in with
 * a temporary password sets their own here, with the temporary one as currentPassword, and every
 * other request is refused with core.password_change_required until they have. The principal
 * refuses such a user, so the route is Public and checks the JWT itself: without a valid one it
 * answers 401. A refusal answers its status with { errorCode, message }; a saved password answers
 * 200 with { ok: true }.
 */
@Public()
@Controller()
export class NewPasswordController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post(NEW_PASSWORD_PATH)
  @HttpCode(HttpStatus.OK)
  async setNewPassword(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ ok: true } | { errorCode: string; message: string }> {
    const token = bearer.exec(authorization ?? '')?.[1];
    const caller = token ? await this.auth.sessionOfToken(token) : null;
    if (!caller) {
      response.status(HttpStatus.UNAUTHORIZED);
      return { errorCode: 'core.unauthenticated', message: 'Sign in to use the API' };
    }
    const parsed = newPasswordBody.safeParse(body);
    if (!parsed.success) {
      response.status(HttpStatus.BAD_REQUEST);
      return { errorCode: 'core.invalid_input', message: 'Send currentPassword and newPassword.' };
    }
    const { currentPassword, newPassword } = parsed.data;
    const refusal = await this.auth.setNewPassword(caller, currentPassword, newPassword);
    if (refusal === undefined) return { ok: true };
    response.status(refusals[refusal].status);
    return { errorCode: refusal, message: refusals[refusal].message };
  }
}
