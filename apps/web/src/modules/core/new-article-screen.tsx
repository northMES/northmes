// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation } from '@apollo/client/react';
import { coreLinks, createArticle } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { v7 as uuidv7 } from 'uuid';
import { announce } from '../../ui/announce.ts';
import { PageFrame } from '../../ui/page-frame.tsx';
import { useZodForm } from '../../ui/use-zod-form.ts';
import { ArticleForm, type ArticleValues } from './article-form.tsx';
import { showSaveError } from './article-save-errors.ts';
import { CoreArticle, CoreCreateArticle } from './articles.graphql.ts';

/**
 * The new article page (design ui-222, DE5): the article form, validated with the contract of
 * core.createArticle. Save sends the values under a uuidv7 the page made once, so a retry after a
 * lost answer finds the first article (ADR 0012). A saved article's page replaces the form in the
 * history, and the polite region says "Article BR-900 created".
 */
export function NewArticleScreen() {
  const { plantId } = useShell();
  const navigate = useNavigate();
  const [id] = useState(() => uuidv7());
  const form = useZodForm(createArticle.fields, { defaultValues: { code: '', name: '' } });
  const [create] = useMutation(CoreCreateArticle, {
    // The article's page reads the new article from the cache.
    update(cache, { data }) {
      if (!data) return;
      const article = data.coreCreateArticle;
      cache.writeQuery({
        query: CoreArticle,
        variables: { id: article.id },
        data: { coreArticle: article },
      });
    },
  });

  const save = async (values: ArticleValues) => {
    try {
      const { data } = await create({ variables: { input: { id, ...values } } });
      if (!data) return;
      const article = data.coreCreateArticle;
      announce(`Article ${article.code} created`);
      await navigate({
        to: coreLinks.articles.article({ plant: plantId, articleId: article.id }).href,
        replace: true,
      });
    } catch (error) {
      showSaveError(form, error, values);
    }
  };

  return (
    <PageFrame title="New article">
      <ArticleForm
        form={form}
        onSave={save}
        cancelHref={coreLinks.articles({ plant: plantId }).href}
      />
    </PageFrame>
  );
}
