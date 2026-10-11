// SPDX-License-Identifier: AGPL-3.0-or-later
import type { HistoryState } from '@tanstack/react-router';

/**
 * What Edit role hands the role's page in the history entry it replaces itself with (design
 * core-304, RO41): the note that repeats the polite announcement of the save.
 */
interface RoleSavedState {
  readonly roleSaved?: string;
}

/** "Shift lead saved. It applies to 2 people from their next action.", or "Shift lead saved.". */
export function roleSavedMessage(
  name: string,
  holders: readonly { readonly user: { readonly id: string } }[],
): string {
  const people = new Set(holders.map(({ user }) => user.id)).size;
  if (people === 0) return `${name} saved.`;
  return `${name} saved. It applies to ${people} ${people === 1 ? 'person' : 'people'} from their next action.`;
}

/** The history state that carries the saved note to the role's page. */
export function roleSavedState(message: string): HistoryState {
  return { roleSaved: message } as RoleSavedState as HistoryState;
}

/** The saved note of a history entry, if Edit role left one. */
export function roleSavedOf(state: unknown): string | undefined {
  const note = (state as RoleSavedState | undefined)?.roleSaved;
  return typeof note === 'string' ? note : undefined;
}
