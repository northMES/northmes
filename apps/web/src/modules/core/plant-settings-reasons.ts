// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// Why an action that needs the server is drawn but disabled while the plant settings pages read the
// fixture G1 (design #688): every page says so in one place, beside its actions.

/** Why Save machine is drawn but disabled on the machine form. */
export const machineSaveReason =
  'Saving waits for the equipment API; this form reads the fixture G1.';

/** Why New machine, New equipment group, Archive and the calendar actions are drawn but disabled. */
export const plantSettingsActionReason =
  'Changes to machines, groups and calendars wait for the equipment API; these pages read the fixture G1.';
