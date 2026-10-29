// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { Link } from '@tanstack/react-router';
import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import type { PageState } from '../../ui/components/page-frame/index.ts';
import { buttonVariants } from '../../ui/primitives/button.tsx';
import { PlantSettingsForbidden } from './plant-settings-data.ts';

/** The no-access title of the equipment groups pages (design #729, EG9). */
export const groupsForbiddenTitle = 'You need the permission to manage the settings of this plant';

/** The no-access description of the equipment groups pages. */
export const groupsForbiddenDescription =
  'Ask your plant admin for a role that manages plant settings.';

/**
 * The state of a group's page or its edit form (design #729, EG4 and EG5): no access, a failed
 * load, loading, or a group the snapshot does not hold, with the way back to the list.
 */
export function equipmentGroupPageState({
  plant,
  loaded,
  found,
  error,
  retry,
  forbiddenAction,
}: {
  readonly plant: string;
  readonly loaded: boolean;
  readonly found: boolean;
  readonly error: unknown;
  readonly retry: () => Promise<unknown>;
  /** The way out of the no-access state, such as back to the group's page. */
  readonly forbiddenAction?: ReactNode;
}): PageState {
  if (!loaded && error instanceof PlantSettingsForbidden) {
    return {
      status: 'empty',
      icon: Lock,
      title: groupsForbiddenTitle,
      description: groupsForbiddenDescription,
      ...(forbiddenAction !== undefined && { action: forbiddenAction }),
    };
  }
  if (!loaded && error !== undefined) {
    return {
      status: 'error',
      title: 'Could not load the equipment group',
      error,
      onRetry: retry,
    };
  }
  if (!loaded) return { status: 'loading' };
  if (!found) {
    return {
      status: 'empty',
      title: 'This equipment group does not exist or you cannot see it',
      description: 'The link may be out of date, or the group belongs to another plant.',
      action: (
        <Link
          to={coreLinks.equipmentGroups({ plant }).href}
          className={buttonVariants({ variant: 'outline' })}
        >
          Back to Equipment groups
        </Link>
      ),
    };
  }
  return { status: 'ready' };
}
