// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { createHash } from 'node:crypto';
import type { Type } from '@nestjs/common';
import { problem } from '@northmes/contracts';
import {
  API_CONTROLLER_METADATA,
  type ApiControllerOptions,
  type ProblemStatus,
  type PublicApiOperationMetadata,
  publicApiOperationsOf,
} from '@northmes/sdk/rest';
import type { z } from 'zod';
import { createSchema, type oas32 } from 'zod-openapi';

/** A JSON Schema object of a component, with the keywords a reader of the document looks up. */
export interface JsonSchemaObject {
  readonly type?: string | readonly string[];
  readonly properties?: Readonly<Record<string, unknown>>;
  readonly required?: readonly string[];
  readonly [keyword: string]: unknown;
}

/** An OpenAPI 3.1 document as openApiDocument builds it, with every part it fills required. */
export interface OpenApiDocument {
  readonly openapi: '3.1.0';
  readonly info: { readonly title: string; readonly version: string; readonly description: string };
  readonly tags: readonly oas32.TagObject[];
  readonly paths: Readonly<Record<string, Readonly<Record<string, oas32.OperationObject>>>>;
  readonly components: {
    readonly schemas: Readonly<Record<string, JsonSchemaObject>>;
    readonly parameters: Readonly<Record<string, oas32.ParameterObject>>;
    readonly responses: Readonly<Record<string, oas32.ResponseObject>>;
    readonly securitySchemes: Readonly<Record<string, oas32.SecuritySchemeObject>>;
  };
}

export interface OpenApiDocumentOptions {
  /**
   * info.version: the API major "1" for the committed snapshot, which a release never changes, or
   * the image version for an installation's own document (ADR 0064).
   */
  readonly version: string;
}

/** The module that owns the shared components, which every module's document may use. */
const SHARED = '@northmes/contracts';

/** The name and description of each problem response, by status. */
const problemResponses: Readonly<Record<ProblemStatus, { name: string; description: string }>> = {
  400: { name: 'InvalidInput', description: 'Invalid input' },
  401: { name: 'NotSignedIn', description: 'Not signed in' },
  403: { name: 'NotPermitted', description: 'Not permitted' },
  404: { name: 'NotFound', description: 'Not found' },
  409: { name: 'Conflict', description: 'Conflict' },
  412: { name: 'PreconditionFailed', description: 'Precondition failed' },
  429: { name: 'TooManyRequests', description: 'Too many requests' },
};

const PLANT_PARAMETER: oas32.ParameterObject = {
  name: 'plant',
  in: 'query',
  required: false,
  description:
    'The slug of the plant the request acts at. Without it, the request acts at the company of its credential, and the server never picks a plant for the caller.',
  schema: { type: 'string' },
};

const BEARER: oas32.SecuritySchemeObject = {
  type: 'http',
  scheme: 'bearer',
  description:
    'An integration token, which a Company admin creates under Settings, Integrations. It is bound to the company or one plant and acts with the roles it holds there. Each operation lists the permission it checks as its scope.',
};

