// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// shared-candidate: #66
import { Archive, ArchiveRestore } from 'lucide-react';
import { ConfirmDialog } from '../../../ui/components/confirm-dialog/index.ts';
import { announce } from '../../../ui/lib/announce.ts';
import { hasErrorCode, refusalMessage } from '../../../ui/lib/graphql-errors.ts';
import { Button } from '../../../ui/primitives/button.tsx';

/** The page's only h1, which takes focus after a confirmed archive or restore. */
const pageHeading = () => document.querySelector<HTMLElement>('h1');

export interface RegisterArchiveActionsProps {
  /** The register's label, such as "equipment group". */
  readonly label: string;
  readonly code: string;
  readonly archived: boolean;
  /** Sends the archive with the row's version. */
  readonly archive: () => Promise<unknown>;
  /** Sends the restore with the row's version. */
  readonly restore: () => Promise<unknown>;
  /** What an archive does to the row, as the dialog says it. */
  readonly archiveDescription: string;
  /** What a restore does to the row. */
  readonly restoreDescription: string;
  /** Why the user may not archive or restore, as a refusal with core.forbidden says it. */
  readonly forbidden: (verb: 'archive' | 'restore') => string;
}

/** The message of a failed archive or restore of a register's row. */
function refusal(
  error: unknown,
  verb: 'archive' | 'restore',
  { label, forbidden }: Pick<RegisterArchiveActionsProps, 'label' | 'forbidden'>,
): Error {
  if (hasErrorCode(error, 'core.version_conflict')) {
    return new Error(
      `Someone changed this ${label} after you opened it. Reload the page, then ${verb} it again.`,
    );
  }
  if (hasErrorCode(error, 'core.forbidden')) return new Error(forbidden(verb));
  const reasons = refusalMessage(error);
  return new Error(
    reasons === undefined
      ? `Could not ${verb} the ${label}. Check the connection, then try again.`
      : `Could not ${verb} the ${label}. ${reasons}`,
  );
}

/**
 * A register row's Archive on an active row and Restore on an archived one (ADR 0022), each asked
 * first with ConfirmDialog, as the article group's page does (design ui-222, DE23 and DE27). A
 * refusal keeps the dialog open with its reason; a confirmed change gives focus to the h1, and the
 * polite region says "Equipment group MACH archived" or "restored". The page shows it only to a
 * user who may archive the row.
 */
export function RegisterArchiveActions(props: RegisterArchiveActionsProps) {
  const { label, code, archived } = props;
  const title = `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
  const verb = archived ? 'restore' : 'archive';
  const run = archived ? props.restore : props.archive;
  const Icon = archived ? ArchiveRestore : Archive;
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline">
          <Icon aria-hidden />
          {archived ? 'Restore' : 'Archive'}
        </Button>
      }
      title={`${archived ? 'Restore' : 'Archive'} ${label} ${code}?`}
      description={archived ? props.restoreDescription : props.archiveDescription}
      confirmLabel={`${archived ? 'Restore' : 'Archive'} ${label}`}
      focusAfterConfirm={pageHeading}
      onConfirm={async () => {
        try {
          await run();
        } catch (error) {
          throw refusal(error, verb, props);
        }
        announce(`${title} ${code} ${archived ? 'restored' : 'archived'}`);
      }}
    />
  );
}
