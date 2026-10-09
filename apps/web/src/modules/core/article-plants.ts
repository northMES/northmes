// SPDX-License-Identifier: AGPL-3.0-or-later

/** Where an article is used, as the API answers it (ADR 0073). */
export interface ArticlePlants {
  readonly allPlants: boolean;
  readonly plants: readonly { readonly name: string }[];
}

/**
 * The plants of an article in a few words, for the articles list and the article's page: All
 * plants, one or two plant names, the number of plants from three on, or No plants for an article
 * that only company views list.
 */
export function plantsLabel({ allPlants, plants }: ArticlePlants): string {
  if (allPlants) return 'All plants';
  if (plants.length === 0) return 'No plants';
  if (plants.length <= 2) return plants.map(({ name }) => name).join(', ');
  return `${plants.length} plants`;
}

/**
 * True when the article is changed at the plant `slug`: it is assigned to that plant alone and not
 * to All plants, so its edit scope is the plant. Any other article is changed at the company, and
 * changing it needs the permission there (ADR 0073).
 */
export function editedAtPlant(
  {
    allPlants,
    plants,
  }: { readonly allPlants: boolean; readonly plants: readonly { readonly slug: string }[] },
  slug: string | undefined,
): boolean {
  return !allPlants && plants.length === 1 && plants[0]?.slug === slug;
}
