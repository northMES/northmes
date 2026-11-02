// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// Why an action that needs the server is drawn but disabled while the plant settings pages read the
// fixture G1 (design #688): every page says so in one place, beside its actions.

/** Why Save machine is drawn but disabled on the machine form. */
export const machineSaveReason =
  'Saving waits for the equipment API; this form reads the fixture G1.';

/** Why New machine, Archive and the calendar actions are drawn but disabled. */
export const plantSettingsActionReason =
  'Changes to machines and calendars wait for their API; these pages read the fixture G1.';

/** Why Save plant is drawn but disabled on the plant page (design #767). */
export const plantSaveReason =
  'Saving waits for the plant API (core.updatePlant, #419); this page reads the fixture G1.';
