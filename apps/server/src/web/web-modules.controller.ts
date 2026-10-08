// SPDX-License-Identifier: AGPL-3.0-or-later
import { Get, Header, Inject } from '@nestjs/common';
import { ApiController } from '@northmes/sdk/rest';
import { GatewayService } from '../gateway/gateway.module.ts';
import { ServedWeb, type WebModuleEntry } from './served-web.ts';

/** The answer of GET /api/v1/web/modules. */
export interface WebModuleList {
  /** The NorthMES version of this build. */
  readonly northmes: string;
  /** The hash of the supergraph the gateway serves, or null while it serves none. */
  readonly supergraph: string | null;
  /** Each catalog module with a web block, in boot order. */
  readonly modules: readonly WebModuleEntry[];
}

/** The web module list, which the shell loads its remotes from (ADR 0019). */
@ApiController({ module: 'web', family: 'first-party' })
export class WebModulesController {
  constructor(
    @Inject(ServedWeb) private readonly web: ServedWeb,
    @Inject(GatewayService) private readonly gateway: GatewayService,
  ) {}

  @Get('modules')
  @Header('Cache-Control', 'no-store')
  list(): WebModuleList {
    return {
      northmes: this.web.northmes,
      supergraph: this.gateway.supergraphHash ?? null,
      modules: this.web.modules,
    };
  }
}
