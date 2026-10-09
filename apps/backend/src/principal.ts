// SPDX-License-Identifier: AGPL-3.0-or-later
import { AsyncLocalStorage } from 'node:async_hooks';
import { SetMetadata } from '@nestjs/common';

/**
 * A node of the scope tree as one principal sees it: its parent, and the permissions that the
 * principal's role assignments at this node grant (ADR 0007, ADR 0010).
 */
export interface ScopeGrant {
  readonly id: string;
  /** The parent node, or null for a company, the root of its tree. */
  readonly parentId: string | null;
  /** The installed permissions of the roles assigned to the principal at this node. */
  readonly permissions: readonly string[];
}

/**
 * Who a request acts as (ADR 0010, ADR 0011). One principal is resolved per request, from the
 * bearer token, by the core module's PrincipalResolver.
 */
export interface Principal {
  /** The user's id, auth.user.id. */
  readonly userId: string;
  /**
   * The scope id of the plant whose slug the request's x-northmes-plant header names, which the
   * principal may open (ADR 0007). A command that creates an entity writes it there.
   */
  readonly plantId: string | undefined;
  /**
   * The scope ids a transaction of this principal reads: northmes.read_scopes (ADR 0008), the
   * request's plant and its company, or none for a request without a plant.
   */
  readonly readScopes: readonly string[];
  /** The scope ids a transaction of this principal writes: northmes.write_scopes (ADR 0008). */
  readonly writeScopes: readonly string[];
  /** Every node of the scope trees of the principal's companies, by id, which can() walks. */
  readonly scopes: ReadonlyMap<string, ScopeGrant>;
}

/**
 * Resolves the principal of a request from its headers, or null when the request carries no valid
 * credential. The core module provides it; a host without core resolves no principal.
 */
export abstract class PrincipalResolver {
  abstract resolve(headers: Headers): Promise<Principal | null>;
}

/** The header that names a request's plant by its slug, the plant's segment of the web's URLs. */
export const PLANT_HEADER = 'x-northmes-plant';

/** The metadata key of Public. */
export const IS_PUBLIC = 'northmes:public';

/**
 * Marks a controller or a route handler that answers without a principal, such as the web app's
 * files. Every other route needs one (ADR 0011).
 */
export const Public = () => SetMetadata(IS_PUBLIC, true);

const principals = new AsyncLocalStorage<Principal | null>();

/**
 * Runs fn as `principal`: every ScopedDatabase transaction that fn starts, also after an await,
 * uses that principal's scope sets. null stands for a request without a principal.
 */
export function runAs<Result>(principal: Principal | null, fn: () => Result): Result {
  return principals.run(principal, fn);
}

/** The principal that the running request or job acts as, or null outside of runAs. */
export function currentPrincipal(): Principal | null {
  return principals.getStore() ?? null;
}
