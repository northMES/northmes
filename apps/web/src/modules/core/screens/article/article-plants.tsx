// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation } from '@apollo/client/react';
import { useState } from 'react';
import { FormSection } from '../../../../ui/components/form-section/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { hasErrorCode } from '../../../../ui/lib/graphql-errors.ts';
import { Button } from '../../../../ui/primitives/button.tsx';
import type { Article } from '../../article.graphql.ts';
import {
  ArticlePlantsField,
  type PlantsChoice,
  plantsChoiceError,
} from '../../components/article-plants-field/index.ts';
import { usePlaces } from '../../use-places.ts';
import { CoreSetArticlePlants } from './set-article-plants.graphql.ts';

interface ArticlePlantsProps {
  readonly article: Article;
  /** Reads the article from the API again, after a change was refused for a stale version. */
  readonly reload: () => Promise<Article | undefined>;
}

/** The choice that the article's saved plants make. */
function choiceOf(article: Article): PlantsChoice {
  return { allPlants: article.allPlants, plants: article.plants.map(({ slug }) => slug) };
}

/** The message of a save of plants that the API refused, or that got no answer. */
function failureOf(error: unknown): string {
  if (hasErrorCode(error, 'core.version_conflict')) {
    return 'Someone changed this article after you opened it. The page now shows the saved plants. Check them, then save again.';
  }
  return 'Could not save the plants. Check the connection, then try again.';
}

/**
 * The Plants section of an article's page (ADR 0073), for a user who holds core.article:assign at
 * the company: the Plants field filled with the article's plants, and Save plants, which sends
 * core.setArticlePlants with the version the page shows. A plant taken off keeps its orders that
 * use the article. No design frame draws this section yet; it follows the form section of design
 * ui-222.
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
    if (invalid !== undefined) return;
    try {
      await setPlants({
        variables: {
          input: {
            id: article.id,
            expectedVersion: article.version,
            allPlants: choice.allPlants,
            plants: choice.allPlants ? [] : [...choice.plants],
          },
        },
      });
      announce(`Plants of article ${article.code} saved`);
    } catch (thrown) {
      if (hasErrorCode(thrown, 'core.version_conflict')) {
        const saved = await reload().catch(() => undefined);
        if (saved !== undefined) setChoice(choiceOf(saved));
      }
      setFailure(failureOf(thrown));
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
      {failure !== undefined && (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      )}
      <div>
        <Button onClick={save} disabled={loading}>
          Save plants
        </Button>
      </div>
    </FormSection>
  );
}
