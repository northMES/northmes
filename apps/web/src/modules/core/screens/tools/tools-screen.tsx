// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatPlantDateTime } from '@northmes/contracts/format';
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Hammer, Lock, Plus, TriangleAlert } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChoiceMenu } from '../../../../ui/components/choice-menu/index.ts';
import { ColumnsMenu } from '../../../../ui/components/columns-menu/index.ts';
import { DataTable, type DataTableColumn } from '../../../../ui/components/data-table/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { SearchField } from '../../../../ui/components/search-field/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { Alert, AlertDescription, AlertTitle } from '../../../../ui/primitives/alert.tsx';
import { Button } from '../../../../ui/primitives/button.tsx';
import { Checkbox } from '../../../../ui/primitives/checkbox.tsx';
import { Field, FieldLabel } from '../../../../ui/primitives/field.tsx';
import { SourceTag } from '../../components/source-tag/index.ts';
import { type ToolListSearch, toolListSearch } from '../../tool-list-search.ts';
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

function matches(tool: Tool, view: ToolListSearch): boolean {
  if (view.scope !== undefined && tool.scope.kind !== view.scope) return false;
  if (view.source !== undefined && tool.source !== view.source) return false;
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
  const show = (next: ToolListSearch) => navigate({ to: '.', search: next, replace: true });
  const { snapshot, error, retry } = useTools(view.preview);
  const [hiddenColumns, setHiddenColumns] = useState<readonly string[]>([]);
  const unusedId = useId();
  const allRows = useMemo(
    () =>
      [...(snapshot?.tools ?? [])].sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0)),
    [snapshot],
  );
  const rows = allRows.filter((tool) => matches(tool, view));
  const columns = useMemo(() => columnsOf(plant), [plant]);
  const imported = allRows.filter((tool) => tool.source === 'import');
  const where =
    snapshot === undefined
      ? 'the company and the plant'
      : `${snapshot.companyName} and ${snapshot.plant.name}`;
  const createdText = rows.filter((tool) => tool.source === 'import').length;
  const statusLine = `${rows.length} tool${rows.length === 1 ? '' : 's'}, ${createdText} created by the import. Sorted by code. Used in counts the routing operations that allow the tool.`;
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

  const forbidden = snapshot === undefined && error instanceof ToolsForbidden;
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
                <ChoiceMenu
                  label="Scope"
                  choices={[
                    { value: undefined, label: 'Every scope' },
                    { value: 'company' as const, label: snapshot?.companyName ?? 'The company' },
                    { value: 'plant' as const, label: snapshot?.plant.name ?? 'The plant' },
                  ]}
                  value={view.scope}
                  onChange={(scope) => {
                    const { scope: _, ...rest } = view;
                    show(scope === undefined ? rest : { ...rest, scope });
                  }}
                />
                <ChoiceMenu
                  label="Source"
                  choices={[
                    { value: undefined, label: 'Every source' },
                    { value: 'erp' as const, label: 'From the ERP' },
                    { value: 'import' as const, label: 'Created by the import' },
                    { value: 'northmes' as const, label: 'Set in NorthMES' },
                  ]}
                  value={view.source}
                  onChange={(source) => {
                    const { source: _, ...rest } = view;
                    show(source === undefined ? rest : { ...rest, source });
                  }}
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
              <ColumnsMenu
                columns={columnChoices}
                hidden={hiddenColumns}
                onChange={setHiddenColumns}
              />
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <p data-list-status>{snapshot === undefined ? 'Loading tools.' : statusLine}</p>
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
        columns={columns}
        rows={rows}
        getRowId={(tool) => tool.code}
        hiddenColumns={hiddenColumns}
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
