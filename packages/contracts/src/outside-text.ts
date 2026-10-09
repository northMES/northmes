// SPDX-License-Identifier: MIT
import { z } from 'zod';

/** The schemas that outsideText marked, with the mark as their metadata in this registry. */
const outsideTexts = z.registry<{ readonly outsideText: true }>();

/**
 * Marks a string field of an output schema as outside text: text that an outside system or a
 * person wrote, such as an article's name that an ERP pushes (ADR 0034, ADR 0073). The operation
 * runner wraps such a field as `{ untrusted: true, text }` on the tool surfaces and returns the
 * plain string on REST. The mark sits on the schema it returns, so refine the string before
 * marking it: outsideText(z.string().max(200)), not outsideText().max(200).
 */
export function outsideText<Schema extends z.ZodString>(
  schema: Schema = z.string() as Schema,
): Schema {
  outsideTexts.add(schema as z.ZodString, { outsideText: true });
  return schema;
}

/**
 * Whether `schema` is outside text, also behind optional, nullable or a default, which wrap the
 * marked schema.
 */
export function isOutsideText(schema: z.core.$ZodType): boolean {
  let current: z.core.$ZodType | undefined = schema;
  while (current) {
    if (outsideTexts.has(current)) return true;
    const def = current._zod.def as { type: string; innerType?: z.core.$ZodType };
    const wraps = def.type === 'optional' || def.type === 'nullable' || def.type === 'default';
    current = wraps ? def.innerType : undefined;
  }
  return false;
}
