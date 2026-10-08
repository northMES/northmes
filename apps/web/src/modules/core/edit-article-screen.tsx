// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation } from '@apollo/client/react';
import { coreLinks, updateArticle } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { announce } from '../../ui/announce.ts';
import { fieldId } from '../../ui/field.ts';
import { PageFrame } from '../../ui/page-frame.tsx';
import { useZodForm } from '../../ui/use-zod-form.ts';
import { ArticleForm, type ArticleValues } from './article-form.tsx';
import { hasErrorCode, showSaveError } from './article-save-errors.ts';
import { type Article, CoreUpdateArticle } from './articles.graphql.ts';
import { useArticle } from './use-article.tsx';

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
  const { plantId } = useShell();
  const navigate = useNavigate();
  const [expectedVersion, setExpectedVersion] = useState(article.version);
  const [conflict, setConflict] = useState(false);
  const form = useZodForm(updateArticle.fields, {
    defaultValues: { code: article.code, name: article.name },
  });
  const [update] = useMutation(CoreUpdateArticle);

  const save = async (values: ArticleValues) => {
    setConflict(false);
    try {
      const { data } = await update({
        variables: { input: { id: article.id, expectedVersion, ...values } },
      });
      if (!data) return;
      announce(`Article ${data.coreUpdateArticle.code} saved`);
      await navigate({
        to: coreLinks.articles.article({ plant: plantId, articleId: article.id }).href,
        replace: true,
      });
    } catch (error) {
      if (hasErrorCode(error, 'core.version_conflict')) {
        setConflict(true);
        return;
      }
      showSaveError(form, error, values);
    }
  };

  // Reload article: the saved values and their version replace the typed ones, and focus moves to
  // the first field, where the change starts again.
  const onReload = async () => {
    const saved = await reload();
    if (saved === undefined) return;
    form.reset({ code: saved.code, name: saved.name });
    setExpectedVersion(saved.version);
    setConflict(false);
    // reset drops the field refs that setFocus reads until the next render, so focus goes by id.
    document.getElementById(fieldId('code'))?.focus();
  };

  return (
    <ArticleForm
      form={form}
      onSave={save}
      cancelHref={coreLinks.articles.article({ plant: plantId, articleId: article.id }).href}
      conflict={conflict ? { onReload } : undefined}
    />
  );
}

/**
 * The edit page of an article (design ui-222, DE7): the article form filled in, validated with
 * the contract of core.updateArticle. A saved change opens the article's page in place of the form
 * and the polite region says "Article AX-500 saved"; a version conflict keeps the typed values and
 * offers Reload article (DE19).
 */
export function EditArticleScreen() {
  const { article, state, reload } = useArticle();
  return (
    <PageFrame
      title={article === undefined ? 'Edit article' : `Edit article ${article.code}`}
      state={state}
    >
      {article !== undefined && (
        <EditArticleForm key={article.id} article={article} reload={reload} />
      )}
    </PageFrame>
  );
}
