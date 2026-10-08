// SPDX-License-Identifier: AGPL-3.0-or-later
import { type DynamicModule, Module } from '@nestjs/common';

/** The root module of the server. */
@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: Nest knows a module by its decorated class.
export class AppModule {
  /**
   * Imports config first: the ConfigModule that boot created before it imported any manifest
   * (ADR 0060).
   */
  static forRoot(config: DynamicModule): DynamicModule {
    return { module: AppModule, imports: [config] };
  }
}
