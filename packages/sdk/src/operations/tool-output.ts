// SPDX-License-Identifier: MIT
import { isOutsideText } from '@northmes/contracts';
import type { z } from 'zod';

/** The longest outside text a tool answer carries, and the most values per call (ADR 0034). */
export const OUTSIDE_TEXT_MAX_LENGTH = 500;
export const OUTSIDE_TEXT_MAX_VALUES = 50;

/** Outside text as a tool answers it, so a model reads it as data and never as an instruction. */
export interface UntrustedText {
  readonly untrusted: true;
  readonly text: string;
}

/** The parts of a Zod definition the walk reads. */
interface Def {
  readonly type: string;
  readonly shape?: Readonly<Record<string, z.core.$ZodType>>;
  readonly element?: z.core.$ZodType;
  readonly innerType?: z.core.$ZodType;
  /** A pipe's or a codec's input side, which is what JSON carries. */
  readonly in?: z.core.$ZodType;
}

function defOf(schema: z.core.$ZodType): Def {
  return schema._zod.def as unknown as Def;
}

/**
 * Wraps every outside text field of an encoded answer as `{ untrusted: true, text }` (ADR 0034,
 * ADR 0073): each text capped at 500 characters, and at most 50 values per call, after which the
 * text is empty. It walks `schema`'s JSON side next to the value: objects, arrays, optional,
 * nullable, defaults, pipes and codecs. A null or absent field stays as it is.
 */
export function wrapOutsideText(schema: z.core.$ZodType, value: unknown): unknown {
  let wrapped = 0;
  const walk = (node: z.core.$ZodType, current: unknown): unknown => {
    if (current === null || current === undefined) return current;
    if (isOutsideText(node) && typeof current === 'string') {
      wrapped += 1;
      const text =
        wrapped > OUTSIDE_TEXT_MAX_VALUES ? '' : current.slice(0, OUTSIDE_TEXT_MAX_LENGTH);
      return { untrusted: true, text } satisfies UntrustedText;
    }
    const def = defOf(node);
    switch (def.type) {
      case 'object': {
        if (typeof current !== 'object' || !def.shape) return current;
        const shape = def.shape;
        return Object.fromEntries(
          Object.entries(current).map(([key, field]) => {
            const fieldSchema = shape[key];
            return [key, fieldSchema ? walk(fieldSchema, field) : field];
          }),
        );
      }
      case 'array':
        return Array.isArray(current) && def.element
          ? current.map((item) => walk(def.element as z.core.$ZodType, item))
          : current;
      case 'optional':
      case 'nullable':
      case 'default':
        return def.innerType ? walk(def.innerType, current) : current;
      case 'pipe':
        return def.in ? walk(def.in, current) : current;
      default:
        return current;
    }
  };
  return walk(schema, value);
}
