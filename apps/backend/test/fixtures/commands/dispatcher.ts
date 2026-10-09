// SPDX-License-Identifier: AGPL-3.0-or-later
// Fixture module dispatcher: in an app of fixture modules, which has no core module to sign users
// in, it resolves every request that names a plant to a dispatcher who releases and holds
// dispatch's jobs at that plant, so the command bus lets the request run dispatch's commands.
import { Injectable, Module } from '@nestjs/common';
import type { InRepoModule } from '../../../src/modules.ts';
import { PLANT_HEADER, type Principal, PrincipalResolver } from '../../../src/principal.ts';

/** The user id of the dispatcher. */
export const DISPATCHER_ID = '019a0000-0000-7000-8000-0000000000d1';

@Injectable()
class DispatcherResolver extends PrincipalResolver {
  async resolve(headers: Headers): Promise<Principal | null> {
    const plant = headers.get(PLANT_HEADER);
    if (!plant) return null;
    const permissions = ['dispatch.job:release', 'dispatch.job:hold'];
    return {
      userId: DISPATCHER_ID,
      plantId: plant,
      readScopes: [plant],
      writeScopes: [plant],
      scopes: new Map([[plant, { id: plant, parentId: null, permissions }]]),
    };
  }
}

@Module({ providers: [{ provide: PrincipalResolver, useClass: DispatcherResolver }] })
export class DispatcherModule {}

export const dispatcher: InRepoModule = {
  id: 'dispatcher',
  module: DispatcherModule,
};
