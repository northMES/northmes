// SPDX-License-Identifier: AGPL-3.0-or-later

/** Two digits, with a leading zero. */
function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * A point in time as lists show it, "2026-10-05 14:07", in the browser's time zone (design
 * ui-222, Last changed). The plant's time zone and its zone label come with the plant's
 * presentation settings.
 */
export function formatDateTime(iso: string): string {
  const time = new Date(iso);
  if (Number.isNaN(time.getTime())) return iso;
  const date = `${time.getFullYear()}-${twoDigits(time.getMonth() + 1)}-${twoDigits(time.getDate())}`;
  return `${date} ${twoDigits(time.getHours())}:${twoDigits(time.getMinutes())}`;
}
