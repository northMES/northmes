// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Args, Query, Resolver } from '@nestjs/graphql';
import { PlantFree } from '@northmes/sdk/graphql';
import { type ViewerRecord, viewerAt } from '../../../core/access/viewer.ts';
import { companyIdArg } from '../../company/inputs/company-id.arg.ts';
import { Viewer } from '../types/viewer.type.ts';

/** core's query on the signed-in user. */
@Resolver(() => Viewer)
export class ViewerQueryResolver {
  @Query(() => Viewer, {
    description:
      "The signed-in user and what they hold at the request's plant and at its company, so a client shows only the actions they can take. Needs no permission. Without a plant, with companyId, it answers what the user holds at the company.",
  })
  @PlantFree()
  coreViewer(@Args('companyId', companyIdArg) companyId?: string | null): ViewerRecord {
    return viewerAt(companyId ?? undefined);
  }
}
