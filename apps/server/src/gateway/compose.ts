// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHash } from 'node:crypto';
import { composeServices, compositionHasErrors } from '@theguild/federation-composition';
import { parse } from 'graphql';
import { BootError } from '../boot/boot-error.ts';
import { type CompositionProblem, checkRules, type SubgraphSdl } from './rules.ts';

/** The URL of a subgraph in the supergraph. The in-process transport executes it in this process. */
export function inProcessUrl(name: string): string {
  return `inproc://${name}`;
}

/**
 * Every NorthMES rule and composition error of one composition, one "[code] message" problem
 * each. Composition runs in boot step 10, so it stops the boot with exit code 1 (ADR 0015).
 */
export class SupergraphCompositionError extends BootError {
  constructor(problems: readonly CompositionProblem[]) {
    super(problems.map(({ code, message }) => `[${code}] ${message}`));
    this.name = 'SupergraphCompositionError';
  }
}

/**
 * Composes the subgraphs into the supergraph SDL with @theguild/federation-composition, after the
 * NorthMES rules (ADR 0015). Throws one SupergraphCompositionError that lists every rule and
 * composition error.
 */
export function composeSupergraph(subgraphs: readonly SubgraphSdl[]): string {
  const ruleProblems = checkRules(subgraphs);
  const result = composeServices(
    subgraphs.map(({ name, sdl }) => ({ name, typeDefs: parse(sdl), url: inProcessUrl(name) })),
  );
  if (compositionHasErrors(result)) {
    const compositionProblems = result.errors.map((error) => ({
      code: String(error.extensions.code),
      message: error.message,
    }));
    throw new SupergraphCompositionError([...ruleProblems, ...compositionProblems]);
  }
  if (ruleProblems.length > 0) throw new SupergraphCompositionError(ruleProblems);
  return result.supergraphSdl;
}

/** The first 12 hex characters of the supergraph SDL's SHA-256, which names the supergraph. */
export function supergraphHash(supergraph: string): string {
  return createHash('sha256').update(supergraph).digest('hex').slice(0, 12);
}
