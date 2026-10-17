// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The planned duration formula of ADR 0027 (plan 07, Planned duration): working seconds from a
// quantity and the rates frozen on the job order. One function gives the run time, the send-ahead
// release, the remaining work and the backward share bound, so the preview and the server agree.

/** The rates frozen on a job order or carried by an operation (ADR 0027). */
export interface Rates {
  readonly cycleSeconds: number;
  readonly piecesPerCycle: number;
  readonly cyclesPerPiece: number;
  /** The divisor of the run time, the OEE target by default, in (0, 2]. */
  readonly planningFactor: number;
  readonly retoolSeconds: number;
  readonly fixedSeconds: number;
}

/** Retool plus fixed time, never divided by the planning factor. */
export function setupSeconds(rates: Rates): number {
  return rates.retoolSeconds + rates.fixedSeconds;
}

/** The whole cycles a quantity needs: a partial cycle rounds up, because a piece exists when its cycle completes. */
export function cyclesFor(quantity: number, rates: Rates): number {
  return Math.ceil((quantity * rates.cyclesPerPiece) / rates.piecesPerCycle);
}

/** The run seconds of a quantity: whole cycles times the cycle time over the planning factor, to the whole second. */
export function runSecondsFor(quantity: number, rates: Rates): number {
  return Math.ceil((cyclesFor(quantity, rates) * rates.cycleSeconds) / rates.planningFactor);
}

/** The seconds of one cycle of the run, the last-piece rule's unit. */
export function oneCycleSeconds(rates: Rates): number {
  return Math.ceil(rates.cycleSeconds / rates.planningFactor);
}

/** Setup plus run: the working seconds a job order is laid over its machine's availability for. */
export function plannedSeconds(quantity: number, rates: Rates): number {
  return setupSeconds(rates) + runSecondsFor(quantity, rates);
}
