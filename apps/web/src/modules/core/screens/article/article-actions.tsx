// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation } from '@apollo/client/react';
import { Archive, ArchiveRestore } from 'lucide-react';
import { ConfirmDialog } from '../../../../ui/components/confirm-dialog/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { Button } from '../../../../ui/primitives/button.tsx';
import type { Article } from '../../article.graphql.ts';
import { commandFailure, hasErrorCode } from '../../components/article-form/index.ts';
import { CoreRestoreArticle } from '../../restore-article.graphql.ts';
import { CoreArchiveArticle } from './archive-article.graphql.ts';

interface ArticleActionProps {
  readonly article: Article;
  /** Reads the article from the API again, after a change was refused for a stale version. */
  readonly reload: () => Promise<Article | undefined>;
}

/** The page's only h1, which takes focus after a confirmed archive or restore. */
const pageHeading = () => document.querySelector<HTMLElement>('h1');

/**
 * The message of a failed archive or restore. A stale version reloads the article first, so the
 * next try sends the version the page now shows; another refusal shows the API's message, and no
 * answer asks to check the connection.
 */
async function refusal(
  error: unknown,
  verb: 'archive' | 'restore',
  reload: () => Promise<Article | undefined>,
): Promise<Error> {
  if (hasErrorCode(error, 'core.version_conflict')) {
    await reload().catch(() => undefined);
    return new Error(
      `Someone changed this article after you opened it. The page now shows the saved article. Check it, then ${verb} it again.`,
    );
  }
  return new Error(commandFailure(error, verb));
}

/**
 * Archive in the page actions (design ui-222, DE1 and DE23): ConfirmDialog asks first, then the
 * command core.archiveArticle archives the article with the version the page shows. Focus moves to
 * the h1, where the page now offers Restore, and the polite region says "Article AX-500 archived".
 */
export function ArchiveArticleAction({ article, reload }: ArticleActionProps) {
  const [archive] = useMutation(CoreArchiveArticle);
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline">
          <Archive aria-hidden />
          Archive
        </Button>
      }
      title={`Archive article ${article.code}?`}
      description="Archived articles are hidden from lists and cannot be changed until restored. Orders that use it keep it."
      confirmLabel="Archive article"
      focusAfterConfirm={pageHeading}
      onConfirm={async () => {
        try {
          await archive({
            variables: { input: { id: article.id, expectedVersion: article.version } },
          });
        } catch (error) {
          throw await refusal(error, 'archive', reload);
        }
        announce(`Article ${article.code} archived`);
      }}
    />
  );
}

/**
 * Restore on an archived article's page (design ui-222, DE27): ConfirmDialog asks first, then the
 * command core.restoreArticle restores the article, the page offers Edit again, and the polite
 * region says "Article AX-500 restored".
 */
export function RestoreArticleAction({ article, reload }: ArticleActionProps) {
  const [restore] = useMutation(CoreRestoreArticle);
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline">
          <ArchiveRestore aria-hidden />
          Restore
        </Button>
      }
      title={`Restore article ${article.code}?`}
      description="The article shows in lists again and can be changed again."
      confirmLabel="Restore article"
      focusAfterConfirm={pageHeading}
      onConfirm={async () => {
        try {
          await restore({
            variables: { input: { id: article.id, expectedVersion: article.version } },
          });
        } catch (error) {
          throw await refusal(error, 'restore', reload);
        }
        announce(`Article ${article.code} restored`);
      }}
    />
  );
}
