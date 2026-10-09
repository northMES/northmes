// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Principal, ScopeGrant } from '../../../../principal.ts';

export type { ScopeGrant };

/** What can() and the transaction helper read of a principal. */
export type Access = Pick<Principal, 'readScopes' | 'writeScopes' | 'scopes'>;

/**
 * True for a permission that changes data: every action but read. A role with one of them writes
 * at the scopes where it is assigned (ADR 0008). Permission ids are `<module>.<entity>:<action>`.
 */
export function isWritePermission(permission: string): boolean {
  return !permission.endsWith(':read');
}

/** The nodes from scopeId up to its root, nearest first. A node outside `scopes` has none. */
function* ancestorsOrSelf(
  scopes: ReadonlyMap<string, ScopeGrant>,
  scopeId: string,
): Generator<ScopeGrant> {
  const seen = new Set<string>();
  let node = scopes.get(scopeId);
  while (node && !seen.has(node.id)) {
    seen.add(node.id);
    yield node;
    node = node.parentId === null ? undefined : scopes.get(node.parentId);
  }
}

/** True when a role assignment at scopeId or at a scope above it grants a permission that matches. */
function grantedAt(
  scopes: ReadonlyMap<string, ScopeGrant>,
  scopeId: string,
  matches: (permission: string) => boolean,
): boolean {
  for (const node of ancestorsOrSelf(scopes, scopeId)) {
    if (node.permissions.some(matches)) return true;
  }
  return false;
}

/**
 * can(principal, permission, scopeId) (ADR 0010): walks from the scope to the root of its tree and
 * answers true when the principal holds the permission at a node on the way. A company assignment
 * therefore holds at every plant, and a plant assignment holds at neither its sibling nor the
 * company. A scope outside the principal's companies grants nothing.
 */
export function can(principal: Pick<Access, 'scopes'>, permission: string, scopeId: string) {
  return grantedAt(principal.scopes, scopeId, (held) => held === permission);
}

/**
 * The access of a principal whose role assignments grant `nodes` (ADR 0008): it reads every scope
 * at or below an assignment and every scope above one, so a plant planner reads company rows; it
 * writes every scope at or below an assignment of a role with a write permission. A principal
 * without assignments reads and writes nothing. Both sets are sorted.
 */
export function accessOf(nodes: readonly ScopeGrant[]): Access {
  const scopes = new Map(nodes.map((node) => [node.id, node]));
  const read = new Set<string>();
  const write = new Set<string>();
  for (const node of nodes) {
    if (grantedAt(scopes, node.id, () => true)) read.add(node.id);
    if (grantedAt(scopes, node.id, isWritePermission)) write.add(node.id);
    if (node.permissions.length > 0) {
      for (const above of ancestorsOrSelf(scopes, node.id)) read.add(above.id);
    }
  }
  return { scopes, readScopes: [...read].sort(), writeScopes: [...write].sort() };
}

/**
 * True when the principal may open the plant at scopeId: a role assignment at the plant or at a
 * node above it, such as the company, grants it a permission there (ADR 0007).
 */
export function canOpen(principal: Pick<Access, 'scopes'>, scopeId: string): boolean {
  return grantedAt(principal.scopes, scopeId, () => true);
}

/**
 * The access of a request at one plant (ADR 0008): of the scopes the principal reads, it reads
 * the plant, the nodes above it and the nodes below it, so never another plant; of those, it writes
 * the ones the principal writes. A request without a plant reads and writes nothing. Both sets
 * stay sorted.
 */
export function atPlant(access: Access, plantId: string | undefined): Access {
  if (plantId === undefined) return { ...access, readScopes: [], writeScopes: [] };
  const above = new Set([...ancestorsOrSelf(access.scopes, plantId)].map(({ id }) => id));
  const inPlant = (scopeId: string) =>
    above.has(scopeId) ||
    [...ancestorsOrSelf(access.scopes, scopeId)].some(({ id }) => id === plantId);
  return {
    ...access,
    readScopes: access.readScopes.filter(inPlant),
    writeScopes: access.writeScopes.filter(inPlant),
  };
}
