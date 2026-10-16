// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { z } from 'zod';

/**
 * An event's contract, plain data in the owning module's MIT contracts package, so consumers in
 * other modules and plugins read it without the owner's server code (ADR 0014, ADR 0068).
 */
export interface EventContract<Data extends z.ZodType = z.ZodType> {
  /** `<entity>.<what happened>`, such as core.article.created. */
  readonly name: string;
  /**
   * The schema version of data. A change that a consumer built for the old shape cannot read
   * raises it, and the consumer names the version it reads (ADR 0014).
   */
  readonly version: number;
  /** `<module GraphQL name>.<entity>`, such as core.article. */
  readonly entity: string;
  /** What the event carries beside the entity's id, version and scope. */
  readonly data: Data;
}

/** Declares an event's contract, and refuses a name outside its entity or a version below 1. */
export function defineEventContract<const Contract extends EventContract>(
  contract: Contract,
): Contract {
  const { name, version, entity } = contract;
  if (!name.startsWith(`${entity}.`) || !/^[a-z][a-z_]*$/.test(name.slice(entity.length + 1))) {
    throw new Error(
      `Event ${name} must be named <entity>.<what happened>, such as core.article.created`,
    );
  }
  if (!Number.isInteger(version) || version < 1) {
    throw new Error(`Event ${name} needs a schema version of 1 or more`);
  }
  return contract;
}
