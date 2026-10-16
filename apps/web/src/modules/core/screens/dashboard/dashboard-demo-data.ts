// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic

/**
 * Fictional data for the demo widgets of release 1 (design shell-454, question 15). Each widget's
 * numbers follow from its id, so a widget shows the same data on every load and two copies of one
 * type show different data. Widgets with real data come later from modules and plugins.
 */

/** A number from 0 up to 1 that follows from the seed and the index. */
function noise(seed: string, index: number): number {
  let hash = 2166136261 ^ index;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1000) / 1000;
}

/** A Value widget's one number. */
export function demoValue(seed: string): number {
  return Math.round(noise(seed, 0) * 40);
}

/** A List widget's entries: fictional production orders with their article. */
export function demoListItems(
  seed: string,
): { readonly order: string; readonly article: string }[] {
  const articles = ['Wall bracket', 'Side panel', 'Hinge pin', 'Flange 80 mm', 'Axle 40 mm'];
  return Array.from({ length: 4 }, (_, index) => ({
    order: `DEMO-${1000 + Math.round(noise(seed, index + 1) * 8999)}`,
    article: articles[Math.floor(noise(seed, index + 11) * articles.length)] ?? 'Wall bracket',
  }));
}

/** A Table widget's rows: fictional stops with their machine, reason and minutes. */
export function demoTableRows(
  seed: string,
): { readonly machine: string; readonly reason: string; readonly minutes: number }[] {
  const machines = ['Mill 1', 'Mill 2', 'Press 4', 'Lathe 3'];
  const reasons = ['Tool change', 'Material missing', 'Setup', 'Breakdown'];
  return Array.from({ length: 3 }, (_, index) => ({
    machine: machines[Math.floor(noise(seed, index + 21) * machines.length)] ?? 'Mill 1',
    reason: reasons[Math.floor(noise(seed, index + 31) * reasons.length)] ?? 'Setup',
    minutes: 5 + Math.round(noise(seed, index + 41) * 55),
  }));
}

/** A Chart widget's bars: a fictional count for each of five days. */
export function demoChartBars(seed: string): { readonly label: string; readonly value: number }[] {
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((label, index) => ({
    label,
    value: 40 + Math.round(noise(seed, index + 51) * 160),
  }));
}
