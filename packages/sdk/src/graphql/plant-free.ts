// SPDX-License-Identifier: MIT
import { Extensions } from '@nestjs/graphql';

/**
 * The key of the field extension that marks a root field plant-free (ADR 0066). The host serves an
 * operation without x-northmes-plant only when every root field in it carries it.
 */
export const PLANT_FREE = 'northmesPlantFree';

/**
 * Marks a Query or Mutation field plant-free: it takes a company id, or reads only the companies
 * where the principal's check passed, so an operation from company settings may select it without
 * x-northmes-plant (ADR 0066). Only core declares plant-free fields in release 1.
 */
export function PlantFree(): MethodDecorator {
  return Extensions({ [PLANT_FREE]: true });
}
