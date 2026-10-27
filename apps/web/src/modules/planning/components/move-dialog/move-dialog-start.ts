// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Temporal } from 'temporal-polyfill';

const startPattern = /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})$/;

/** An instant as the Start field writes it in plant time: "2026-11-03 11:30" (design D3, IN8). */
export function startText(epochMs: number, timeZone: string): string {
  const local = Temporal.Instant.fromEpochMilliseconds(epochMs).toZonedDateTimeISO(timeZone);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${local.toPlainDate().toString()} ${pad(local.hour)}:${pad(local.minute)}`;
}

/**
 * The instant a Start field's text names in plant time, or none when it is not a date and a time
 * like "2026-11-03 11:30". A clock time a change of clocks skips moves forward, and one it repeats
 * takes the earlier instant (ADR 0024).
 */
export function startOf(text: string, timeZone: string): number | undefined {
  const match = startPattern.exec(text.trim());
  if (match === null) return undefined;
  const [, date, hour, minute] = match;
  try {
    return Temporal.PlainDateTime.from(`${date}T${hour}:${minute}`).toZonedDateTime(timeZone, {
      disambiguation: 'compatible',
    }).epochMilliseconds;
  } catch {
    return undefined;
  }
}
