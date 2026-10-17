// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import {
  API_CONTROLLER_METADATA,
  type ApiControllerOptions,
  isBuiltByToRestRoutes,
  PUBLIC_API_OPERATION_METADATA,
} from '@northmes/sdk/rest';
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
 * Whether the handler is a route that toRestRoutes built in the public family: toRestRoutes built
 * its controller, a public ApiController, and the handler carries PublicApiOperation. Such a route
 * hands every call to the host's PublicOperationRunner, which resolves the principal through
 * PublicApiCredentials. A hand-written public controller is no such route, even with the same
 * metadata, so it keeps this guard and fails closed.
 */
function isPublicApiRoute(reflector: Reflector, context: ExecutionContext): boolean {
  const target = context.getClass();
  if (!isBuiltByToRestRoutes(target)) return false;
  const controller = reflector.get<ApiControllerOptions | undefined>(
    API_CONTROLLER_METADATA,
    target,
  );
  const operation: unknown = reflector.get(PUBLIC_API_OPERATION_METADATA, context.getHandler());
  return controller?.family === 'public' && operation !== undefined;
}

/**
 * The guard on every route and every GraphQL field (ADR 0010, ADR 0011): a handler or controller
 * marked Public passes, and so does a route of the public REST family that toRestRoutes built,
 * which takes no web credential and resolves its principal through its own credential guard,
 * PublicApiCredentials (ADR 0073); any other needs a principal, or the request fails with 401
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
    if (isPublicApiRoute(this.reflector, context)) return true;
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
