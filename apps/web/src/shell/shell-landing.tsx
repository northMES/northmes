// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { ApolloClient } from '@apollo/client';
import { companySettingsHref, type RootRoute } from '@northmes/web-sdk';
import { createRoute, type ParsedLocation, redirect } from '@tanstack/react-router';
import { type ReactNode, useEffect } from 'react';
import type { ShellModule } from '../modules.ts';
import { isForbidden } from '../ui/lib/graphql-errors.ts';
import { applyStoredTheme } from '../ui/lib/theme.ts';
import { Card } from '../ui/primitives/card.tsx';
import { CoreCompanies } from './companies.graphql.ts';
import { ShellHelpMenu } from './shell-help-menu.tsx';
import { companySettingsEntries, plantLinkHref, useFocusPageHeading } from './shell-pages.ts';
import {
  type PlantListCompany,
  ShellPlantFreePage,
  ShellPlantList,
} from './shell-plant-free-page.tsx';
import { ShellRouteError } from './shell-route-error.tsx';
import type { ShellUser } from './shell-user-menu.tsx';
import { CoreViewer } from './viewer.graphql.ts';

/** The h1 and the title part of the landing (D2 ST38, copy list). */
const yourPlants = 'Your plants';

/** Where `/` leads a signed-in user: on to a page, or the plant list of these companies. */
export type Landing =
  | { readonly href: string }
  | { readonly companies: readonly PlantListCompany[] };

/**
 * The company settings landing of a company where the user has a company settings page, or
 * undefined. A company the API refuses to answer for gives none.
 */
async function settingsOf(
  modules: readonly ShellModule[],
  client: ApolloClient,
  companyId: string,
): Promise<string | undefined> {
  try {
    const { data } = await client.query({ query: CoreViewer, variables: { companyId } });
    const permissions = new Set(data?.coreViewer.companyPermissions);
    return companySettingsEntries(modules, permissions, companyId).some(
      ({ entries }) => entries.length > 0,
    )
      ? companySettingsHref(companyId)
      : undefined;
  } catch (error) {
    if (isForbidden(error)) return undefined;
    throw error;
  }
}

/**
 * Where `/` leads a signed-in user (ADR 0066, Where a signed-in user starts): a user with exactly
 * one plant and no company settings page goes to that plant, and a user with no plant and a
 * company settings page in one company goes to its landing. Every other user gets the plant list:
 * each company with a plant or a company settings page, which may be none. The shell never picks a
 * default plant (ADR 0007). The onboarding cases wait for the onboarding wizard (E06-S14).
 */
export async function landingOf(
  modules: readonly ShellModule[],
  client: ApolloClient,
): Promise<Landing> {
  const { data } = await client.query({ query: CoreCompanies });
  const companies = await Promise.all(
    (data?.coreCompanies ?? []).map(async (company) => ({
      company,
      settings: await settingsOf(modules, client, company.id),
    })),
  );
  const plants = companies.flatMap(({ company }) => company.plants);
  const settings = companies.flatMap(({ settings: href }) => (href === undefined ? [] : [href]));
  const [plant] = plants;
  if (plants.length === 1 && plant !== undefined && settings.length === 0) {
    return { href: plantLinkHref(modules, plant.slug) };
  }
  const [landing] = settings;
  if (plants.length === 0 && settings.length === 1 && landing !== undefined) {
    return { href: landing };
  }
  return {
    companies: companies
      .filter(({ company, settings: href }) => company.plants.length > 0 || href !== undefined)
      .map(({ company, settings: href }) =>
        href === undefined ? { company } : { company, settings: href },
      ),
  };
}

export interface LandingRouteOptions {
  readonly modules: readonly ShellModule[];
  /** The client without a plant, which reads the user's companies and their permissions. */
  readonly client: ApolloClient;
  /** Sends a viewer without a session to sign-in. */
  readonly beforeLoad: (context: { readonly location: ParsedLocation }) => void;
  readonly user: () => ShellUser;
  readonly onSignOut: () => void;
}

/**
 * The route at `/`, where sign-in leads when the URL names no return path: it sends the user on,
 * or renders the plant list. A failed read renders the shell's error panel in the page without a
 * plant.
 */
export function createLandingRoute(
  rootRoute: RootRoute,
  { modules, client, beforeLoad, user, onSignOut }: LandingRouteOptions,
) {
  const route = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    beforeLoad,
    loader: async () => {
      const landing = await landingOf(modules, client);
      if ('href' in landing) throw redirect({ href: landing.href, replace: true });
      return landing.companies;
    },
    component: () => (
      <ShellLanding
        modules={modules}
        companies={route.useLoaderData()}
        user={user()}
        onSignOut={onSignOut}
      />
    ),
    errorComponent: (props) => (
      <PlantFreeFrame user={user()} onSignOut={onSignOut} modules={modules}>
        <ShellRouteError {...props} modules={modules} />
      </PlantFreeFrame>
    ),
  });
  return route;
}

interface ShellLandingProps {
  readonly modules: readonly ShellModule[];
  readonly companies: readonly PlantListCompany[];
  readonly user: ShellUser;
  readonly onSignOut: () => void;
}

/** The page without a plant around the landing's content, with its focus rule and theme. */
function PlantFreeFrame({
  modules,
  user,
  onSignOut,
  children,
}: Omit<ShellLandingProps, 'companies'> & { readonly children: ReactNode }) {
  const main = useFocusPageHeading();
  useEffect(applyStoredTheme, []);
  return (
    <ShellPlantFreePage
      user={user}
      onSignOut={onSignOut}
      main={main}
      help={<ShellHelpMenu modules={modules} />}
    >
      {children}
    </ShellPlantFreePage>
  );
}

/**
 * The plant list at `/` (D2 ST38, ST39): the h1 Your plants and a card with an h2 per company and
 * its plants, and the link to the company's settings where the user has a page there. A user with
 * neither reads "No plant is assigned to you yet." (ADR 0066).
 */
function ShellLanding({ modules, companies, user, onSignOut }: ShellLandingProps) {
  useEffect(() => {
    document.title = `${yourPlants} · NorthMES`;
  }, []);
  return (
    <PlantFreeFrame modules={modules} user={user} onSignOut={onSignOut}>
      <h1 tabIndex={-1} className="text-title font-semibold">
        {yourPlants}
      </h1>
      <Card className="grid max-w-160 gap-3 px-6 py-6 ring-border">
        {companies.length === 0 ? (
          <p className="text-base leading-6">No plant is assigned to you yet.</p>
        ) : (
          <ShellPlantList modules={modules} companies={companies} level={2} />
        )}
      </Card>
    </PlantFreeFrame>
  );
}
