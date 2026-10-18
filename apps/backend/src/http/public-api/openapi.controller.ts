// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { randomUUID } from 'node:crypto';
import { Controller, Get, Inject, Req, Res, type Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { apiPath } from '@northmes/contracts';
import { PROBLEM_CONTENT_TYPE, problemOf } from '@northmes/sdk/rest';
import type { Request, Response } from 'express';
import { documentJson, openApiDocument } from '../../openapi/document.ts';
import { type Principal, PrincipalResolver, Public } from '../../principal.ts';
import { imageVersion } from '../../version.ts';
import { PublicApiCredentials } from './public-api-credentials.ts';

/** The token under which PublicApiModule provides the public controllers it built. */
export const PUBLIC_API_CONTROLLERS = Symbol('PUBLIC_API_CONTROLLERS');

/** The headers of an Express request as fetch Headers. */
function headersOf(request: Request): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    for (const one of [value ?? []].flat()) headers.append(name, one);
  }
  return headers;
}

/**
 * Serves the installation's OpenAPI document at GET /api/v1/openapi.json (ADR 0064, ADR 0073): the
 * public routes of every module and plugin the process loads, with info.version the image version,
 * built once on the first request. It answers the web's JWT and every credential the public REST
 * family accepts, and an anonymous request, or one whose bearer is neither, gets 401
 * core.unauthenticated as application/problem+json, as GraphQL refuses anonymous introspection.
 * The route is marked Public only so that the web's guard leaves the decision to it; it checks
 * both credentials itself. It reads nothing but the document and writes nothing.
 */
@Controller()
export class OpenApiController {
  #json: string | undefined;

  constructor(
    @Inject(PUBLIC_API_CONTROLLERS) private readonly controllers: readonly Type[],
    @Inject(PublicApiCredentials) private readonly credentials: PublicApiCredentials,
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef,
  ) {}

  @Get(apiPath('openapi.json'))
  @Public()
  async document(@Req() request: Request, @Res() response: Response): Promise<void> {
    const principal = await this.#principalOf(headersOf(request));
    if (!principal) {
      const problem = problemOf(
        {
          status: 401,
          code: 'core.unauthenticated',
          message: 'Send the web session or a credential of the public API to read the document',
          correlationId: randomUUID(),
        },
        apiPath('openapi.json'),
      );
      response.status(401).type(`${PROBLEM_CONTENT_TYPE}; charset=utf-8`);
      response.end(JSON.stringify(problem));
      return;
    }
    this.#json ??= documentJson(openApiDocument(this.controllers, { version: imageVersion() }));
    response.status(200).type('application/json; charset=utf-8').end(this.#json);
  }

  /**
   * The principal of a credential of the public API, else of the web's JWT through core's
   * PrincipalResolver, else null. A plant is never named, so a credential acts at its company. A
   * credential that fails to resolve, such as a token whose plant is gone, counts as none.
   */
  async #principalOf(headers: Headers): Promise<Principal | null> {
    try {
      const integration = await this.credentials.resolve({ headers, plant: undefined });
      if (integration) return integration;
      return (await this.#webResolver()?.resolve(headers)) ?? null;
    } catch {
      return null;
    }
  }

  /** The core module's PrincipalResolver, or undefined in an app without core. */
  #webResolver(): PrincipalResolver | undefined {
    try {
      return this.moduleRef.get(PrincipalResolver, { strict: false });
    } catch {
      return undefined;
    }
  }
}
