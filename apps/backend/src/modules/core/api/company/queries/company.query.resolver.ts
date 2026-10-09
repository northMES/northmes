// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
import { type CompanyRecord, CompanyService } from '../../../core/company.service.ts';
import { Company } from '../types/company.type.ts';

/** core's queries on Company. */
@Resolver(() => Company)
export class CompanyQueryResolver {
  constructor(@Inject(CompanyService) private readonly companies: CompanyService) {}

  /**
   * The companies where the signed-in user holds a role, sorted by name, each with the plants the
   * user may open (ADR 0066). The answer is the same at every plant and without x-northmes-plant.
   */
  @Query(() => [Company])
  coreCompanies(): Promise<CompanyRecord[]> {
    return this.companies.companies();
  }
}
