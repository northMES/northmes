// SPDX-License-Identifier: MIT
import { AsyncLocalStorage } from 'node:async_hooks';

/** What a run of an operation learned besides its answer. */
interface Outcome {
  created: boolean;
}

const outcomes = new AsyncLocalStorage<Outcome>();

/**
 * Notes that the running operation created its row, so an operation whose REST binding answers
 * 201 does so, and a retry that finds the row answers 200 (ADR 0012, ADR 0073). A command handler
 * calls it when it inserted the row. Outside an operation run, such as a GraphQL mutation, it
 * does nothing.
 */
export function noteCreated(): void {
  const outcome = outcomes.getStore();
  if (outcome) outcome.created = true;
}

/** Runs fn and reports whether it noted a created row. */
export async function withOutcome<Result>(
  fn: () => Promise<Result>,
): Promise<{ readonly result: Result; readonly created: boolean }> {
  const outcome: Outcome = { created: false };
  const result = await outcomes.run(outcome, fn);
  return { result, created: outcome.created };
}
