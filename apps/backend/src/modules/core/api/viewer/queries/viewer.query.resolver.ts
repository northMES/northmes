// SPDX-License-Identifier: AGPL-3.0-or-later
import { Args, Query, Resolver } from '@nestjs/graphql';
import { PlantFree } from '@northmes/sdk/graphql';
import { type ViewerRecord, viewerAt } from '../../../core/access/viewer.ts';
import { companyIdArg } from '../../company/inputs/company-id.arg.ts';
import { Viewer } from '../types/viewer.type.ts';

/** core's query on the signed-in user. */
@Resolver(() => Viewer)
export class ViewerQueryResolver {
  /**
   * The signed-in user and what they hold at the request's plant and at its company, so the web
   * shows only the actions they can take. It needs no permission. Company settings send it without
   * a plant and with the company's id, and get what the user holds at the company (ADR 0066).
   */
  @Query(() => Viewer)
  @PlantFree()
  coreViewer(@Args('companyId', companyIdArg) companyId?: string | null): ViewerRecord {
    return viewerAt(companyId ?? undefined);
  }
}
