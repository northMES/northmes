// SPDX-License-Identifier: AGPL-3.0-or-later
import { HttpStatus } from '@nestjs/common';
import { DomainError } from '@northmes/sdk/errors';
import { currentPrincipal, type Principal, runAs } from '../../../../principal.ts';
import { can, inCompanies } from './access.ts';

/**
 * Where a request reads and changes access. At a plant: the plant and the company it belongs to,
 * so a request at one plant never reads another plant's assignments. In company settings, a request
 * without a plant (ADR 0066): the company it names and every plant of it.
 */
export interface RequestScope {
  /** The principal whose scope sets the reads run with: narrowed to the company in company settings. */
  readonly principal: Principal;
  readonly companyId: string;
  /** The request's plant, or undefined in company settings. */
  readonly plantId: string | undefined;
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
 * The scope of the running request, when its principal holds `permission` there (ADR 0010). At a
 * plant, the principal must hold it at the plant, and a companyId, when one is given, must be the
 * plant's company. Without a plant, the request is in company settings (ADR 0066), or acts at the
 * company its principal names (ADR 0073): it must name a company, where the principal must hold the
 * permission, and its reads run with the read scopes of that company and its plants. Anything else
 * is core.forbidden.
 */
export function requestScope(permission: string, asked?: string): RequestScope {
  const principal = currentPrincipal();
  if (!principal) throw forbidden(`Only a signed-in user can use ${permission}`);
  const { plantId } = principal;
  const companyId = asked ?? principal.companyId;
  if (plantId) {
    if (!can(principal, permission, plantId)) {
      throw forbidden(`You need ${permission} at plant ${plantId}`);
    }
    const company = companyOf(principal, plantId);
    if (companyId !== undefined && companyId !== company) {
      throw forbidden(`Company ${companyId} is not the company of the request's plant`);
    }
    return { principal, plantId, companyId: company };
  }
  if (companyId === undefined) {
    throw forbidden(`The request names no plant and no company, so it cannot use ${permission}`);
  }
  if (!can(principal, permission, companyId)) {
    throw forbidden(`You need ${permission} at company ${companyId}`);
  }
  const atCompany = inCompanies(principal, (id) => id === companyId);
  return { principal: { ...principal, ...atCompany }, plantId: undefined, companyId };
}

/** Runs fn with the scope sets of `scope`, so its transactions read where the scope reads. */
export function readIn<Result>(scope: RequestScope, fn: () => Result): Result {
  return runAs(scope.principal, fn);
}
