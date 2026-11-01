// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { Link } from '@tanstack/react-router';
import { Lock } from 'lucide-react';
import type { PageState } from '../../ui/components/page-frame/index.ts';
import { isForbidden } from '../../ui/lib/graphql-errors.ts';
import { buttonVariants } from '../../ui/primitives/button.tsx';
import type { EquipmentGroup } from './equipment-group.graphql.ts';
import { readForbiddenState } from './no-access.tsx';
import type { Viewer } from './use-viewer.ts';

/** The actions on a group that need a permission where the group sits. */
type GroupAction = 'update' | 'archive';

/**
 * Whether the user may change the group: a company group needs the permission at the company, a
 * plant group at the plant, where a role at the company counts too (ADR 0007). The API checks it
 * again on every change.
 */
export function canChangeGroup(
  viewer: Viewer,
  group: Pick<EquipmentGroup, 'scope'>,
  action: GroupAction,
): boolean {
  const permission = `core.equipmentGroup:${action}`;
  return group.scope === 'company' ? viewer.canAtCompany(permission) : viewer.can(permission);
}

/**
 * The state of a group's page or its edit form (design #729, EG4 and EG5): no access, a failed
 * load, loading until the group and the rest the page shows are in, or a group the plant does not
 * see, with the way back to the list.
 */
export function equipmentGroupPageState({
  plant,
  plantName,
  group,
  restLoaded,
  error,
  retry,
}: {
  readonly plant: string;
  readonly plantName: string;
  /** The group, null for an id the plant does not see, undefined until the answer is in. */
  readonly group: EquipmentGroup | null | undefined;
  /** The rest the page shows is in: the plant's machines and the user's permissions. */
  readonly restLoaded: boolean;
  readonly error: unknown;
  readonly retry: () => Promise<unknown>;
}): PageState {
  if (group === undefined && isForbidden(error)) {
    return readForbiddenState('equipment groups', plantName);
  }
  if (group === undefined && error !== undefined) {
    return {
      status: 'error',
      title: 'Could not load the equipment group',
      error,
      onRetry: retry,
    };
  }
  if (group === undefined || !restLoaded) return { status: 'loading' };
  if (group === null) {
    return {
      status: 'empty',
      title: 'This equipment group does not exist or you cannot see it',
      description: 'The link may be out of date, or the group belongs to another plant.',
      action: (
        <Link
          to={coreLinks.settings.equipmentGroups({ plant }).href}
          className={buttonVariants({ variant: 'outline' })}
        >
          Back to Equipment groups
        </Link>
      ),
    };
  }
  return { status: 'ready' };
}

/** The state of the new group page for a user who may create a group nowhere here. */
export function createGroupForbiddenState(plantName: string): PageState {
  return {
    status: 'empty',
    icon: Lock,
    title: `You need the permission to create equipment groups in ${plantName}`,
    description: 'Ask your plant admin for a role that can create equipment groups.',
  };
}

/** The note on the groups pages while the machines in each group still come from the fixture. */
export const machinesFixtureNote =
  'The machines in each group show the fixture G1 until the machine pages read the API.';
