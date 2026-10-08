// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from '@nestjs/common';
import { WebModulesController } from './web-modules.controller.ts';

/** Serves the web module list (ADR 0019). */
@Module({ controllers: [WebModulesController] })
export class WebModule {}
