// SPDX-License-Identifier: AGPL-3.0-or-later
import { Link, useLocation, useMatches } from '@tanstack/react-router';
import { Check, ChevronsUpDown, Factory } from 'lucide-react';
import { useRef } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '../ui/primitives/dropdown-menu.tsx';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '../ui/primitives/sidebar.tsx';
import type { ShellCompany, ShellPlant } from './companies.graphql.ts';

/** The number of path params in a route's full path, such as 2 in /$plant/planning/$orderId. */
function paramCount(fullPath: string): number {
  return fullPath.split('/').filter((segment) => segment.startsWith('$')).length;
}

/** Where a plant link goes: a route's full path, its $plant param and its search. */
export interface PlantSwitchTarget {
  readonly to: string;
  readonly params: { readonly plant: string };
  readonly search: Record<string, unknown>;
}

/**
 * The target of a link to the same page at another plant (ADR 0062, ADR 0067): the page on screen
 * with its search when $plant is its only path param, else the nearest page above it without
 * entity params, without the search, as /plant-a/planning/orders/1001 leads to
 * /plant-b/planning/orders.
 */
export function usePlantSwitchTarget(): (plant: string) => PlantSwitchTarget | undefined {
  const matches = useMatches();
  const { search } = useLocation();
  return (plant) => {
    const leaf = matches.length - 1;
    let index = leaf;
    while (index >= 0 && paramCount(matches[index]?.fullPath ?? '') !== 1) index--;
    const match = matches[index];
    if (match === undefined) return undefined;
    return {
      to: match.fullPath,
      params: { plant },
      search: index === leaf ? search : {},
    };
  };
}

/** The company mark: the plant icon on the sidebar's primary colour. */
function CompanyMark() {
  return (
    <span
      aria-hidden
      className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"
    >
      <Factory className="size-4" />
    </span>
  );
}

/** The company over the plant, the text of the switcher and of the static head. */
function CompanyAndPlant({ company, plant }: { readonly company: string; readonly plant: string }) {
  // In the rail the text is visually hidden, so the mark alone shows and the words stay (PL38).
  return (
    <span className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:sr-only">
      <span className="truncate font-medium">{company}</span>
      <span className="truncate text-xs text-muted-foreground">{plant}</span>
    </span>
  );
}

export interface ShellPlantSwitcherProps {
  /** The user's companies with the plants each lets it open, in the server's order. */
  readonly companies: readonly ShellCompany[];
  /** The slug of the plant in the URL. */
  readonly plant: string;
}

/**
 * The plant switcher at the top of the sidebar (ADR 0067, D2 C1, KE7 to KE9): a 48 px button named
 * "{company}, {plant}, switch plant" that opens a menu of links to the user's plants, one group per
 * company under the company's name when the plants span two or more companies. The current plant's
 * link carries aria-current="page" and a check. The menu opens with focus on the first plant other
 * than the current one (K1); Escape returns focus to the button. Each link keeps the page as
 * usePlantSwitchTarget says. With fewer than two plants the head shows the company and the plant as
 * text, with no button.
 */
export function ShellPlantSwitcher({ companies, plant }: ShellPlantSwitcherProps) {
  const { isMobile } = useSidebar();
  const targetAt = usePlantSwitchTarget();
  const firstOther = useRef<HTMLAnchorElement>(null);
  const company = companies.find(({ plants }) => plants.some(({ slug }) => slug === plant));
  const current = company?.plants.find(({ slug }) => slug === plant);
  if (company === undefined || current === undefined) return null;
  const plants = companies.flatMap(({ plants }) => plants);
  if (plants.length < 2) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-2 px-2 text-sm group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
        <CompanyMark />
        <CompanyAndPlant company={company.name} plant={current.name} />
      </div>
    );
  }
  const firstOtherSlug = plants.find(({ slug }) => slug !== plant)?.slug;
  const grouped = companies.length > 1;
  const link = (each: ShellPlant) => {
    const isCurrent = each.slug === plant;
    return (
      <DropdownMenuItem
        key={each.slug}
        render={
          <Link
            ref={each.slug === firstOtherSlug ? firstOther : undefined}
            {...(targetAt(each.slug) ?? { to: '.' })}
            aria-current={isCurrent ? 'page' : undefined}
          />
        }
      >
        <Factory aria-hidden />
        <span className="min-w-0 flex-1 truncate">{each.name}</span>
        {isCurrent && <Check aria-hidden className="ml-auto" />}
      </DropdownMenuItem>
    );
  };
  return (
    <SidebarMenu className="min-w-0 flex-1 group-data-[collapsible=icon]:items-center">
      <SidebarMenuItem>
        <DropdownMenu
          onOpenChangeComplete={(open) => {
            if (open) firstOther.current?.focus();
          }}
        >
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                aria-label={`${company.name}, ${current.name}, switch plant`}
                className="data-popup-open:bg-sidebar-accent"
              />
            }
          >
            <CompanyMark />
            <CompanyAndPlant company={company.name} plant={current.name} />
            <ChevronsUpDown aria-hidden className="ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={isMobile ? 'bottom' : 'right'}
            align="start"
            className="min-w-56"
          >
            {grouped
              ? companies.map((each) => (
                  <DropdownMenuGroup key={each.id}>
                    <DropdownMenuLabel>{each.name}</DropdownMenuLabel>
                    {each.plants.map(link)}
                  </DropdownMenuGroup>
                ))
              : plants.map(link)}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
