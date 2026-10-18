// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { printSchema } from 'graphql';
import { withInRepoApp } from '../boot/in-repo-app.ts';

/**
 * The SDL of the one schema that the in-repo modules build, with its types in name order: what
 * pnpm gen writes to schema/api.graphql (ADR 0070). It builds the app without a database, an
 * environment or a plugin, through withInRepoApp.
 */
export async function schemaSdl(): Promise<string> {
  return withInRepoApp(async (app) => `${printSchema(app.get(GraphQLSchemaHost).schema)}\n`);
}
