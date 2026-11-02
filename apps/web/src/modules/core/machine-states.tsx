// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { Link } from '@tanstack/react-router';
import { Lock } from 'lucide-react';
import type { PageState } from '../../ui/components/page-frame/index.ts';
import { isForbidden } from '../../ui/lib/graphql-errors.ts';
import { buttonVariants } from '../../ui/primitives/button.tsx';
import type { Machine } from './equipment.graphql.ts';
import { isGroupId } from './equipment-group-states.tsx';
import { readForbiddenState } from './no-access.tsx';

/** Whether a route's machine segment is an id; an old link by code is none (ADR 0062). */
export const isMachineId = isGroupId;

/**
 * The state of a machine's page or its edit form (design #688, MA3, MA4 and MF1 to MF4): no
 * access, a failed load of the machine or of the user's permissions, loading until the machine and
 * the rest the page shows are in, or a machine the plant does not have, with the way back.
 */
export function machinePageState({
  plant,
  plantName,
  machine,
  restLoaded,
  error,
  retry,
}: {
  readonly plant: string;
  readonly plantName: string;
  /** The machine, null for an id the plant does not have, undefined until the answer is in. */
  readonly machine: Machine | null | undefined;
  /** The rest the page shows is in: the fixture's calendars and the user's permissions. */
  readonly restLoaded: boolean;
  /** The error of the machine's read, or of the user's permissions. */
  readonly error: unknown;
  /** Asks again for whatever failed. */
  readonly retry: () => Promise<unknown>;
}): PageState {
  if (machine === undefined && isForbidden(error)) {
    return readForbiddenState('machines', plantName);
  }
  if (error !== undefined && (machine === undefined || !restLoaded)) {
    return { status: 'error', title: 'Could not load the machine', error, onRetry: retry };
  }
  if (machine === undefined || !restLoaded) return { status: 'loading' };
  if (machine === null) {
    return {
      status: 'empty',
      title: 'This machine does not exist or you cannot see it',
      description:
        'The link may be out of date, or the machine belongs to a plant you have no role in.',
      action: (
        <Link
          to={coreLinks.settings.machines({ plant }).href}
          className={buttonVariants({ variant: 'outline' })}
        >
          Back to Machines
        </Link>
      ),
    };
  }
  return { status: 'ready' };
}

/** The state of the new machine page for a user who may not create machines here. */
export function createMachineForbiddenState(plantName: string): PageState {
  return {
    status: 'empty',
    icon: Lock,
    title: `You need the permission to create machines in ${plantName}`,
    description: 'Ask your plant admin for a role that can create machines.',
  };
}
