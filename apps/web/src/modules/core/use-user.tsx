// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@apollo/client/react';
import { coreLinks } from '@northmes/core-contracts';
import { Link, useParams } from '@tanstack/react-router';
import type { PageState } from '../../ui/components/page-frame/index.ts';
import { isForbidden } from '../../ui/lib/graphql-errors.ts';
import { buttonVariants } from '../../ui/primitives/button.tsx';
import { noAccessState } from './no-access.tsx';
import { usePlaces } from './use-places.ts';
import { CoreUser, type CoreUserQuery } from './user.graphql.ts';

/** A user with the roles they hold at the company and at its plants. */
export type User = NonNullable<CoreUserQuery['coreUser']>;

/** One of the user's roles at a place; its role is null when the reader may not read roles. */
export type UserAssignment = User['roleAssignments'][number];

/** What a user's pages read of the user in the URL. */
export interface UserOfPage {
  /** The user once it loaded, or undefined while it loads, is missing, forbidden or failed. */
  readonly user: User | undefined;
  /** The page state: loading, no access, not found or an error with Try again. */
  readonly state: PageState;
  /** The page may not be opened: its h1 says "No access to Users". */
  readonly forbidden: boolean;
  /** The API refused the roles of the answer, because the reader may not read roles (NO5). */
  readonly rolesForbidden: boolean;
}

/**
 * Reads the user that the $userId segment of the URL names, in the company of company settings
 * (ADR 0066), or at the plant of plant settings with their roles at the plant and its company. A role the reader may not read comes as null beside a FORBIDDEN error, so the answer
 * keeps its data (errorPolicy all).
 */
export function useUser(): UserOfPage {
  const places = usePlaces();
  const { userId, companyId, plant } = useParams({ strict: false });
  const { data, error, refetch } = useQuery(CoreUser, {
    variables: { id: userId ?? '', ...(companyId !== undefined && { companyId }) },
    errorPolicy: 'all',
  });
  const user = data?.coreUser ?? undefined;
  const forbidden = user === undefined && isForbidden(error);
  let state: PageState = { status: 'ready' };
  if (forbidden && plant !== undefined) {
    state = noAccessState('People', 'core.user:read', places.plant?.name ?? plant);
  } else if (forbidden) {
    const company = places.company?.name ?? 'the company';
    state = noAccessState('Users', 'core.user:read', company, `a company admin of ${company}`);
  } else if (data === undefined && error !== undefined) {
    state = {
      status: 'error',
      title: 'Could not load the user',
      error,
      onRetry: () => refetch(),
    };
  } else if (data === undefined) {
    state = { status: 'loading' };
  } else if (user === undefined) {
    state = {
      status: 'empty',
      title: 'This user does not exist or you cannot see it',
      description: 'The link may be out of date, or the user belongs to another company.',
      action:
        plant !== undefined ? (
          <Link
            to={coreLinks.people({ plant }).href}
            className={buttonVariants({ variant: 'outline' })}
          >
            Back to People
          </Link>
        ) : (
          <Link
            to={coreLinks.settings.users({ companyId: companyId ?? '' }).href}
            className={buttonVariants({ variant: 'outline' })}
          >
            Back to Users
          </Link>
        ),
    };
  }
  return { user, state, forbidden, rolesForbidden: user !== undefined && isForbidden(error) };
}
