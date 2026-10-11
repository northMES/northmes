// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@apollo/client/react';
import { coreLinks } from '@northmes/core-contracts';
import { Link, useParams } from '@tanstack/react-router';
import type { PageState } from '../../ui/components/page-frame/index.ts';
import { isForbidden } from '../../ui/lib/graphql-errors.ts';
import { buttonVariants } from '../../ui/primitives/button.tsx';
import { noAccessState } from './no-access.tsx';
import { CoreRole, type CoreRoleQuery } from './role.graphql.ts';
import { usePlaces } from './use-places.ts';

/** A role of the company with who holds it at the company and at its plants. */
export type Role = NonNullable<CoreRoleQuery['coreRole']>;

/** What the role pages read of the role in the URL. */
export interface RoleOfPage {
  /** The role once it loaded, or undefined while it loads, is missing, forbidden or failed. */
  readonly role: Role | undefined;
  /** The page state: loading, no access, not found or an error with Try again. */
  readonly state: PageState;
  /** The page may not be opened: its h1 says "No access to Roles". */
  readonly forbidden: boolean;
  /** Reads the role from the API again and returns its saved values. */
  readonly reload: () => Promise<Role | undefined>;
}

/** Reads the role that the $roleId segment of the URL names, in company settings (ADR 0066). */
export function useRole(): RoleOfPage {
  const places = usePlaces();
  const { roleId, companyId = '' } = useParams({ strict: false });
  const { data, error, refetch } = useQuery(CoreRole, {
    variables: { id: roleId ?? '', companyId },
  });
  const role = data?.coreRole ?? undefined;
  const reload = async () => (await refetch()).data?.coreRole ?? undefined;
  const forbidden = data === undefined && isForbidden(error);
  let state: PageState = { status: 'ready' };
  if (forbidden) {
    const company = places.company?.name ?? 'the company';
    state = noAccessState('Roles', 'core.role:read', company, `a company admin of ${company}`);
  } else if (data === undefined && error !== undefined) {
    state = {
      status: 'error',
      title: 'Could not load the role',
      error,
      onRetry: () => reload(),
    };
  } else if (data === undefined) {
    state = { status: 'loading' };
  } else if (role === undefined) {
    state = {
      status: 'empty',
      title: 'This role does not exist or you cannot see it',
      description: 'The link may be out of date, or the role belongs to another company.',
      action: (
        <Link
          to={coreLinks.settings.roles({ companyId }).href}
          className={buttonVariants({ variant: 'outline' })}
        >
          Back to Roles
        </Link>
      ),
    };
  }
  return { role, state, forbidden, reload };
}
