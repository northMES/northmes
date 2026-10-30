// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { hasErrorCode } from '../../ui/lib/graphql-errors.ts';

/**
 * A page state the product owner can open on mock data (design D3, DR17 to DR22), as the plant
 * settings pages do: the mock source answers it instead of the fixture; a server source ignores
 * it. `range-too-large` refuses every time chunk as the board's range limit would, and
 * `chunks-loading` answers the rows while every time chunk keeps loading (ADR 0089).
 */
export const planningPreviews = [
  'loading',
  'empty',
  'error',
  'forbidden',
  'range-too-large',
  'chunks-loading',
] as const;

export type PlanningPreview = (typeof planningPreviews)[number];

/** The refusal a source answers a forbidden preview with, as the API's FORBIDDEN would arrive. */
export class PlanningForbidden extends Error {
  constructor() {
    super('Forbidden');
    this.name = 'PlanningForbidden';
  }
}

/**
 * The codes with which the planning reads refuse a load: a row list above `ganttMaxOrders` and a
 * time chunk above the board's limit (ADR 0089), and a page size or a cursor the list conventions
 * refuse (ADR 0016).
 */
export type PlanningRefusalCode =
  | 'planning.gantt.too_many_orders'
  | 'planning.board.range_too_large'
  | 'core.list.bad_argument'
  | 'core.list.invalid_cursor';

/** A refusal a mock source answers with, as the API's errorCode would arrive. */
export class PlanningRefusal extends Error {
  readonly errorCode: PlanningRefusalCode;

  constructor(errorCode: PlanningRefusalCode) {
    super(errorCode);
    this.name = 'PlanningRefusal';
    this.errorCode = errorCode;
  }
}

/** Whether a failed load is the refusal of a code, from a mock source or from the API. */
export function isPlanningRefusal(error: unknown, errorCode: PlanningRefusalCode): boolean {
  return (
    (error instanceof PlanningRefusal && error.errorCode === errorCode) ||
    hasErrorCode(error, errorCode)
  );
}
