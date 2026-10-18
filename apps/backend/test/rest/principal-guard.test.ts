// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { type ExecutionContext, Post, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiController, PublicApiOperation } from '@northmes/sdk/rest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { PrincipalGuard } from '../../src/modules/core/api/access/principal.guard.ts';
import type { PrincipalResolver } from '../../src/principal.ts';

// A hand-written controller that copies the marks of a route toRestRoutes builds: the public family
// of ApiController and PublicApiOperation on its handler.
@ApiController({ module: 'core', family: 'public' })
class HandWrittenPublicController {
  @Post('commands/do-something')
  @PublicApiOperation({
    operationId: 'coreDoSomething',
    operation: 'core.doSomething',
    permission: 'core.article:create',
    method: 'POST',
    path: '/api/v1/core/commands/do-something',
    status: 200,
    tag: 'core',
    input: z.object({}),
    output: z.object({}),
    problems: [400, 401, 403, 429],
  })
  doSomething(): void {}
}

/** An HTTP execution context of the hand-written handler, with no credential on the request. */
function contextOf(): ExecutionContext {
  return {
    getHandler: () => HandWrittenPublicController.prototype.doSomething,
    getClass: () => HandWrittenPublicController,
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
  } as unknown as ExecutionContext;
}

describe('PrincipalGuard', () => {
  it('ADR0073-W4 a hand-written public controller with PublicApiOperation still needs the web credential', async () => {
    const resolver = { resolve: async () => null } as unknown as PrincipalResolver;
    const guard = new PrincipalGuard(new Reflector(), resolver);

    await expect(guard.canActivate(contextOf())).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
