// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// Why an action that needs the planning server is drawn but disabled while the planning pages read
// the fixture G1 (plan 18, phase 1): every page says so in one place, under its actions.

/** Why the fields and the actions of phase 1 are drawn but disabled (plan 18, phase 1). */
export const phase1Reason =
  'Moves and changes come with the live data; this view reads the fixture G1.';

/** Why Plan this order and Move all later by are drawn but disabled (plan 18, phase 2). */
export const planReason =
  'Plan this order and Move all later by wait for plan() in the planning domain.';

/** Why a form's Save is drawn but disabled on the pages that read the fixture. */
export const saveReason = 'Saving waits for the planning server; this page reads the fixture G1.';

/** Where an order entered by hand stays on the lists that read the fixture (#768). */
export const createReason =
  'Orders entered by hand stay in this browser tab until the planning server exists; this list reads the fixture G1.';
