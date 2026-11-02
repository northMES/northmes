// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// Why an action that needs the server is drawn but disabled while the plant settings pages read the
// fixture G1 (design #688): every page says so in one place, beside its actions.

/** Why the calendar actions are drawn but disabled. */
export const plantSettingsActionReason =
  'Changes to calendars wait for their API; these pages read the fixture G1.';

/** Where the machine pages take what has no API yet. */
export const machineFixtureNote =
  'Calendars, routing operations and job orders show the fixture G1 until they have their API.';

/** Why Save plant is drawn but disabled on the plant page (design #767). */
export const plantSaveReason =
  'Saving waits for the plant API (core.updatePlant, #419); this page reads the fixture G1.';
