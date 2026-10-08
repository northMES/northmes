// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Who a request acts as, at the plant the request works at (ADR 0007, ADR 0011). One principal is
 * resolved per request. Until E05 the gateway's tracer principal is the only kind.
 */
export interface Principal {
  /** The scope id of the plant the request works at. */
  readonly plantId: string;
  /** The scope ids a transaction of this principal reads: northmes.read_scopes (ADR 0008). */
  readonly readScopes: readonly string[];
  /** The scope ids a transaction of this principal writes: northmes.write_scopes (ADR 0008). */
  readonly writeScopes: readonly string[];
  /** True when the principal holds the permission at its plant. */
  can(permission: string): boolean;
}
