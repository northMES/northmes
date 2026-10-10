// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation } from '@apollo/client/react';
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { v7 as uuidv7 } from 'uuid';
import { PageFrame } from '../../../../ui/components/page-frame/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { useZodForm } from '../../../../ui/lib/use-zod-form.ts';
import { CoreArticleGroups } from '../../article-groups.graphql.ts';
import {
  ArticleGroupForm,
  type ArticleGroupValues,
  articleGroupFormFields,
  showGroupSaveError,
} from '../../components/article-group-form/index.ts';
import { CoreCreateArticleGroup } from './create-article-group.graphql.ts';

/**
 * The new article group page: the group form, validated with the fields of
 * core.createArticleGroup. Save sends the values under a uuidv7 the page made once, so a retry
 * after a lost answer finds the first group (ADR 0012). A saved group returns to the list in place
 * of the form, and the polite region says "Article group HO created".
 */
export function NewArticleGroupScreen() {
  const { plant } = useShell();
  const navigate = useNavigate();
  const [id] = useState(() => uuidv7());
  const form = useZodForm(articleGroupFormFields, { defaultValues: { code: '', name: '' } });
  const [create] = useMutation(CoreCreateArticleGroup, {
    // The list and the article form's select read the groups again.
    refetchQueries: [CoreArticleGroups],
  });
  const groups = coreLinks.articleGroups({ plant }).href;

  const save = async (values: ArticleGroupValues) => {
    try {
      const { data } = await create({ variables: { input: { id, ...values } } });
      if (!data) return;
      announce(`Article group ${data.coreCreateArticleGroup.code} created`);
      await navigate({ to: groups, replace: true });
    } catch (error) {
      showGroupSaveError(form, error, values);
    }
  };

  return (
    <PageFrame title="New article group" crumbs={[{ label: 'Article groups', href: groups }]}>
      <ArticleGroupForm form={form} onSave={save} cancelHref={groups} />
    </PageFrame>
  );
}
