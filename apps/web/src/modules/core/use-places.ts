// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { useQuery } from '@apollo/client/react';
import { useShell } from '@northmes/web-sdk';
import { useParams } from '@tanstack/react-router';
import { CoreCompanies } from './companies.graphql.ts';

/** A place where a role is given: the company or a plant, by its scope id and name (ADR 0007). */
export interface Place {
  readonly id: string;
  readonly name: string;
}

/** A plant of the company, with the slug that names it in URLs and in an article's plants. */
export interface PlantPlace extends Place {
  readonly slug: string;
}

/** Where the access pages run, once the user's companies loaded. */
export interface Places {
  /** The company of the plant in the URL. */
  readonly company: Place | undefined;
  /**
   * The plant in the URL on a page of the plant, such as People; undefined on a page of the
   * company's settings, such as Users, which reads at the company and every plant of it.
   */
  readonly plant: Place | undefined;
  /** The plants of the company that the user can open, as the companies list orders them. */
  readonly plants: readonly PlantPlace[];
}

/**
 * The plant in the URL, its company and the company's plants: the places the access pages read and
 * give roles at (design core-304, assumption: from Plant A the pages read Acme AB and Plant A,
 * never Plant B). On a page of the company's settings the pages read the company and all its
 * plants, so it answers no plant there. With skip, it reads nothing and answers no place, as for a
 * page that names no place.
 */
export function usePlaces({ skip = false }: { readonly skip?: boolean } = {}): Places {
  const { plant: slug } = useParams({ strict: false });
  const inCompany = useCompanyId() !== undefined;
  const { data } = useQuery(CoreCompanies, { skip });
  for (const company of data?.coreCompanies ?? []) {
    const plant = company.plants.find((each) => each.slug === slug);
    if (plant !== undefined) {
      return {
        company: { id: company.id, name: company.name },
        plant: inCompany ? undefined : { id: plant.id, name: plant.name },
        plants: company.plants.map(({ id, slug: plantSlug, name }) => ({
          id,
          slug: plantSlug,
          name,
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
 * The company of a page of the company's settings, such as Users, from the shell (ADR 0066,
 * #876), or undefined on a page of the plant, such as People.
 */
export function useCompanyId(): string | undefined {
  return useShell().companyId;
}

/**
 * The variables that name the company in an access read or command of a page of the company's
 * settings, whose requests carry no plant (ADR 0066): { companyId }, or none on a plant's page.
 */
export function useCompanyVariables(): { readonly companyId?: string } {
  const companyId = useCompanyId();
  return companyId === undefined ? {} : { companyId };
}
