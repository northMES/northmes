// SPDX-License-Identifier: MIT
// Builds the schema of fixture modules with Nest's GraphQLModule and a driver that serves nothing,
// as the host's driver builds the schema of its modules.
import 'reflect-metadata';
import { type DynamicModule, Injectable, type Type } from '@nestjs/common';
import { AbstractGraphQLDriver, GraphQLModule, GraphQLSchemaHost } from '@nestjs/graphql';
import { Test, type TestingModule } from '@nestjs/testing';

@Injectable()
class SchemaOnlyDriver extends AbstractGraphQLDriver {
  async start(): Promise<void> {}

  async stop(): Promise<void> {}
}

/**
 * The one schema of `imports`, which hold the fixture modules and anything they need, and the
 * testing module that holds them. The caller closes the testing module.
 */
export async function buildSchema(imports: readonly (Type | DynamicModule)[]) {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [
      ...imports,
      GraphQLModule.forRoot({ driver: SchemaOnlyDriver, autoSchemaFile: true, sortSchema: true }),
    ],
  }).compile();
  // Nest logs every error a resolver throws, also the errors a test expects.
  moduleRef.useLogger(false);
  await moduleRef.init();
  return { schema: moduleRef.get(GraphQLSchemaHost).schema, moduleRef };
}
