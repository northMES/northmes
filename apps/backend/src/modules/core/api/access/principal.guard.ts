// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import type { Request } from 'express';
import { IS_PUBLIC, type Principal, PrincipalResolver } from '../../../../principal.ts';

/** An HTTP request after the guard let it through. */
export interface RequestWithPrincipal extends Request {
  principal?: Principal;
}

/** The headers of an Express request as fetch Headers, which the resolver reads. */
function headersOf(request: Request): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    for (const one of [value ?? []].flat()) headers.append(name, one);
  }
  return headers;
}

/**
 * The guard on every route and every GraphQL field (ADR 0010, ADR 0011): a handler or controller
 * marked Public passes; any other needs a principal, or the request fails with 401
 * (UNAUTHENTICATED in GraphQL). For GraphQL the server resolved the principal once when it built
 * the request's context; for an HTTP route the guard builds it from the bearer token and puts it
 * on the request.
 */
@Injectable()
export class PrincipalGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PrincipalResolver) private readonly resolver: PrincipalResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    if (context.getType<GqlContextType>() === 'graphql') {
      const { principal } = GqlExecutionContext.create(context).getContext<{
        principal?: Principal | null;
      }>();
      if (!principal) throw new UnauthorizedException('Sign in to use the API');
      return true;
    }
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    const principal = await this.resolver.resolve(headersOf(request));
    if (!principal) throw new UnauthorizedException('Sign in to use the API');
    request.principal = principal;
    return true;
  }
}
