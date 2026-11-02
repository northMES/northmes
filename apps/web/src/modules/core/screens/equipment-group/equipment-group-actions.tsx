// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { ApolloCache } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import type { EquipmentGroup } from '../../equipment-group.graphql.ts';
import { canChangeGroup } from '../../equipment-group-states.tsx';
import { RegisterArchiveActions } from '../../master-data/register-archive-actions.tsx';
import { useViewer } from '../../use-viewer.ts';
import { CoreArchiveEquipmentGroup } from './archive-equipment-group.graphql.ts';
import { CoreRestoreEquipmentGroup } from './restore-equipment-group.graphql.ts';

/**
 * The group page's Archive on an active group and Restore on an archived one, for a holder of
 * core.equipmentGroup:archive where the group sits: at the company for a company group, at the
 * plant for the plant's own.
 */
export function EquipmentGroupActions({ group }: { readonly group: EquipmentGroup }) {
  const viewer = useViewer();
  // The group's page shows the answer; the lists read the groups again when they next open.
  const options = {
    update: (cache: ApolloCache) => {
      cache.evict({ fieldName: 'coreEquipmentGroups' });
      cache.gc();
    },
  };
  const [archive] = useMutation(CoreArchiveEquipmentGroup, options);
  const [restore] = useMutation(CoreRestoreEquipmentGroup, options);
  if (!canChangeGroup(viewer, group, 'archive')) return null;
  const variables = { input: { id: group.id, expectedVersion: group.version } };
  return (
    <RegisterArchiveActions
      label="equipment group"
      code={group.code}
      archived={group.archivedAt !== null}
      archive={() => archive({ variables })}
      restore={() => restore({ variables })}
      archiveDescription="Archived groups are hidden from the list. No machine can join an archived group; the machines in it keep it."
      restoreDescription="The group shows in the list again, and machines can join it again."
      forbidden={(verb) =>
        group.scope === 'company'
          ? `You do not have permission to ${verb} company equipment groups. They belong to the company, so it needs the permission there.`
          : `You do not have permission to ${verb} equipment groups at this plant.`
      }
    />
  );
}
