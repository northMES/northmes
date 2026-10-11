// SPDX-License-Identifier: AGPL-3.0-or-later
import { useLazyQuery } from '@apollo/client/react';
import { RemoveRole, roleLoss } from '../../components/remove-role/index.ts';
import { usePlaces } from '../../use-places.ts';
import { CoreUser } from '../../user.graphql.ts';
import type { PlantAssignment } from './plant-role-assignments.graphql.ts';

/**
 * Remove on a row of People (design core-304, AS7): when the dialog opens it reads the person's
 * roles at the plant and the company, so it names what the person loses at the plant and what the
 * person's other roles keep. Until they load, the dialog claims nothing about what is kept.
 */
export function PeopleRemove({
  assignment,
  label,
  focusAfter,
}: {
  readonly assignment: PlantAssignment;
  readonly label: string;
  readonly focusAfter: () => HTMLElement | null;
}) {
  const places = usePlaces();
  const [read, { data }] = useLazyQuery(CoreUser);
  const roles = data?.coreUser?.roleAssignments;
  const loss = roles === undefined ? {} : roleLoss(assignment, roles, assignment.user.name);
  return (
    <RemoveRole
      person={assignment.user}
      assignment={assignment}
      label={label}
      focusAfter={focusAfter}
      {...loss}
      onOpen={() => {
        if (places.company !== undefined) {
          void read({ variables: { id: assignment.user.id, companyId: places.company.id } });
        }
      }}
    />
  );
}
