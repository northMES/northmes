// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Module } from '@nestjs/common';
import { AccessModule } from './access/access.module.ts';
import { AdministrationService } from './administration.service.ts';

/** Provides core's AdministrationService, which the CLI's company and admin commands call. */
@Module({
  imports: [AccessModule],
  providers: [AdministrationService],
  exports: [AdministrationService],
})
export class AdministrationServiceModule {}
