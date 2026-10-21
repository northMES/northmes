// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { z } from 'zod';
import type { PlantSettingsPreview } from './plant-settings-data.ts';

/**
 * The URL keys of the machines list (design #688, MA1 and ui-222 URL keys): the search in q, the
 * Group and Calendar filters as comma lists of codes and names, Plannable only in plannable=1, and
 * preview, the page state the mock source answers with (MA5 to MA8). Defaults stay out, and a key
 * that does not apply falls back on its own (ADR 0062).
 */
export interface MachineListSearch {
  readonly q?: string;
  readonly group?: readonly string[];
  readonly calendar?: readonly string[];
  readonly plannable?: 1;
  readonly preview?: PlantSettingsPreview;
}

/**
 * The URL keys of the equipment groups list (design #729, EG1): the Scope filter as a comma list
 * of company and plant, and the page state the mock source answers with (EG6 to EG9).
 */
export interface EquipmentGroupListSearch {
  readonly scope?: readonly ('company' | 'plant')[];
  readonly preview?: PlantSettingsPreview;
}

/** The URL keys of a machine's edit page: the page state the mock source answers with (MF1 to MF4). */
export interface MachinePageSearch {
  readonly preview?: PlantSettingsPreview;
}

/** The URL keys of a calendar's page: the first plant date of the week its week view shows. */
export interface CalendarPageSearch {
  readonly week?: string;
  /** The page state the mock source answers with, as on the machines pages. */
  readonly preview?: PlantSettingsPreview;
}

/** A filter key's comma list of picked values, or a validated view's list, each value once. */
function commaList() {
  return z
    .unknown()
    .transform((raw): string[] | undefined => {
      // The router parses each value as JSON, so an all-digit code such as group=100 arrives as a
      // number: it is one value, as a string is.
      const values =
        typeof raw === 'string'
          ? raw.split(',')
          : Array.isArray(raw)
            ? raw
            : typeof raw === 'number' || typeof raw === 'boolean'
              ? [raw]
              : [];
      const picked = [...new Set(values.map(String))].filter(
        (each) => each.length > 0 && each.length <= 64,
      );
      return picked.length === 0 ? undefined : picked;
    })
    .catch(undefined);
}

const preview = z.enum(['loading', 'empty', 'error', 'forbidden']).optional().catch(undefined);

const machineListKeys = z.object({
  q: z
    .union([z.string(), z.number()])
    .transform(String)
    .pipe(z.string().trim().min(1).max(100))
    .optional()
    .catch(undefined),
  group: commaList(),
  calendar: commaList(),
  plannable: z
    .union([z.literal(1), z.literal('1'), z.literal(true)])
    .transform(() => 1 as const)
    .optional()
    .catch(undefined),
  preview,
});

/** The keys of a parsed view without the undefined ones, so an absent key stays out of the URL. */
function defined<View extends object>(view: View): View {
  return Object.fromEntries(
    Object.entries(view).filter(([, value]) => value !== undefined),
  ) as View;
}

export function machineListSearch(raw: Record<string, unknown>): MachineListSearch {
  return defined(machineListKeys.parse(raw));
}

/** A list view as the URL holds it: each filter's picked values as a comma list. */
export function urlSearchOf(
  view: MachineListSearch | EquipmentGroupListSearch,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(view).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.join(',') : value,
    ]),
  );
}

const equipmentGroupListKeys = z.object({
  scope: commaList()
    .transform((values) =>
      values?.filter(
        (value): value is 'company' | 'plant' => value === 'company' || value === 'plant',
      ),
    )
    .transform((values) => (values === undefined || values.length === 0 ? undefined : values)),
  preview,
});

export function equipmentGroupListSearch(raw: Record<string, unknown>): EquipmentGroupListSearch {
  return defined(equipmentGroupListKeys.parse(raw));
}

export function machinePageSearch(raw: Record<string, unknown>): MachinePageSearch {
  const parsed = preview.parse(raw.preview);
  return parsed === undefined ? {} : { preview: parsed };
}

/** The URL keys of the calendars list and a calendar's page: the week and the preview. */
export function calendarPageSearch(raw: Record<string, unknown>): CalendarPageSearch {
  const week = z.iso.date().optional().catch(undefined).parse(raw.week);
  const previewed = preview.parse(raw.preview);
  return {
    ...(week !== undefined && { week }),
    ...(previewed !== undefined && { preview: previewed }),
  };
}
