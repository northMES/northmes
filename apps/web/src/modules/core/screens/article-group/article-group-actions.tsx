// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { useMutation } from '@apollo/client/react';
import { Archive, ArchiveRestore } from 'lucide-react';
import { ConfirmDialog } from '../../../../ui/components/confirm-dialog/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { hasErrorCode, refusalMessage } from '../../../../ui/lib/graphql-errors.ts';
import { Button } from '../../../../ui/primitives/button.tsx';
import { CoreArticleGroups } from '../../article-groups.graphql.ts';
import { useViewer } from '../../use-viewer.ts';
import { CoreArchiveArticleGroup } from './archive-article-group.graphql.ts';
import type { ArticleGroup } from './article-group.graphql.ts';
import { CoreRestoreArticleGroup } from './restore-article-group.graphql.ts';

/** The page's only h1, which takes focus after a confirmed archive or restore. */
const pageHeading = () => document.querySelector<HTMLElement>('h1');

/** The message of a failed archive or restore. */
function refusal(error: unknown, verb: 'archive' | 'restore'): Error {
  if (hasErrorCode(error, 'core.version_conflict')) {
    return new Error(
      `Someone changed this article group after you opened it. Reload the page, then ${verb} it again.`,
    );
  }
  if (hasErrorCode(error, 'core.forbidden')) {
    return new Error(
      `You do not have permission to ${verb} article groups. They belong to the company, so it needs the permission there.`,
    );
  }
  const reasons = refusalMessage(error);
  return new Error(
    reasons === undefined
      ? `Could not ${verb} the article group. Check the connection, then try again.`
      : `Could not ${verb} the article group. ${reasons}`,
  );
}

/**
 * The group page's actions for a holder of core.articleGroup:archive at the company: Archive on an
 * active group, Restore on an archived one, each asked first with ConfirmDialog (design ui-222,
 * DE23 and DE27). The polite region says "Article group FL archived" or "restored".
 */
export function ArticleGroupActions({ group }: { readonly group: ArticleGroup }) {
  const viewer = useViewer();
  const options = { refetchQueries: [CoreArticleGroups] };
  const [archive] = useMutation(CoreArchiveArticleGroup, options);
  const [restore] = useMutation(CoreRestoreArticleGroup, options);
  if (!viewer.canAtCompany('core.articleGroup:archive')) return null;
  const input = { id: group.id, expectedVersion: group.version };
  if (group.archivedAt !== null) {
    return (
      <ConfirmDialog
        trigger={
          <Button variant="outline">
            <ArchiveRestore aria-hidden />
            Restore
          </Button>
        }
        title={`Restore article group ${group.code}?`}
        description="The group shows in lists again, and articles can pick it again."
        confirmLabel="Restore article group"
        focusAfterConfirm={pageHeading}
        onConfirm={async () => {
          try {
            await restore({ variables: { input } });
          } catch (error) {
            throw refusal(error, 'restore');
          }
          announce(`Article group ${group.code} restored`);
        }}
      />
    );
  }
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline">
          <Archive aria-hidden />
          Archive
        </Button>
      }
      title={`Archive article group ${group.code}?`}
      description="Archived groups are hidden from lists, and no article can pick them. Articles that have the group keep it."
      confirmLabel="Archive article group"
      focusAfterConfirm={pageHeading}
      onConfirm={async () => {
        try {
          await archive({ variables: { input } });
        } catch (error) {
          throw refusal(error, 'archive');
        }
        announce(`Article group ${group.code} archived`);
      }}
    />
  );
}
