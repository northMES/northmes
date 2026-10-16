// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Building2, Factory, type LucideIcon, UserRound } from 'lucide-react';
import { useId } from 'react';
import { useIsMobile } from '../../../../ui/lib/use-mobile.ts';
import { NativeSelect, NativeSelectOption } from '../../../../ui/primitives/native-select.tsx';
import { Tabs, TabsList, TabsTrigger } from '../../../../ui/primitives/tabs.tsx';
import type { DashboardTab } from './dashboard-tabs.graphql.ts';

/** The icon of each kind of tab, beside its name (design shell-454, A1). */
export const scopeIcons: Readonly<Record<DashboardTab['scope'], LucideIcon>> = {
  COMPANY: Building2,
  PLANT: Factory,
  OWN: UserRound,
};

export interface DashboardTabPickerProps {
  readonly tabs: readonly DashboardTab[];
  /** The open tab's id. */
  readonly value: string;
  readonly onValueChange: (tabId: string) => void;
}

/**
 * The row of tabs under the h1 (design shell-454, option A): the company's, the plant's, then the
 * user's own, each with its scope icon. A tablist with a roving tabindex, where the arrow keys move
 * focus and Enter or Space opens the focused tab (manual activation). Below 768 px the tabs become
 * a select (A8). The tabs are not wired to tab panels: the page draws the open tab's grid below the
 * row, and its URL holds the open tab.
 */
export function DashboardTabPicker({ tabs, value, onValueChange }: DashboardTabPickerProps) {
  const selectId = useId();
  if (useIsMobile()) {
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={selectId} className="text-sm font-medium">
          Dashboard tab
        </label>
        <NativeSelect
          id={selectId}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          className="w-full"
        >
          {tabs.map((tab) => (
            <NativeSelectOption key={tab.id} value={tab.id}>
              {tab.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
    );
  }
  return (
    <Tabs value={value} onValueChange={(next) => onValueChange(String(next))}>
      <TabsList
        variant="line"
        aria-label="Dashboard tabs"
        activateOnFocus={false}
        className="max-w-full flex-wrap justify-start"
      >
        {tabs.map((tab) => {
          const Icon = scopeIcons[tab.scope];
          return (
            // A closed tab's name in --muted-foreground, as the primitive's 60 % foreground falls
            // below 4.5:1 on the page (WCAG 1.4.3).
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="min-h-(--nm-target-min) px-3 text-muted-foreground data-active:text-foreground"
            >
              <Icon aria-hidden />
              {tab.name}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
