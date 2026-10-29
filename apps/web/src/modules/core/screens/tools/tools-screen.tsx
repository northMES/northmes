// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatPlantDateTime } from '@northmes/contracts/format';
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Hammer, Lock, Plus, TriangleAlert } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ColumnsMenu } from '../../../../ui/components/columns-menu/index.ts';
import { DataTable, type DataTableColumn } from '../../../../ui/components/data-table/index.ts';
import { FilterChip } from '../../../../ui/components/filter-chip/index.ts';
import { FilterMenu } from '../../../../ui/components/filter-menu/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { SearchField } from '../../../../ui/components/search-field/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { Alert, AlertDescription, AlertTitle } from '../../../../ui/primitives/alert.tsx';
import { Button } from '../../../../ui/primitives/button.tsx';
import { Checkbox } from '../../../../ui/primitives/checkbox.tsx';
import { Field, FieldLabel } from '../../../../ui/primitives/field.tsx';
import { SourceTag } from '../../components/source-tag/index.ts';
import { toolsAt } from '../../tool-facts.ts';
import {
  type ToolListSearch,
  type ToolScope,
  type ToolSource,
  toolListSearch,
  urlSearchOf,
} from '../../tool-list-search.ts';
import { type Tool, ToolsForbidden } from '../../tools-data.ts';
import { useTools } from '../../tools-source-context.ts';

/** The id of the search input, where Clear filters moves focus. */
const searchFieldId = 'tools-search';

/** Why New tool and Edit wait for the API. */
const toolActionReason = 'Changes to tools wait for the tool API; these pages read the fixture G1.';

const link = 'text-link underline underline-offset-2 hover:no-underline';

/** "Bracket L 10, Gear blank 32 10": the routing operations that allow a tool. */
function usesText(tool: Tool): string {
  return tool.uses.map((use) => `${use.articleName} ${use.sequence}`).join(', ');
}

function columnsOf(plant: string): DataTableColumn<Tool>[] {
  return [
    {
      id: 'code',
      header: 'Code',
      cell: (tool) => (
        <Link
          to={coreLinks.tools.tool({ plant, toolCode: tool.code }).href}
          className={`font-mono ${link}`}
        >
          {tool.code}
        </Link>
      ),
    },
    {
      id: 'name',
      header: 'Name',
      cell: (tool) =>
        tool.source === 'import' ? (
          <span className="flex flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-2">
              {tool.name}
              <SourceTag kind="import" />
            </span>
            {tool.uses[0] !== undefined && (
              <span className="text-xs text-muted-foreground">
                {`${tool.uses[0].articleName} operation ${tool.uses[0].sequence} names it. Give it a name.`}
              </span>
            )}
          </span>
        ) : (
          tool.name
        ),
    },
    { id: 'scope', header: 'Scope', cell: (tool) => tool.scope.name },
    {
      id: 'usedIn',
      header: 'Used in',
      numeric: true,
      cell: (tool) => <span className="font-mono">{tool.uses.length}</span>,
    },
    {
      id: 'operations',
      header: 'Operations',
      cell: (tool) =>
        tool.uses.length === 0 ? (
          <span className="text-xs text-muted-foreground">None</span>
        ) : (
          usesText(tool)
        ),
    },
    {
      id: 'source',
      header: 'Source',
      cell: (tool) =>
        tool.source === 'import' ? (
          <span className="text-xs text-muted-foreground">Code from the ERP</span>
        ) : (
          <SourceTag kind={tool.source === 'northmes' ? 'northmes' : 'erp'} />
        ),
    },
    {
      id: 'actions',
      header: 'Actions',
      headerHidden: true,
      cell: (tool) => (
        <span className="flex justify-end">
          <Button
            variant="outline"
            className="h-8 px-2.5"
            disabled
            aria-label={`Edit, ${tool.code}`}
          >
            Edit
          </Button>
        </span>
      ),
    },
  ];
}

const columnChoices = [
  { id: 'code', label: 'Code', alwaysShown: true },
  { id: 'name', label: 'Name' },
  { id: 'scope', label: 'Scope' },
  { id: 'usedIn', label: 'Used in' },
  { id: 'operations', label: 'Operations' },
  { id: 'source', label: 'Source' },
] as const;

/** The labels of the Source filter's values. */
const sourceLabels: Readonly<Record<ToolSource, string>> = {
  erp: 'From the ERP',
  import: 'Created by the import',
  northmes: 'Set in NorthMES',
};

