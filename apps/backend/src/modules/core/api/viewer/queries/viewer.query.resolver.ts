// SPDX-License-Identifier: AGPL-3.0-or-later
import { Query, Resolver } from '@nestjs/graphql';
import { PlantFree } from '@northmes/sdk/graphql';
import { type ViewerRecord, viewerAtPlant } from '../../../core/access/viewer.ts';
import { Viewer } from '../types/viewer.type.ts';

/** core's query on the signed-in user. */
@Resolver(() => Viewer)
export class ViewerQueryResolver {
  /**
   * The signed-in user and what they hold at the request's plant and at its company, so the web
   * shows only the actions they can take. It needs a plant and no permission.
   */
  @Query(() => Viewer)
  @PlantFree()
  coreViewer(): ViewerRecord {
    return viewerAtPlant();
  }
}
