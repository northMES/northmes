// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from '@nestjs/common';
import { UserService } from './user.service.ts';

/** Provides core's UserService: plain providers and no resolvers. */
@Module({ providers: [UserService], exports: [UserService] })
export class UserServiceModule {}
