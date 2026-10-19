// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Lock } from 'lucide-react';
import type { PageState } from '../../ui/components/page-frame/index.ts';

/**
 * The state of a plant settings page whose read the source refused (design #688, MA8; ui-222,
 * ST19): Lock, the permission in plain words at this plant, and who can give it. The page keeps
 * its h1 and shows no data and no actions.
 */
export function plantSettingsForbiddenState(noun: string): PageState {
  return {
    status: 'empty',
    icon: Lock,
    title: `You need the permission to read ${noun} at this plant`,
    description: `Ask your plant admin for a role that can read ${noun}.`,
  };
}
