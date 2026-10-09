// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation } from '@apollo/client/react';
import { coreLinks, updateArticle } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { useNavigate } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { PageFrame } from '../../../../ui/components/page-frame/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { fieldId } from '../../../../ui/lib/field-id.ts';
import { useZodForm } from '../../../../ui/lib/use-zod-form.ts';
import type { Article } from '../../article.graphql.ts';
import {
  ArticleForm,
  type ArticleValues,
  commandFailure,
  hasErrorCode,
  showSaveError,
} from '../../components/article-form/index.ts';
import { CoreRestoreArticle } from '../../restore-article.graphql.ts';
import { useArticle } from '../../use-article.tsx';
import { CoreUpdateArticle } from './update-article.graphql.ts';

interface EditArticleFormProps {
  readonly article: Article;
  readonly reload: () => Promise<Article | undefined>;
}

/**
 * The form of an article as it was when the page opened. Save sends the version the form was
 * filled from as expectedVersion, so a change someone saved in between is refused with
 * core.version_conflict (ADR 0017), not overwritten.
 */
function EditArticleForm({ article, reload }: EditArticleFormProps) {
  const { plant } = useShell();
  const navigate = useNavigate();
  // The version the form was filled from; only a save reads it, so it is no render state.
  const expectedVersion = useRef(article.version);
  const [conflict, setConflict] = useState(false);
  // An archived article refuses changes, so its form offers Restore article (DE31).
  const [archived, setArchived] = useState(article.archivedAt !== null);
  const form = useZodForm(updateArticle.fields, {
    defaultValues: { code: article.code, name: article.name },
  });
  const [update] = useMutation(CoreUpdateArticle);
  const [restore] = useMutation(CoreRestoreArticle);

  const save = async (values: ArticleValues) => {
    setConflict(false);
    setArchived(false);
    try {
      const { data } = await update({
        variables: {
          input: { id: article.id, expectedVersion: expectedVersion.current, ...values },
        },
      });
      if (!data) return;
      announce(`Article ${data.coreUpdateArticle.code} saved`);
      await navigate({
        to: coreLinks.articles.article({ plant, articleId: article.id }).href,
        replace: true,
      });
    } catch (error) {
      if (hasErrorCode(error, 'core.version_conflict')) {
        setConflict(true);
        return;
      }
      if (hasErrorCode(error, 'core.archived')) {
        setArchived(true);
        return;
      }
      showSaveError(form, error, values);
    }
  };

  // Reload article: the saved values and their version replace the typed ones, and focus moves to
  // the first field, where the change starts again.
  const onReload = async () => {
    let saved: Article | undefined;
    try {
      saved = await reload();
    } catch {
      // The conflict stays, and its summary lists the failure with the typed values kept.
      form.setError('root.server', {
        message: 'Could not reload the article. Check the connection, then try again.',
      });
      return;
    }
    if (saved === undefined) return;
    form.reset({ code: saved.code, name: saved.name });
    expectedVersion.current = saved.version;
    setConflict(false);
    // reset drops the field refs that setFocus reads until the next render, so focus goes by id.
    document.getElementById(fieldId('code'))?.focus();
  };

  // Restore article: reads the saved article and restores it with its version. When its saved
  // values are still the ones the form was filled from, the typed values go on from the restored
  // version; otherwise someone changed it meanwhile, which the version conflict shows. The typed
  // values stay, so no form.reset clears the failure of an earlier try: clearErrors does.
  const onRestore = async () => {
    form.clearErrors('root.server');
    let restored: Article | undefined;
    try {
      const saved = await reload();
      if (saved === undefined) return;
      restored = saved;
      if (saved.archivedAt !== null) {
        const { data } = await restore({
          variables: { input: { id: article.id, expectedVersion: saved.version } },
        });
        if (!data) return;
        restored = data.coreRestoreArticle;
        announce(`Article ${restored.code} restored`);
      }
    } catch (error) {
      form.setError('root.server', { message: commandFailure(error, 'restore') });
      return;
    }
    setArchived(false);
    const filledFrom = form.formState.defaultValues;
    if (restored.code !== filledFrom?.code || restored.name !== filledFrom?.name) {
      setConflict(true);
      return;
    }
    expectedVersion.current = restored.version;
    document.getElementById(fieldId('code'))?.focus();
  };

  return (
    <ArticleForm
      form={form}
      onSave={save}
      cancelHref={coreLinks.articles.article({ plant, articleId: article.id }).href}
      conflict={conflict ? { onReload } : undefined}
      archived={archived ? { onRestore } : undefined}
    />
  );
}

/**
 * The edit page of an article (design ui-222, DE7): the article form filled in, validated with
 * the contract of core.updateArticle. A saved change opens the article's page in place of the form
 * and the polite region says "Article AX-500 saved"; a version conflict keeps the typed values and
 * offers Reload article (DE19), and an archived article keeps them and offers Restore article
 * (DE31).
 */
export function EditArticleScreen() {
  const { plant } = useShell();
  const { article, state, reload } = useArticle();
  const articles = { label: 'Articles', href: coreLinks.articles({ plant }).href };
  return (
    <PageFrame
      title={article === undefined ? 'Edit article' : `Edit article ${article.code}`}
      crumbs={
        article === undefined
          ? [articles]
          : [
              articles,
              {
                label: `Article ${article.code}`,
                href: coreLinks.articles.article({ plant, articleId: article.id }).href,
              },
            ]
      }
      state={state}
    >
      {article !== undefined && (
        <EditArticleForm key={article.id} article={article} reload={reload} />
      )}
    </PageFrame>
  );
}