function matches(tool: Tool, view: ToolListSearch, except?: 'scope' | 'source'): boolean {
  if (except !== 'scope' && view.scope !== undefined && !view.scope.includes(tool.scope.kind)) {
    return false;
  }
  if (except !== 'source' && view.source !== undefined && !view.source.includes(tool.source)) {
    return false;
  }
  if (view.unused === 1 && tool.uses.length > 0) return false;
  if (view.q === undefined) return true;
  const needle = view.q.toLowerCase();
  return [tool.code, tool.name, usesText(tool)].some((t) => t.toLowerCase().includes(needle));
}

/**
 * The tools of the company and the plant under Master data (plan 07, core.tool; ADR 0022; design
 * #729, TO1 to TO8): one row per tool with its code, its name (a tool the import created carries
 * the tag and what names it), its scope, the routing operations that allow it and its source, and
 * a note above the table that names each tool the import created. Search, Scope, Source and Not
 * used only live in the URL (ADR 0062). New tool and Edit wait for the tool API. The preview key
 * opens the loading, empty, failed and no-access states on the fixture.
 */
export function ToolsScreen() {
  const { plant } = useShell();
  const view = toolListSearch(useSearch({ strict: false }));
  const navigate = useNavigate();
  const show = (next: ToolListSearch) =>
    navigate({ to: '.', search: urlSearchOf(next), replace: true });
  const { snapshot, error, retry } = useTools(view.preview);
  const [hiddenColumns, setHiddenColumns] = useState<readonly string[]>([]);
  const unusedId = useId();
  const allRows = useMemo(
    () =>
      (snapshot === undefined ? [] : toolsAt(snapshot, plant)).sort((a, b) =>
        a.code < b.code ? -1 : a.code > b.code ? 1 : 0,
      ),
    [snapshot, plant],
  );
  const rows = allRows.filter((tool) => matches(tool, view));
  const columns = useMemo(() => columnsOf(plant), [plant]);
  const imported = allRows.filter((tool) => tool.source === 'import');
  const plantName = snapshot?.plants.find((each) => each.slug === plant)?.name ?? plant;
  const where =
    snapshot === undefined
      ? 'the company and the plant'
      : `${snapshot.companyName} and ${plantName}`;
  const createdCount = rows.filter((tool) => tool.source === 'import').length;
  const statusLine = `${rows.length} tool${rows.length === 1 ? '' : 's'}, ${createdCount} created by the import. Sorted by code. Used in counts the routing operations that allow the tool.`;
  const announced = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (snapshot === undefined) return;
    if (announced.current !== undefined && announced.current !== statusLine) announce(statusLine);
    announced.current = statusLine;
  }, [snapshot, statusLine]);
  const clearFilters = () => {
    const { q: _q, scope: _s, source: _o, unused: _u, ...rest } = view;
    show(rest);
    document.getElementById(searchFieldId)?.focus();
  };

  const facets = <Value extends string>(
    key: 'scope' | 'source',
    values: readonly Value[],
    fieldOf: (tool: Tool) => Value,
    labelOf: (value: Value) => string,
  ) =>
    values.map((value) => ({
      value,
      label: labelOf(value),
      count: allRows.filter((tool) => matches(tool, view, key) && fieldOf(tool) === value).length,
    }));
  const scopeLabel = (value: ToolScope) =>
    value === 'company' ? (snapshot?.companyName ?? 'The company') : plantName;
  const scopeOptions = facets<ToolScope>(
    'scope',
    ['company', 'plant'],
    (tool) => tool.scope.kind,
    scopeLabel,
  );
  const sourceOptions = facets<ToolSource>(
    'source',
    ['erp', 'import', 'northmes'],
    (tool) => tool.source,
    (value) => sourceLabels[value],
  );
  const withList = (key: 'scope' | 'source', values: readonly string[]) => {
    const { [key]: _, ...rest } = view;
    show(values.length === 0 ? rest : ({ ...rest, [key]: values } as ToolListSearch));
  };
  const filtered = view.scope !== undefined || view.source !== undefined;

  const forbidden = snapshot === undefined && error instanceof ToolsForbidden;
  const failed = snapshot === undefined && error !== undefined;
  let state: PageState = { status: 'ready' };
  if (forbidden) {
    state = {
      status: 'empty',
      icon: Lock,
      title: 'You need the permission to read master data',
      description: 'Ask your plant admin for a role that reads master data.',
    };
  } else if (snapshot === undefined && error !== undefined) {
    state = { status: 'error', title: 'Could not load tools', error, onRetry: retry };
  } else if (snapshot === undefined) {
    state = { status: 'loading' };
  } else if (allRows.length === 0) {
    state = {
      status: 'empty',
      icon: Hammer,
      title: 'No tools yet',
      description:
        'Tools come from the ERP with the routings, and the import creates a tool it does not know.',
    };
  } else if (rows.length === 0) {
    state = {
      status: 'empty',
      title: 'No tools match these filters',
      description: 'Change or clear the filters to see tools again.',
      action: (
        <Button variant="link" onClick={clearFilters}>
          Clear filters
        </Button>
      ),
    };
  }
  return (
    <PageFrame
      title="Tools"
      meta={
        snapshot === undefined ? undefined : (
          <span className="text-sm text-muted-foreground">
            {`${where}.${snapshot.importedAtMs === undefined ? '' : ` ERP data as of ${formatPlantDateTime(snapshot.importedAtMs, snapshot.plant.timeZone)}.`}`}
          </span>
        )
      }
      actions={
        forbidden ? undefined : (
          <Button disabled>
            <Plus aria-hidden />
            New tool
          </Button>
        )
      }
      toolbar={
        forbidden ? undefined : (
          <div className="flex flex-col gap-3">
            {imported.length > 0 && (
              <Alert role="note" className="border-warning bg-warning-subtle text-foreground">
                <TriangleAlert aria-hidden className="text-warning" />
                <AlertTitle>
                  {`The import created ${imported.length === 1 ? '1 tool' : `${imported.length} tools`} it did not know: ${imported.map((tool) => tool.code).join(', ')}.`}
                </AlertTitle>
                <AlertDescription className="text-foreground">
                  An operation from the ERP named a tool code that NorthMES did not have, so the
                  import created it with the code as its name.
                </AlertDescription>
              </Alert>
            )}
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <SearchField
                  id={searchFieldId}
                  label="Search tools"
                  value={view.q ?? ''}
                  onSearch={(q) => {
                    const { q: _, ...rest } = view;
                    show(q.trim() === '' ? rest : { ...rest, q: q.trim() });
                  }}
                  className="w-full max-w-sm"
                />
                <FilterMenu
                  label="Scope"
                  heading="Show tools of these scopes"
                  options={scopeOptions}
                  selected={view.scope ?? []}
                  onChange={(values) => withList('scope', values)}
                />
                <FilterMenu
                  label="Source"
                  heading="Show tools from these sources"
                  options={sourceOptions}
                  selected={view.source ?? []}
                  onChange={(values) => withList('source', values)}
                />
                <Field orientation="horizontal" className="w-auto">
                  <Checkbox
                    id={unusedId}
                    checked={view.unused === 1}
                    onCheckedChange={(checked) => {
                      const { unused: _, ...rest } = view;
                      show(checked ? { ...rest, unused: 1 } : rest);
                    }}
                  />
                  <FieldLabel htmlFor={unusedId}>Not used only</FieldLabel>
                </Field>
              </div>
            </div>
            {filtered && (
              <div className="flex flex-wrap items-center gap-2">
                {view.scope !== undefined && (
                  <FilterChip
                    label="Scope"
                    values={view.scope.map((value) => ({
                      label: scopeLabel(value),
                      count: scopeOptions.find((each) => each.value === value)?.count ?? 0,
                    }))}
                    removeLabel="Remove the scope filter"
                    onRemove={() => withList('scope', [])}
                  />
                )}
                {view.source !== undefined && (
                  <FilterChip
                    label="Source"
                    values={view.source.map((value) => ({
                      label: sourceLabels[value],
                      count: sourceOptions.find((each) => each.value === value)?.count ?? 0,
                    }))}
                    removeLabel="Remove the source filter"
                    onRemove={() => withList('source', [])}
                  />
                )}
                <Button variant="link" onClick={clearFilters}>
                  Clear filters
                </Button>
              </div>
            )}
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <p data-list-status>
                {failed ? '' : snapshot === undefined ? 'Loading tools.' : statusLine}
              </p>
              <p className="flex flex-wrap gap-x-2">
                {snapshot?.fixture !== undefined && (
                  <span>Showing fixture {snapshot.fixture}.</span>
                )}
                <span>{toolActionReason}</span>
              </p>
            </div>
          </div>
        )
      }
      state={state}
    >
      <DataTable
        label={`Tools of ${where}`}
        scrollLabel="Tools, scrolls sideways"
        columns={columns}
        rows={rows}
        getRowId={(tool) => tool.code}
        hiddenColumns={hiddenColumns}
        headerMenu={
          <ColumnsMenu
            compact
            columns={columnChoices}
            hidden={hiddenColumns}
            onChange={setHiddenColumns}
          />
        }
        loading={snapshot === undefined}
        paging={{
          page: 1,
          pageSize: Math.max(25, rows.length),
          totalCount: rows.length,
          hasPreviousPage: false,
          hasNextPage: false,
          onPrevious: () => {},
          onNext: () => {},
        }}
      />
    </PageFrame>
  );
}
