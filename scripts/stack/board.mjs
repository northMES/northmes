// The URL that pnpm dev and pnpm demo print: the seeded plant's planning board (ADR 0062).

import { seedScopes } from './seed.mjs';

/**
 * The URL of the seed plant's planning board at origin, built with planningLinks.board. Under plain
 * node, @northmes/planning-contracts resolves to its dist/, so the import waits for the call: the
 * stack's pnpm northmes builds the server and the packages it imports, this one among them, before
 * pnpm dev and pnpm demo ask for the URL.
 * @param {string} origin
 * @returns {Promise<string>}
 */
export async function boardUrl(origin) {
  const { planningLinks } = await import('@northmes/planning-contracts');
  return new URL(planningLinks.board({ plant: seedScopes.plant }).href, origin).href;
}
