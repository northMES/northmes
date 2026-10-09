// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from '@nestjs/common';
import { ViewerQueryResolver } from './queries/viewer.query.resolver.ts';

/** core's GraphQL surface for the signed-in user. */
@Module({ providers: [ViewerQueryResolver] })
export class ViewerModule {}
