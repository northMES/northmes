// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { Tool, ToolsSnapshot } from './tools-data.ts';

/** The tools a plant sees: the company's and its own (ADR 0009); another plant's stay out. */
export function toolsAt(snapshot: ToolsSnapshot, plant: string): Tool[] {
  return snapshot.tools.filter(
    (tool) => tool.scope.kind === 'company' || tool.scope.plant === plant,
  );
}
