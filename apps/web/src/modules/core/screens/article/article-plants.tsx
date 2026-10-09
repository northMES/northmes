// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation } from '@apollo/client/react';
import { useState } from 'react';
import { FormSection } from '../../../../ui/components/form-section/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { fieldId } from '../../../../ui/lib/field-id.ts';
import { hasErrorCode, refusalMessage } from '../../../../ui/lib/graphql-errors.ts';
import { Button } from '../../../../ui/primitives/button.tsx';
import type { Article } from '../../article.graphql.ts';
import {
  ArticlePlantsField,
  type PlantsChoice,
  plantsChoiceError,
} from '../../components/article-plants-field/index.ts';
import { permissionPhrase } from '../../no-access.tsx';
import { usePlaces } from '../../use-places.ts';
import { CoreSetArticlePlants } from './set-article-plants.graphql.ts';

interface ArticlePlantsProps {
  readonly article: Article;
  /** Reads the article from the API again, after a change was refused for a stale version. */
  readonly reload: () => Promise<Article | undefined>;
}

/** The choice that the article's saved plants make. */
function choiceOf(article: Pick<Article, 'allPlants' | 'plants'>): PlantsChoice {
  return { allPlants: article.allPlants, plants: article.plants.map(({ slug }) => slug) };
}

/**
 * The message of a save of plants that the API refused, or that got no answer. core.forbidden
 * names the permission at the company, as design core-304 names a refused permission and its
 * place; core.archived takes the copy of design ui-222; another refusal, such as core.plant_unknown,
 * shows the API's message; and only a save without an answer asks to check the connection.
 */
function failureOf(error: unknown, company: string): string {
  if (hasErrorCode(error, 'core.version_conflict')) {
    return 'Someone changed this article after you opened it. The page now shows the saved plants. Check them, then save again.';
  }
  if (hasErrorCode(error, 'core.forbidden')) {
    return `You do not have permission to change the plants of this article. This needs ${permissionPhrase('core.article:assign')} at ${company}.`;
  }
  if (hasErrorCode(error, 'core.archived')) {
    return 'This article is archived. Archived articles cannot be changed until they are restored.';
  }
  const reasons = refusalMessage(error);
  if (reasons === undefined) {
    return 'Could not save the plants. Check the connection, then try again.';
  }
  return `Could not save the plants. ${reasons}`;
}

/**
 * The Plants section of an article's page (ADR 0073), for a user who holds core.article:assign at
 * the company: the Plants field filled with the article's plants, and Save plants, which sends
 * core.setArticlePlants with the version the page shows. A plant taken off keeps its orders that
 * use the article. A save without a plant moves focus to the first plant, and a save refused for a
 * stale version shows the saved plants with a message. A refused save's message shows under the
 * field and goes to the polite region through announce() (ADR 0021). The page keys the section on
 * the article's id, so a new version does not reset it. No design frame draws this section yet; it
 * follows the form section of design ui-222.
 */
export function ArticlePlants({ article, reload }: ArticlePlantsProps) {
  const places = usePlaces();
  const [choice, setChoice] = useState<PlantsChoice>(() => choiceOf(article));
  const [error, setError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | undefined>();
  const [setPlants, { loading }] = useMutation(CoreSetArticlePlants);

  const save = async () => {
    setFailure(undefined);
    const invalid = plantsChoiceError(choice);
    setError(invalid);
    if (invalid !== undefined) {
      // The first plant's checkbox, which the message describes, takes focus after the render
      // that shows the message, so a screen reader reads both.
      requestAnimationFrame(() => document.getElementById(fieldId('plants'))?.focus());
      return;
    }
    try {
      const { data } = await setPlants({
        variables: {
          input: {
            id: article.id,
            expectedVersion: article.version,
            allPlants: choice.allPlants,
            plants: choice.allPlants ? [] : [...choice.plants],
          },
        },
      });
      if (data) setChoice(choiceOf(data.coreSetArticlePlants));
      announce(`Plants of article ${article.code} saved`);
    } catch (thrown) {
      if (hasErrorCode(thrown, 'core.version_conflict')) {
        const saved = await reload().catch(() => undefined);
        if (saved !== undefined) setChoice(choiceOf(saved));
      }
      const message = failureOf(thrown, places.company?.name ?? 'the company');
      setFailure(message);
      announce(message);
    }
  };

  return (
    <FormSection
      title="Plants"
      description="The plants whose lists and pickers show the article. Orders at a plant you take off keep the article."
      className="max-w-190"
    >
      <ArticlePlantsField
        options={places.plants}
        value={choice}
        onChange={(next) => {
          setChoice(next);
          setError(undefined);
        }}
        error={error}
        disabled={loading}
      />
      {failure !== undefined && <p className="text-sm text-destructive">{failure}</p>}
      <div>
        <Button onClick={save} disabled={loading}>
          Save plants
        </Button>
      </div>
    </FormSection>
  );
}
