// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The seam between the plant settings pages (machines, machine, calendars; design #688) and their
// data: a source answers one snapshot of the plant's equipment, routings, calendars and the week's
// job orders in epoch milliseconds. The pages never know which source they have. The first source
// is the fixture G1 of @northmes/planning-domain with the pages fixture beside it; the GraphQL
// source of core's equipment and calendars replaces it value by value.

/** Who owns a record's master fields: the ERP through the connector, or NorthMES itself. */
export type PlantRecordOwner = 'erp' | 'northmes';

export interface PlantEquipmentGroup {
  readonly code: string;
  readonly name: string;
  /** The group's color, a palette token name such as palette-3: its band on the board. */
  readonly color: string;
}

export interface PlantMachine {
  readonly code: string;
  readonly name: string;
  /** The group's code. */
  readonly group: string;
  readonly isPlannable: boolean;
  /** The name of the machine's calendar; none for a machine that is not on the board. */
  readonly calendar: string | null;
  readonly owner: PlantRecordOwner;
}

export interface PlantRoutingOperation {
  readonly sequence: number;
  readonly name: string;
  readonly allowedEquipment: readonly string[];
}

/** A routing as planning reads it: the article's operations and their allowed machines. */
export interface PlantRouting {
  readonly article: string;
  readonly version: number;
  readonly operations: readonly PlantRoutingOperation[];
}

/** A job order of the committed plan, as the machine page lists its week. */
export interface PlantJobOrder {
  readonly id: string;
  readonly displayNumber: string;
  readonly operationName: string;
  readonly orderId: string;
  readonly orderNumber: string;
  readonly article: string;
  readonly equipment: string;
  readonly setupStartMs: number;
  readonly endMs: number;
  readonly quantity: number;
  readonly status: string;
}

/** A deviation as the plant admin entered it (ADR 0025). */
export interface PlantCalendarDeviation {
  readonly id: string;
  readonly kind: 'overtime' | 'nonWorking';
  /** The plant-local start and end, "2026-11-07T06:00". */
  readonly startsLocal: string;
  readonly endsLocal: string;
  readonly reason?: string;
  /** The machines it applies to; none means plant-wide. */
  readonly equipment?: readonly string[];
  readonly addedBy?: string;
  readonly addedAtMs?: number;
}

/** A clock span of the plant, "06:00" to "14:00"; an end at or before the start is on the next date. */
export interface PlantClockSpan {
  readonly start: string;
  readonly end: string;
}

/** A shift of a calendar version (ADR 0025, `calendar_shift`): its name, days, times and breaks. */
export interface PlantShift extends PlantClockSpan {
  readonly name: string;
  /** ISO weekdays, 1 for Monday to 7 for Sunday, that the shift starts on. */
  readonly weekdays: readonly number[];
  readonly breaks: readonly PlantClockSpan[];
  /** The working seconds of one shift: its length minus its breaks. */
  readonly workingSeconds: number;
}

/** A working-time calendar of the plant (ADR 0025): its shifts and their breaks on the weekdays. */
export interface PlantCalendar {
  readonly name: string;
  /** The plant calendar, which a machine uses by default. */
  readonly plantDefault: boolean;
  /** The plant date the version in effect started on. */
  readonly effectiveFrom: string;
  readonly cycleWeeks: number;
  /** In the version's order, which also orders their colors on the week view (#770). */
  readonly shifts: readonly PlantShift[];
  /** The codes of the machines on this calendar. */
  readonly machines: readonly string[];
  readonly deviations: readonly PlantCalendarDeviation[];
}

export interface PlantSettingsSnapshot {
  /** The id of the fixture a mock source answers with, such as G1; a server source sets none. */
  readonly fixture?: string;
  readonly plant: {
    readonly slug: string;
    /** The name a page shows, such as Plant A. */
    readonly name: string;
    readonly timeZone: string;
    readonly productionDayStart: string;
  };
  readonly nowMs: number;
  /** The ERP connection as configured in Settings: its name is a value, never part of a label. */
  readonly erp?: { readonly name: string; readonly importedAtMs: number };
  readonly equipmentGroups: readonly PlantEquipmentGroup[];
  readonly equipment: readonly PlantMachine[];
  readonly routings: readonly PlantRouting[];
  readonly jobOrders: readonly PlantJobOrder[];
  readonly calendars: readonly PlantCalendar[];
}

/**
 * A page state the product owner can open on mock data (design #688, MA5 to MA8 and MF1 to MF4;
 * design #767, PP4 to PP7): the mock source answers it instead of the fixture; a server source
 * ignores it. noCalendar is the plant before its first calendar version, whose zone and production
 * day start may still change (ADR 0066).
 */
export type PlantSettingsPreview = 'loading' | 'empty' | 'error' | 'forbidden' | 'noCalendar';

export interface PlantSettingsLoadInput {
  readonly preview?: PlantSettingsPreview;
}

/** Where the plant settings pages read from. */
export interface PlantSettingsSource {
  readonly load: (input: PlantSettingsLoadInput) => Promise<PlantSettingsSnapshot>;
}

/** The refusal a source answers a forbidden preview with, as the API's FORBIDDEN would arrive. */
export class PlantSettingsForbidden extends Error {
  constructor() {
    super('Forbidden');
    this.name = 'PlantSettingsForbidden';
  }
}
