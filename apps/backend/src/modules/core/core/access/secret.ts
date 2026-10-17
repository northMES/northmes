// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { inspect } from 'node:util';

/** What a Secret shows wherever it is turned into text. */
const REDACTED = '[redacted]';

/**
 * A secret value that NorthMES shows once, such as an integration token's secret (ADR 0073). It
 * reads as [redacted] in JSON.stringify, String(), template strings and util.inspect, so a log line,
 * an error report or a serialized record that holds it does not leak it. Only reveal() returns the
 * value, for the one answer that shows it.
 */
export class Secret {
  readonly #value: string;

  constructor(value: string) {
    this.#value = value;
  }

  /** The value itself, for the answer that shows it once. */
  reveal(): string {
    return this.#value;
  }

  toString(): string {
    return REDACTED;
  }

  toJSON(): string {
    return REDACTED;
  }

  [inspect.custom](): string {
    return REDACTED;
  }
}
