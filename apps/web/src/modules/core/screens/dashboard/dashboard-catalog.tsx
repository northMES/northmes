// SPDX-License-Identifier: AGPL-3.0-or-later
import { type DashboardWidgetType, dashboardSizesOf } from '@northmes/core-contracts';
import { ChartColumn, Hash, List, type LucideIcon, Search, Table2 } from 'lucide-react';
import { useId, useState } from 'react';
import { Badge } from '../../../../ui/primitives/badge.tsx';
import { Button } from '../../../../ui/primitives/button.tsx';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '../../../../ui/primitives/input-group.tsx';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../../../../ui/primitives/sheet.tsx';
import { sizeName } from './dashboard-edit-layout.ts';

/** One widget type of the catalog (design shell-454, A2). */
interface CatalogEntry {
  readonly type: DashboardWidgetType;
  readonly name: string;
  readonly description: string;
  readonly Icon: LucideIcon;
}

/** Release 1's widget types, each with fictional data, under core's label. */
const entries: readonly CatalogEntry[] = [
  {
    type: 'list',
    name: 'List',
    description: 'Rows from one data source, such as production orders, with a status on each row.',
    Icon: List,
  },
  {
    type: 'table',
    name: 'Table',
    description: 'Columns you choose from one data source, sorted and filtered.',
    Icon: Table2,
  },
  {
    type: 'value',
    name: 'Value',
    description: 'One number, such as good quantity today, with a comparison.',
    Icon: Hash,
  },
  {
    type: 'chart',
    name: 'Chart',
    description: 'Bars over time for one or two series, such as good quantity per hour.',
    Icon: ChartColumn,
  },
];

/** The name of a widget type, such as List, the title of a widget it adds. */
export function typeName(type: DashboardWidgetType): string {
  return entries.find((entry) => entry.type === type)?.name ?? type;
}

export interface DashboardCatalogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** The name of the tab in edit mode, which the widget goes to. */
  readonly tabName: string;
  /** Adds a widget of the type; the catalog then closes. */
  readonly onAdd: (type: DashboardWidgetType) => void;
  /** Where focus goes when the catalog closes, such as the new widget's Widget actions. */
  readonly finalFocus: () => HTMLElement | null;
}

/**
 * The catalog of widgets (design shell-454, A2): a Sheet from the right with a search over the
 * names and descriptions and a card per widget type, with its sizes and Add. In release 1 every
 * widget shows demo data, and they all come from core.
 */
export function DashboardCatalog({
  open,
  onOpenChange,
  tabName,
  onAdd,
  finalFocus,
}: DashboardCatalogProps) {
  const [search, setSearch] = useState('');
  const groupId = useId();
  const words = search.trim().toLowerCase();
  const shown = entries.filter(({ name, description }) =>
    `${name} ${description}`.toLowerCase().includes(words),
  );
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setSearch('');
        onOpenChange(next);
      }}
    >
      <SheetContent className="w-full gap-0 sm:max-w-md" finalFocus={finalFocus}>
        <SheetHeader className="border-b">
          <SheetTitle className="text-lg">Add widget</SheetTitle>
          <SheetDescription>
            To {tabName}. In this release every widget shows demo data.
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          <InputGroup>
            <InputGroupAddon>
              <Search aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              aria-label="Search widgets"
              placeholder="Search widgets"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </InputGroup>
          <p id={groupId} className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Core</span> {entries.length} widgets,
            demo data
          </p>
          {shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">No widget matches “{search.trim()}”.</p>
          ) : (
            <ul aria-labelledby={groupId} className="flex flex-col gap-2">
              {shown.map(({ type, name, description, Icon }) => (
                <li
                  key={type}
                  className="flex items-start gap-3 rounded-lg p-3 ring-1 ring-foreground/10"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Icon aria-hidden className="size-4" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{name}</h3>
                      <Badge variant="outline">Core</Badge>
                    </div>
                    <p className="text-muted-foreground">{description}</p>
                    <p className="text-muted-foreground">
                      Sizes{' '}
                      {dashboardSizesOf[type]
                        .map((size) => sizeName(size.toUpperCase() as Uppercase<typeof size>))
                        .join(', ')}
                    </p>
                  </div>
                  <Button variant="outline" aria-label={`Add ${name}`} onClick={() => onAdd(type)}>
                    Add
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            Modules and plugins add their own widgets to this catalog in later releases, grouped by
            their label.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
