// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation } from '@apollo/client/react';
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { v7 as uuidv7 } from 'uuid';
import { FormSection } from '../../../../ui/components/form-section/index.ts';
import { PageFrame } from '../../../../ui/components/page-frame/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { useZodForm } from '../../../../ui/lib/use-zod-form.ts';
import { CoreArticle } from '../../article.graphql.ts';
import {
  ArticleForm,
  type ArticleValues,
  articleFormFields,
  showSaveError,
} from '../../components/article-form/index.ts';
import { ArticlePlantsField } from '../../components/article-plants-field/index.ts';
import { usePlaces } from '../../use-places.ts';
import { useViewer } from '../../use-viewer.ts';
import { CoreCreateArticle } from './create-article.graphql.ts';

/**
 * The new article page (design ui-222, DE5): the article form, validated with the identity fields
 * of core.createArticle and the Plants field. Save sends the values under a uuidv7 the page made once, so a retry after
 * a lost answer finds the first article (ADR 0012). A saved article's page replaces the form in
 * the history, and the polite region says "Article BR-900 created". The article is assigned to
 * the plant in the URL; a user who holds core.article:assign at the company also gets the Plants
 * field, which starts at that plant and may choose other plants or All plants (ADR 0073).
 */
export function NewArticleScreen() {
  const { plant } = useShell();
  const navigate = useNavigate();
  const [id] = useState(() => uuidv7());
  const viewer = useViewer();
  const assigns = viewer.canAtCompany('core.article:assign');
  const places = usePlaces({ skip: !assigns });
  // The plants start at the plant in the URL, which is also where a user without the Plants field
  // creates the article; only a user with the field sends them.
  const form = useZodForm(articleFormFields, {
    defaultValues: { code: '', name: '', plants: { allPlants: false, plants: [plant] } },
  });
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
    const { code, name, plants } = values;
    const plantsInput =
      assigns && plants !== undefined ? { allPlants: plants.allPlants, plants: plants.plants } : {};
    try {
      const { data } = await create({
        variables: { input: { id, code, name, ...plantsInput } },
      });
      if (!data) return;
      const article = data.coreCreateArticle;
      announce(`Article ${article.code} created`);
      await navigate({
        to: coreLinks.articles.article({ plant, articleId: article.id }).href,
        replace: true,
      });
    } catch (error) {
      showSaveError(form, error, values);
    }
  };

  return (
    <PageFrame
      title="New article"
      crumbs={[{ label: 'Articles', href: coreLinks.articles({ plant }).href }]}
    >
      <ArticleForm form={form} onSave={save} cancelHref={coreLinks.articles({ plant }).href}>
        {assigns && (
          <FormSection
            title="Plants"
            description="The plants whose lists and pickers show the article."
          >
            <Controller
              control={form.control}
              name="plants"
              render={({ field, fieldState }) => (
                <ArticlePlantsField
                  options={places.plants}
                  value={field.value ?? { allPlants: false, plants: [] }}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                />
              )}
            />
          </FormSection>
        )}
      </ArticleForm>
    </PageFrame>
  );
}
