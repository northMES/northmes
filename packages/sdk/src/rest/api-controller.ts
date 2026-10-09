// SPDX-License-Identifier: MIT
import { applyDecorators, Controller, SetMetadata } from '@nestjs/common';
import { API_MAJOR } from '@northmes/contracts';

/** The metadata key under which ApiController records a controller's module and family. */
export const API_CONTROLLER_METADATA = 'northmes:api-controller';

/**
 * The route family of a controller (ADR 0064). First-party routes serve the web app and the
 * stations from the same image and carry no compatibility promise; public routes are the
 * integration API for outside systems.
 */
export type ApiFamily = 'first-party' | 'public';

export interface ApiControllerOptions {
  /** The first path segment after the version: a module id, or a host segment such as web. */
  readonly module: string;
  readonly family: ApiFamily;
}

/**
 * Declares a REST controller under api/v<API_MAJOR>/<module>, the major the shell's apiPath uses.
 * The handler decorators add the rest of the path. The boot route check reads the module and the
 * family back from API_CONTROLLER_METADATA.
 */
export function ApiController({ module, family }: ApiControllerOptions): ClassDecorator {
  const metadata: ApiControllerOptions = { module, family };
  return applyDecorators(
    Controller(`api/v${API_MAJOR}/${module}`),
    SetMetadata(API_CONTROLLER_METADATA, metadata),
  );
}
