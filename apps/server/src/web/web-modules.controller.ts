// SPDX-License-Identifier: AGPL-3.0-or-later
import { Get } from '@nestjs/common';
import { ApiController } from '@northmes/sdk/rest';

/** The web module list, which the shell loads its remotes from (ADR 0019). */
@ApiController({ module: 'web', family: 'first-party' })
export class WebModulesController {
  @Get('modules')
  list() {
    return { modules: [] };
  }
}
