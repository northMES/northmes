// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { z } from 'zod';

/**
 * One error of an input field, in the shape GraphQL's fieldErrors use: the path to the field, a
 * message a person can read and the issue's code. The component FieldError of the OpenAPI document
 * (ADR 0064).
 */
export const fieldError = z
  .object({
    path: z.array(z.union([z.string(), z.int()])).describe('The path to the field in the input.'),
    message: z.string().describe('What is wrong with the field, for a person to read.'),
    code: z.string().describe('The kind of issue, such as invalid_type or too_small.'),
  })
  .meta({ id: 'FieldError', description: 'One error of an input field.' });

/**
 * A REST error as the public API answers it, application/problem+json (RFC 9457): the component
 * Problem of the OpenAPI document, which every module's problem responses share (ADR 0064,
 * docs/plan/05, REST errors).
 */
export const problem = z
  .object({
    type: z.url().describe('The documentation URI of the error code.'),
    title: z.string().describe('The fixed title of the status.'),
    status: z.int().describe('The HTTP status.'),
    detail: z.string().describe('What went wrong, without internal details.'),
    instance: z.string().describe("The request's path."),
    code: z
      .string()
      .describe(
        'The module-scoped error code, such as core.version_conflict, which a client reads.',
      ),
    errors: z.array(fieldError).describe('The field errors of the input; empty for none.'),
    details: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('The values a client reads by code, such as the permission of core.forbidden.'),
    correlationId: z.string().describe('The id that the server log records with the error.'),
  })
  .meta({ id: 'Problem', description: 'An error of the public API (RFC 9457).' });
