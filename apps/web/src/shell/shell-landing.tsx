// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { ApolloClient } from '@apollo/client';
import { companySettingsHref, type RootRoute } from '@northmes/web-sdk';
import { createRoute, Link, type ParsedLocation, redirect } from '@tanstack/react-router';
import { Factory } from 'lucide-react';
import { type ReactNode, useEffect } from 'react';
import type { ShellModule } from '../modules.ts';
import { isForbidden } from '../ui/lib/graphql-errors.ts';
import { applyStoredTheme } from '../ui/lib/theme.ts';
import { Card } from '../ui/primitives/card.tsx';
import { CoreCompanies } from './companies.graphql.ts';
import { ShellHelpMenu } from './shell-help-menu.tsx';
import { companySettingsEntries, plantLinkHref, useFocusPageHeading } from './shell-pages.ts';
import { type PlantListCompany, ShellPlantFreePage } from './shell-plant-free-page.tsx';
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
 * one plant goes to that plant, whatever company settings pages they have (#872), and a user with
 * no plant and a company settings page in one company goes to its landing. Every other user gets
 * the plant picker: each company with a plant or a company settings page, which may be none. The
 * shell never picks a default plant (ADR 0007). The onboarding cases wait for the onboarding
 * wizard (E06-S14).
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
  if (plants.length === 1 && plant !== undefined) {
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

/** The line under the h1 that asks the user to pick a plant (#872). */
const pickLead = 'Pick the plant to work in.';

/**
 * The plants of each company as a picker (#872): the company's h2 with the link to its settings
 * where the user has a page there, and a tile per plant with the switcher's Factory mark, the
 * plant link, which opens the plant's first page, and the plant's path. The whole tile follows
 * the link.
 */
function ShellPlantPicker({
  modules,
  companies,
}: Pick<ShellLandingProps, 'modules' | 'companies'>) {
  return companies.map(({ company, settings }) => (
    <div key={company.id} className="grid gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 id={`your-plants-${company.id}`} className="text-base font-semibold">
          {company.name}
        </h2>
        {settings !== undefined && (
          <Link
            to={settings}
            className="inline-flex min-h-(--nm-target-min) min-w-(--nm-target-min) items-center text-sm text-link underline"
          >
            {company.name} settings
          </Link>
        )}
      </div>
      {company.plants.length > 0 && (
        <ul
          aria-labelledby={`your-plants-${company.id}`}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {company.plants.map((each) => (
            <li
              key={each.slug}
              className="relative flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground hover:bg-accent"
            >
              <span
                aria-hidden
                className="grid size-9 shrink-0 place-items-center rounded-md border text-muted-foreground"
              >
                <Factory className="size-4" />
              </span>
              <span className="flex min-w-0 flex-col">
                <Link
                  to={plantLinkHref(modules, each.slug)}
                  className="inline-flex min-h-(--nm-target-min) items-center font-semibold after:absolute after:inset-0 after:rounded-xl"
                >
                  {each.name}
                </Link>
                <span className="font-mono text-xs text-muted-foreground">/{each.slug}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  ));
}

/**
 * The plant picker at `/` (D2 ST38, ST39; #872): the h1 Your plants, the line that asks the user
 * to pick a plant, and each company's plants as tiles. A user with no plant and no company
 * settings page reads "No plant is assigned to you yet." (ADR 0066).
 */
function ShellLanding({ modules, companies, user, onSignOut }: ShellLandingProps) {
  useEffect(() => {
    document.title = `${yourPlants} · NorthMES`;
  }, []);
  return (
    <PlantFreeFrame modules={modules} user={user} onSignOut={onSignOut}>
      <div className="grid gap-1">
        <h1 tabIndex={-1} className="text-title font-semibold">
          {yourPlants}
        </h1>
        {companies.length > 0 && <p className="text-base text-muted-foreground">{pickLead}</p>}
      </div>
      {companies.length === 0 ? (
        <Card className="grid max-w-160 gap-3 px-6 py-6 ring-border">
          <p className="text-base leading-6">No plant is assigned to you yet.</p>
        </Card>
      ) : (
        <div className="grid max-w-5xl gap-6">
          <ShellPlantPicker modules={modules} companies={companies} />
        </div>
      )}
    </PlantFreeFrame>
  );
}
