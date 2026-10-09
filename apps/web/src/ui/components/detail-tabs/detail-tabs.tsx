// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../primitives/tabs.tsx';

/** One tab of a record's page and the panel it opens. */
export interface DetailTab {
  /** The tab's value in the URL's tab key, such as access. */
  readonly value: string;
  readonly label: string;
  readonly content: ReactNode;
}

export interface DetailTabsProps {
  /** The record the tabs belong to, which names the tablist. */
  readonly label: string;
  /** The open tab; the page keeps it in the URL. */
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly tabs: readonly DetailTab[];
}

/**
 * The tabs of a record's page (design ui-222, DE1 and N4; ADR 0062): a tablist named by the
 * record with a roving tabindex, where the arrow keys move focus and Enter or Space opens the
 * focused tab (manual activation, so an arrow press opens nothing). Focus stays on the tab, and
 * the page puts the tab in the URL.
 */
export function DetailTabs({ label, value, onValueChange, tabs }: DetailTabsProps) {
  return (
    <Tabs value={value} onValueChange={(next) => onValueChange(String(next))}>
      <TabsList variant="line" aria-label={label} activateOnFocus={false}>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} className="min-h-(--nm-target-min) px-3">
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="flex flex-col gap-4 pt-2">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
