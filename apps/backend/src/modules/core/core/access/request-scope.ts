// SPDX-License-Identifier: AGPL-3.0-or-later
import { HttpStatus } from '@nestjs/common';
import { DomainError } from '@northmes/sdk/errors';
import { currentPrincipal, type Principal } from '../../../../principal.ts';
import { can } from './access.ts';

/**
 * Where a request reads and changes access: its plant, and the company the plant belongs to. Users,
 * roles and assignments are read at these two scopes only, so a request at one plant never reads
 * another plant's assignments.
 */
export interface RequestScope {
  readonly principal: Principal;
  readonly plantId: string;
  readonly companyId: string;
}

/** The refusal of a read or a command whose permission the principal lacks where it runs. */
export function forbidden(message: string): DomainError {
  return new DomainError({ code: 'core.forbidden', status: HttpStatus.FORBIDDEN, message });
}

/** The root of the scope tree above scopeId, its company, as the principal's scope tree holds it. */
export function companyOf(principal: Pick<Principal, 'scopes'>, scopeId: string): string {
  const seen = new Set<string>();
  let node = principal.scopes.get(scopeId);
  while (node && !seen.has(node.id)) {
    if (node.parentId === null) return node.id;
    seen.add(node.id);
    node = principal.scopes.get(node.parentId);
  }
  throw forbidden(`Scope ${scopeId} is not in one of your companies`);
}

/**
 * The scope of the running request, when its principal holds `permission` at the request's plant
 * (ADR 0010). A request without a principal or without a plant, and a principal without the
 * permission there, get core.forbidden.
 */
export function requestScope(permission: string): RequestScope {
  const principal = currentPrincipal();
  const plantId = principal?.plantId;
  if (!principal || !plantId) {
    throw forbidden(`The request names no plant, so it cannot use ${permission}`);
  }
  if (!can(principal, permission, plantId)) {
    throw forbidden(`You need ${permission} at plant ${plantId}`);
  }
  return { principal, plantId, companyId: companyOf(principal, plantId) };
}
