// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { INestApplication, Type } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import { API_MAJOR } from '@northmes/contracts';
import { withInRepoApp } from '../boot/in-repo-app.ts';
import { type OpenApiDocument, openApiDocument, sortedKeys } from './document.ts';

/** The controllers of every Nest module of the app. */
export function controllersOf(app: INestApplication): Type[] {
  return [...app.get(ModulesContainer).values()].flatMap((module) =>
    [...module.controllers.values()].map(({ metatype }) => metatype as Type),
  );
}

/** A document as JSON, with every key in name order and a final newline. */
export function documentJson(document: OpenApiDocument): string {
  return `${JSON.stringify(sortedKeys(document), null, 2)}\n`;
}

/**
 * The OpenAPI document of the in-repo modules' public routes, as JSON: what pnpm gen writes to
 * schema/openapi-v1.json and pnpm northmes openapi print writes to standard output (ADR 0064). It
 * builds the app without a database, an environment or a plugin, and sets info.version to the API
 * major, so a release never changes the file.
 */
export async function openApiJson(): Promise<string> {
  return withInRepoApp(async (app) =>
    documentJson(openApiDocument(controllersOf(app), { version: String(API_MAJOR) })),
  );
}