/** The JSON of a value with the keys of every object in name order, so equal trees print equal. */
export function sortedKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortedKeys((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

/**
 * A converted schema as an object. JSON Schema also allows true and false as schemas, which no
 * contract converts to, so either throws naming where it came from.
 */
function objectOf<Schema>(schema: Schema | boolean, from: string): Exclude<Schema, boolean> {
  if (typeof schema === 'boolean') {
    throw new Error(`A schema of ${from} converts to ${schema}, which the document does not take`);
  }
  return schema as Exclude<Schema, boolean>;
}

/** The components of the document, which fails when one id converts to two different schemas. */
class Components {
  readonly schemas = new Map<string, { schema: JsonSchemaObject; hash: string; owner: string }>();

  /** Converts a schema in the input sense, the JSON a request or a response carries. */
  convert(schema: z.ZodType, owner: string): oas32.SchemaObject | oas32.ReferenceObject {
    const result = createSchema(schema, { io: 'input' });
    for (const [id, component] of Object.entries(result.components)) {
      this.add(id, objectOf(component, id) as JsonSchemaObject, owner);
    }
    return objectOf(result.schema, owner);
  }

  add(id: string, schema: JsonSchemaObject, owner: string): void {
    const hash = createHash('sha256')
      .update(JSON.stringify(sortedKeys(schema)))
      .digest('hex');
    const known = this.schemas.get(id);
    if (!known) {
      this.schemas.set(id, { schema, hash, owner });
    } else if (known.hash !== hash) {
      throw new Error(
        `Component ${id} converts to different schemas in modules ${known.owner} and ${owner}; each component id has one owning module, and a shared one prints identically (ADR 0064)`,
      );
    }
  }
}

/** The names of the {parameters} of an OpenAPI path. */
function pathParametersOf(path: string): Set<string> {
  return new Set([...path.matchAll(/\{([a-zA-Z0-9]+)\}/g)].map(([, name]) => name as string));
}

/**
 * The parameters of a GET route: each field of the input in the order the contract declares them,
 * in the path when the path names it and in the query otherwise, where an array is a
 * comma-separated list (ADR 0073).
 */
function inputParameters(
  operation: PublicApiOperationMetadata,
  components: Components,
): oas32.ParameterObject[] {
  const inPath = pathParametersOf(operation.path);
  const shape = (operation.input as z.ZodObject).shape as Readonly<Record<string, z.ZodType>>;
  return Object.entries(shape).map(([name, field]) => {
    const schema = components.convert(field, operation.tag);
    if (inPath.has(name)) return { name, in: 'path', required: true, schema };
    const isArray = (schema as JsonSchemaObject).type === 'array';
    return {
      name,
      in: 'query',
      required: field._zod.optin !== 'optional',
      ...(isArray ? { style: 'form', explode: false } : {}),
      schema,
    };
  });
}

function content(schema: oas32.SchemaObject | oas32.ReferenceObject): oas32.ContentObject {
  return { 'application/json': { schema } };
}

/** One operation of the document. */
function operationObject(
  operation: PublicApiOperationMetadata,
  components: Components,
): oas32.OperationObject {
  const { operationId, tag, description, method, status, permission, problems } = operation;
  const output = content(components.convert(operation.output, tag));
  const responses: oas32.ResponsesObject = {
    ...(status === 201 ? { '201': { description: 'Created', content: output } } : {}),
    '200': { description: 'OK', content: output },
  };
  for (const problemStatus of problems) {
    responses[String(problemStatus)] = {
      $ref: `#/components/responses/${problemResponses[problemStatus].name}`,
    };
  }
  const plant = { $ref: '#/components/parameters/plant' };
  return {
    operationId,
    tags: [tag],
    ...(description ? { description } : {}),
    parameters: method === 'GET' ? [...inputParameters(operation, components), plant] : [plant],
    ...(method === 'POST'
      ? {
          requestBody: {
            required: true,
            content: content(components.convert(operation.input, tag)),
          },
        }
      : {}),
    responses,
    security: [{ bearer: [permission] }],
  };
}

/** The response component of each problem status. */
function problemResponseComponents(): Record<string, oas32.ResponseObject> {
  return Object.fromEntries(
    Object.entries(problemResponses).map(([status, { name, description }]) => [
      name,
      {
        description,
        content: {
          'application/problem+json': { schema: { $ref: '#/components/schemas/Problem' } },
        },
        ...(status === '429'
          ? {
              headers: {
                'Retry-After': {
                  description: 'The seconds to wait before the credential may call again.',
                  schema: { type: 'integer', minimum: 0 },
                },
              },
            }
          : {}),
      },
    ]),
  );
}

/** The public controllers among `controllers`: those ApiController declares in the public family. */
function isPublic(controller: Type): boolean {
  const options = Reflect.getMetadata(API_CONTROLLER_METADATA, controller) as
    | ApiControllerOptions
    | undefined;
  return options?.family === 'public';
}

/**
 * The OpenAPI 3.1 document of the public REST API (ADR 0064, ADR 0073), from the public
 * controllers among `controllers`, which toRestRoutes builds. Each route is an operation with its
 * operation id, its module as tag, its parameters (the path parameters, the rest of a GET route's
 * input as query parameters, and the optional plant), its contract input as a POST route's body,
 * its output schema as its 2xx answer, its problem responses as application/problem+json, and the
 * bearer scheme with its permission as the scope. Schemas are the JSON a request or a response
 * carries, so a timestamp is its date-time string. Paths, tags and components are in name order,
 * so equal routes give an equal document. A component id that two modules convert to different
 * schemas throws naming both.
 */
export function openApiDocument(
  controllers: readonly Type[],
  { version }: OpenApiDocumentOptions,
): OpenApiDocument {
  const components = new Components();
  components.convert(problem, SHARED);
  const operations = controllers.filter(isPublic).flatMap(publicApiOperationsOf);
  const paths: Record<string, Record<string, oas32.OperationObject>> = {};
  for (const operation of [...operations].sort((a, b) => a.path.localeCompare(b.path))) {
    const item = paths[operation.path] ?? {};
    item[operation.method.toLowerCase()] = operationObject(operation, components);
    paths[operation.path] = item;
  }
  const tags = [...new Set(operations.map(({ tag }) => tag))].sort().map((name) => ({ name }));
  const schemas = Object.fromEntries(
    [...components.schemas.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, { schema }]) => [id, schema]),
  );
  return {
    openapi: '3.1.0',
    info: {
      title: 'NorthMES API',
      version,
      description:
        'The public REST API of NorthMES for outside systems, such as an ERP. Writes are commands under /commands/, and every error is application/problem+json.',
    },
    tags,
    paths,
    components: {
      schemas,
      parameters: { plant: PLANT_PARAMETER },
      responses: problemResponseComponents(),
      securitySchemes: { bearer: BEARER },
    },
  };
}

/** A document as JSON, with every key in name order and a final newline. */
export function documentJson(document: OpenApiDocument): string {
  return `${JSON.stringify(sortedKeys(document), null, 2)}\n`;
}
