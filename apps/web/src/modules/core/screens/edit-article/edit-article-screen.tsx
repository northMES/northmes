// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation } from '@apollo/client/react';
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { useNavigate } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { PageFrame } from '../../../../ui/components/page-frame/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { fieldId } from '../../../../ui/lib/field-id.ts';
import { hasErrorCode } from '../../../../ui/lib/graphql-errors.ts';
import { useZodForm } from '../../../../ui/lib/use-zod-form.ts';
import type { Article } from '../../article.graphql.ts';
import {
  ArticleForm,
  ArticleFormPlants,
  type ArticleValues,
  articleFormFields,
  commandFailure,
  showPlantsSaveError,
  showSaveError,
} from '../../components/article-form/index.ts';
import type { PlantsChoice } from '../../components/article-plants-field/index.ts';
import { CoreRestoreArticle } from '../../restore-article.graphql.ts';
import { useArticle } from '../../use-article.tsx';
import { usePlaces } from '../../use-places.ts';
import { useViewer } from '../../use-viewer.ts';
import { CoreSetArticlePlants } from './set-article-plants.graphql.ts';
import { CoreUpdateArticle } from './update-article.graphql.ts';

/** The choice that an article's saved plants make. */
function choiceOf(article: Pick<Article, 'allPlants' | 'plants'>): PlantsChoice {
  return { allPlants: article.allPlants, plants: article.plants.map(({ slug }) => slug) };
}

/** Whether two choices of plants name the same plants, in any order. */
function sameChoice(a: PlantsChoice, b: PlantsChoice): boolean {
  if (a.allPlants !== b.allPlants || a.plants.length !== b.plants.length) return false;
  const named = new Set(a.plants);
  return b.plants.every((slug) => named.has(slug));
}

/**
 * The form's values for a saved article, with its plants only where the form shows the Plants
 * field, so a field the user cannot see never holds back a save.
 */
function formValues(article: Article, assigns: boolean) {
  return {
    ...(assigns && {
      plants: { allPlants: article.allPlants, plants: article.plants.map(({ slug }) => slug) },
    }),
    code: article.code,
    name: article.name,
    stockUnit: article.stockUnit,
    note: article.note ?? '',
    articleGroupId: article.articleGroup?.id ?? '',
    translations: article.translations.map(({ field, locale, text }) => ({ field, locale, text })),
  };
}

interface EditArticleFormProps {
  readonly article: Article;
  /** Whether the user holds core.article:assign at the company, so the form has the Plants field. */
  readonly assigns: boolean;
  readonly reload: () => Promise<Article | undefined>;
}

/**
 * The form of an article as it was when the page opened. Save sends the version the form was
 * filled from as expectedVersion, so a change someone saved in between is refused with
 * core.version_conflict (ADR 0017), not overwritten.
 */
function EditArticleForm({ article, assigns, reload }: EditArticleFormProps) {
  const { plant } = useShell();
  const navigate = useNavigate();
  // The version the form was filled from; only a save reads it, so it is no render state.
  const expectedVersion = useRef(article.version);
  // The plants the saved article has; a save sends core.setArticlePlants only when they differ.
  const savedPlants = useRef(choiceOf(article));
  const [conflict, setConflict] = useState(false);
  // An archived article refuses changes, so its form offers Restore article (DE31).
  const [archived, setArchived] = useState(article.archivedAt !== null);
  const form = useZodForm(articleFormFields, {
    defaultValues: formValues(article, assigns),
  });
  const places = usePlaces({ skip: !assigns });
  const [update] = useMutation(CoreUpdateArticle);
  const [setPlants] = useMutation(CoreSetArticlePlants);
  const [restore] = useMutation(CoreRestoreArticle);

  const save = async (values: ArticleValues) => {
    setConflict(false);
    setArchived(false);
    const { code, name, stockUnit, note, translations, articleGroupId, plants } = values;
    let saved: { readonly code: string; readonly version: number };
    try {
      const { data } = await update({
        variables: {
          input: {
            id: article.id,
            expectedVersion: expectedVersion.current,
            code,
            name,
            stockUnit,
            // An empty note clears it; a field the input leaves out keeps its value.
            note: note ?? '',
            // The list replaces the saved one, so an emptied list removes them.
            translations,
            // An empty group removes it.
            articleGroupId: articleGroupId ?? '',
          },
        },
      });
      if (!data) return;
      saved = data.coreUpdateArticle;
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
      return;
    }
    // The rest of the article is saved, so a refused plants change goes on from its version.
    expectedVersion.current = saved.version;
    if (assigns && plants !== undefined && !sameChoice(plants, savedPlants.current)) {
      try {
        const { data } = await setPlants({
          variables: {
            input: {
              id: article.id,
              expectedVersion: saved.version,
              allPlants: plants.allPlants,
              plants: plants.allPlants ? [] : [...plants.plants],
            },
          },
        });
        if (!data) return;
        savedPlants.current = choiceOf(data.coreSetArticlePlants);
      } catch (error) {
        if (hasErrorCode(error, 'core.version_conflict')) {
          setConflict(true);
          return;
        }
        if (hasErrorCode(error, 'core.archived')) {
          setArchived(true);
          return;
        }
        showPlantsSaveError(form, error, values, places.company?.name ?? 'the company');
        return;
      }
    }
    announce(`Article ${saved.code} saved`);
    await navigate({
      to: coreLinks.articles.article({ plant, articleId: article.id }).href,
      replace: true,
    });
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
    form.reset(formValues(saved, assigns));
    expectedVersion.current = saved.version;
    savedPlants.current = choiceOf(saved);
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
    let restored: Pick<Article, 'code' | 'name' | 'version'> | undefined;
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
      currentGroup={article.articleGroup}
    >
      {assigns && <ArticleFormPlants form={form} options={places.plants} />}
    </ArticleForm>
  );
}

/**
 * The edit page of an article (design ui-222, DE7): the article form filled in, validated with the
 * identity fields of core.updateArticle, and for a user who holds core.article:assign at the
 * company the Plants field, whose changed choice goes through core.setArticlePlants on the version
 * the update answered (ADR 0073). A saved change opens the article's page in place of the
 * form and the polite region says "Article AX-500 saved"; a version conflict keeps the typed values
 * and offers Reload article (DE19), and an archived article keeps them and offers Restore article
 * (DE31).
 */
export function EditArticleScreen() {
  const { plant } = useShell();
  const { article, state, reload } = useArticle();
  const assigns = useViewer().canAtCompany('core.article:assign');
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
        // The viewer's answer can arrive after the article; the form starts again with the Plants
        // field then, which the article's page usually answers from the cache before Edit.
        <EditArticleForm
          key={`${article.id}:${assigns}`}
          article={article}
          assigns={assigns}
          reload={reload}
        />
      )}
    </PageFrame>
  );
}
