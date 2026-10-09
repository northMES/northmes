// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from '@nestjs/common';
import { ArticleServiceModule } from '../../../core/public-api.ts';
import { ProductionOrderServiceModule } from '../../core/production-order-service.module.ts';
import { ProductionOrderFieldResolver } from './fields/production-order.field.resolver.ts';
import { ReleaseProductionOrder } from './mutations/release-production-order.mutation.ts';
import { ProductionOrderQueryResolver } from './queries/production-order.query.resolver.ts';

/**
 * planning's GraphQL surface for ProductionOrder: its query, its article field, which reads core's
 * ArticleService, and the mutation of its command.
 */
@Module({
  imports: [ProductionOrderServiceModule, ArticleServiceModule],
  providers: [ProductionOrderQueryResolver, ProductionOrderFieldResolver, ReleaseProductionOrder],
})
export class ProductionOrderModule {}
