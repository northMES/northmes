// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { ApolloCache } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import type { Machine } from '../../equipment.graphql.ts';
import { RegisterArchiveActions } from '../../master-data/register-archive-actions.tsx';
import { useViewer } from '../../use-viewer.ts';
import { CoreArchiveEquipment } from './archive-machine.graphql.ts';
import { CoreRestoreEquipment } from './restore-machine.graphql.ts';

/** The machine page's Archive on an active machine and Restore on an archived one. */
export function MachineActions({ machine }: { readonly machine: Machine }) {
  const viewer = useViewer();
  // The machine's page shows the answer; the lists read the machines again when they next open.
  const options = {
    update: (cache: ApolloCache) => {
      cache.evict({ fieldName: 'coreEquipmentList' });
      cache.gc();
    },
  };
  const [archive] = useMutation(CoreArchiveEquipment, options);
  const [restore] = useMutation(CoreRestoreEquipment, options);
  if (!viewer.can('core.equipment:archive')) return null;
  const variables = { input: { id: machine.id, expectedVersion: machine.version } };
  return (
    <RegisterArchiveActions
      label="machine"
      code={machine.code}
      archived={machine.archivedAt !== null}
      archive={() => archive({ variables })}
      restore={() => restore({ variables })}
      archiveDescription="An archived machine leaves the board and the list, and keeps its code."
      restoreDescription="The machine shows in the list again, and on the board when it is plannable."
      forbidden={(verb) => `You do not have permission to ${verb} machines at this plant.`}
    />
  );
}
