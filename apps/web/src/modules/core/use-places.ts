// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@apollo/client/react';
import { useShell } from '@northmes/web-sdk';
import { CoreCompanies } from './companies.graphql.ts';

/** A place where a role is given: the company or the plant, by its scope id and name (ADR 0007). */
export interface Place {
  readonly id: string;
  readonly name: string;
}

/** The plant in the URL and its company, once the user's companies loaded. */
export interface Places {
  readonly company: Place | undefined;
  readonly plant: Place | undefined;
}

/**
 * The plant in the URL and its company, the two places the access pages read and give roles at
 * (design core-304, assumption: from Plant A the pages read Acme AB and Plant A, never Plant B).
 * With skip, it reads nothing and answers neither place, as for a page that names no place.
 */
export function usePlaces({ skip = false }: { readonly skip?: boolean } = {}): Places {
  const { plant: slug } = useShell();
  const { data } = useQuery(CoreCompanies, { skip });
  for (const company of data?.coreCompanies ?? []) {
    const plant = company.plants.find((each) => each.slug === slug);
    if (plant !== undefined) {
      return {
        company: { id: company.id, name: company.name },
        plant: { id: plant.id, name: plant.name },
      };
    }
  }
  return { company: undefined, plant: undefined };
}

/** The name of a place, or the fallback while the places load. */
export function placeName(place: Place | undefined, fallback: string): string {
  return place?.name ?? fallback;
}
