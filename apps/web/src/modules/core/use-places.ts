// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@apollo/client/react';
import { useParams } from '@tanstack/react-router';
import { CoreCompanies } from './companies.graphql.ts';

/** A place where a role is given: the company or a plant, by its scope id and name (ADR 0007). */
export interface Place {
  readonly id: string;
  readonly name: string;
}

/** A plant of the company, with the slug its URLs name it by. */
export interface PlantPlace extends Place {
  readonly slug: string;
}

/** Where the access pages run, once the user's companies loaded. */
export interface Places {
  /** The company: the one in company settings, or the company of the plant in the URL. */
  readonly company: Place | undefined;
  /** The plant in the URL, in plant settings; undefined in company settings. */
  readonly plant: Place | undefined;
  /** The plants of the company that the user can open, as the companies list orders them. */
  readonly plants: readonly PlantPlace[];
}

/**
 * The company in the URL of company settings and its plants (ADR 0066), or the plant in the URL
 * of plant settings and its company: the places the access pages read and give roles at (design
 * core-304, assumption: from Plant A the pages read Acme AB and Plant A, never Plant B).
 * With skip, it reads nothing and answers no place, as for a page that names no place.
 */
export function usePlaces({ skip = false }: { readonly skip?: boolean } = {}): Places {
  const { plant: slug, companyId } = useParams({ strict: false });
  const { data } = useQuery(CoreCompanies, { skip });
  for (const company of data?.coreCompanies ?? []) {
    const plant = company.plants.find((each) => each.slug === slug);
    if (companyId === undefined ? plant !== undefined : company.id === companyId) {
      return {
        company: { id: company.id, name: company.name },
        plant: plant === undefined ? undefined : { id: plant.id, name: plant.name },
        plants: company.plants.map(({ id, name, slug: plantSlug }) => ({
          id,
          name,
          slug: plantSlug,
        })),
      };
    }
  }
  return { company: undefined, plant: undefined, plants: [] };
}

/** The name of a place, or the fallback while the places load. */
export function placeName(place: Place | undefined, fallback: string): string {
  return place?.name ?? fallback;
}

/**
 * The company of the company settings page on screen, from /settings/$companyId (ADR 0066), or
 * undefined at a plant.
 */
export function useCompanyId(): string | undefined {
  return useParams({ strict: false }).companyId;
}

/**
 * The variables that name the company in an access read or command of company settings, whose
 * requests carry no plant (ADR 0066): { companyId }, or none at a plant.
 */
export function useCompanyVariables(): { readonly companyId?: string } {
  const companyId = useCompanyId();
  return companyId === undefined ? {} : { companyId };
}
