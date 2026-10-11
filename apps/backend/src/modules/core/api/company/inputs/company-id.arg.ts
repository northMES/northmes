// SPDX-License-Identifier: AGPL-3.0-or-later
import { ID } from '@nestjs/graphql';

/**
 * The companyId argument of a plant-free field (ADR 0066): company settings send it without
 * x-northmes-plant. A request at a plant may leave it out, or must name the plant's company.
 */
export const companyIdArg = {
  type: () => ID,
  nullable: true,
  description:
    "The company of a request from company settings, which names no plant. At a plant it may be left out, or must be the plant's company.",
} as const;
