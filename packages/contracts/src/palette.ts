// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { z } from 'zod';

/** The colors of the planning palette, palette-1 to palette-20, as the UI tokens name them. */
export const paletteColors = Array.from({ length: 20 }, (_, index) => `palette-${index + 1}`) as [
  string,
  ...string[],
];

/** One color of the planning palette (ADR 0022). */
export const paletteColor = z.enum(paletteColors);
