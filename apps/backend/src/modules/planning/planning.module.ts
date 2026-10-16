// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Module } from '@nestjs/common';
import { ProductionOrderModule } from './api/production-order/production-order.module.ts';

/**
 * The planning module's Nest module, which AppModule imports after core's: one module per entity of
 * its GraphQL surface (ADR 0070).
 */
@Module({ imports: [ProductionOrderModule] })
export class PlanningModule {}
