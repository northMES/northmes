// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatPlantDateTime } from '@northmes/contracts/format';
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useParams, useSearch } from '@tanstack/react-router';
import { cn } from 'cn';
import { Lock, Pencil } from 'lucide-react';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { PageSection } from '../../../../ui/components/page-section/index.ts';
import { Button, buttonVariants } from '../../../../ui/primitives/button.tsx';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/primitives/table.tsx';
import { ScrollTable } from '../../components/scroll-table/index.ts';
import { SourceTag } from '../../components/source-tag/index.ts';
import { weekOf } from '../../plant-settings-facts.ts';
import { toolsAt } from '../../tool-facts.ts';
import { toolPageSearch } from '../../tool-list-search.ts';
import { type Tool, ToolsForbidden, type ToolsSnapshot } from '../../tools-data.ts';
import { useTools } from '../../tools-source-context.ts';

const head = 'h-auto px-3 py-2 text-xs font-semibold text-muted-foreground';
const cell = 'px-3 py-2 whitespace-normal';
const link = 'text-link underline underline-offset-2 hover:no-underline';

/** Where a tool came from, in words: the import that brought it, or its creation. */
function originText(tool: Tool, snapshot: ToolsSnapshot): string {
  const at = formatPlantDateTime(tool.importedAtMs, snapshot.plant.timeZone);
  const first = tool.uses[0];
  if (tool.source === 'import') {
    const named = tool.name === tool.code ? ', with its code as its name' : '';
    return `Created by the import ${at}${first === undefined ? '' : ` for ${first.articleName} operation ${first.sequence}`}${named}.`;
  }
  if (tool.source === 'northmes') return `Created in NorthMES ${at}.`;
  return `From the ERP. Imported ${at}.`;
}

/** Where a tool's scope comes from, under its scope. */
function scopeNote(tool: Tool): string {
  if (tool.scope.kind === 'company') return 'Every plant of the company may use it.';
  return tool.source === 'import'
    ? 'The import puts a tool at the plant of the order that names it.'
    : 'Only this plant uses it.';
}

/**
 * A tool's page under Master data (plan 07, core.tool; design #729, TO4): its code in the h1 with
 * its name, where it came from, its scope and the routing operations that allow it with its pieces
 * per cycle there, the machines and the article's open orders, and the job orders of this week that
 * use it. Edit tool waits for the tool API. A tool the snapshot does not hold shows the not-found
 * state.
 */
export function ToolScreen() {
  const { plant } = useShell();
  const { toolCode = '' } = useParams({ strict: false });
  const search = toolPageSearch(useSearch({ strict: false }));
  const { snapshot, error, retry } = useTools(search.preview);
  // A plant sees the company's tools and its own; another plant's tool is not found here.
  const tool =
    snapshot === undefined
      ? undefined
      : toolsAt(snapshot, plant).find((each) => each.code === toolCode);
  const back = coreLinks.tools({ plant }).href;

  let state: PageState = { status: 'ready' };
  if (snapshot === undefined && error instanceof ToolsForbidden) {
    state = {
      status: 'empty',
      icon: Lock,
      title: 'You need the permission to read master data',
      description: 'Ask your plant admin for a role that reads master data.',
    };
  } else if (snapshot === undefined && error !== undefined) {
    state = { status: 'error', title: 'Could not load the tool', error, onRetry: retry };
  } else if (snapshot === undefined) {
    state = { status: 'loading' };
  } else if (tool === undefined) {
    state = {
      status: 'empty',
      title: 'This tool does not exist or you cannot see it',
      description: 'The link may be out of date, or the tool belongs to another plant.',
      action: (
        <Link to={back} className={buttonVariants({ variant: 'outline' })}>
          Back to Tools
        </Link>
      ),
    };
  }
  const week = snapshot === undefined ? undefined : weekOf(snapshot.nowMs, snapshot.plant.timeZone);
  return (
    <PageFrame
      title={`Tool ${tool?.code ?? toolCode}`}
      crumbs={[{ label: 'Tools', href: back }]}
      state={state}
      actions={
        tool === undefined ? undefined : (
          <Button variant="outline" disabled>
            <Pencil aria-hidden />
            Edit tool
          </Button>
        )
      }
      meta={
        tool === undefined ? undefined : (
          <span className="text-sm text-muted-foreground">{tool.name}</span>
        )
      }
    >
      {snapshot !== undefined && tool !== undefined && week !== undefined && (
        <>
          <PageSection title="Tool" lead={originText(tool, snapshot)}>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs font-semibold text-muted-foreground">Code</dt>
                <dd className="flex flex-wrap items-center gap-2 font-mono text-sm">
                  {tool.code}
                  <SourceTag kind={tool.source === 'northmes' ? 'northmes' : 'erp'} />
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs font-semibold text-muted-foreground">Name</dt>
                <dd className="flex flex-wrap items-center gap-2 text-sm">
                  {tool.name}
                  {tool.source === 'import' && <SourceTag kind="import" />}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs font-semibold text-muted-foreground">Scope</dt>
                <dd className="flex flex-col gap-0.5 text-sm">
                  <span>{tool.scope.name}</span>
                  <span className="text-xs text-muted-foreground">{scopeNote(tool)}</span>
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs font-semibold text-muted-foreground">Used in</dt>
                <dd className="text-sm">
                  {tool.uses.length === 1
                    ? '1 routing operation allows this tool.'
                    : `${tool.uses.length} routing operations allow this tool.`}
                </dd>
              </div>
            </dl>
            {tool.uses.length > 0 && (
              <ScrollTable label={`Routing operations that allow ${tool.code}`}>
                <Table>
                  <TableCaption className="sr-only">
                    Routing operations that allow {tool.code}
                  </TableCaption>
                  <TableHeader className="bg-muted">
                    <TableRow className="hover:bg-transparent">
                      {[
                        'Article',
                        'Operation',
                        'Pieces per cycle',
                        'Allowed machines',
                        'Open orders',
                      ].map((label) => (
                        <TableHead key={label} scope="col" className={head}>
                          {label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tool.uses.map((use) => (
                      <TableRow key={`${use.articleNumber}-${use.sequence}`}>
                        <TableCell className={cell}>
                          <span className="flex flex-col">
                            <Link
                              to={
                                coreLinks.routings.routing({
                                  plant,
                                  articleNumber: use.articleNumber,
                                }).href
                              }
                              className={link}
                            >
                              {use.articleName}
                            </Link>
                            <span className="font-mono text-xs text-muted-foreground">
                              {use.articleNumber}
                            </span>
                          </span>
                        </TableCell>
                        <TableCell className={cell}>
                          {use.sequence} {use.operationName}
                        </TableCell>
                        <TableCell className={cn(cell, 'font-mono')}>
                          {use.piecesPerCycle === undefined
                            ? 'No override'
                            : `${use.piecesPerCycle} instead of ${use.operationPiecesPerCycle}`}
                        </TableCell>
                        <TableCell className={cell}>
                          {use.machines
                            .map((machine) =>
                              machine.default ? `${machine.name} (default)` : machine.name,
                            )
                            .join(', ')}
                        </TableCell>
                        <TableCell className={cn(cell, 'font-mono')}>
                          {use.openOrders.join(', ')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollTable>
            )}
          </PageSection>
          <PageSection title="Job orders with this tool" lead={week.label}>
            <p className="text-sm">
              {tool.jobOrders.length === 0
                ? `No job order uses ${tool.code} in W${week.week}.`
                : `${tool.jobOrders.length === 1 ? '1 job order uses' : `${tool.jobOrders.length} job orders use`} ${tool.code} in W${week.week}: ${tool.jobOrders
                    .map(
                      (job) =>
                        `${job.displayNumber} from ${formatPlantDateTime(job.setupStartMs, snapshot.plant.timeZone)}`,
                    )
                    .join(', ')}.`}{' '}
              A planner picks the tool of a job order in Details; a job order without a tool uses
              the values of its machine and operation. The tool is never sent to the ERP.
            </p>
          </PageSection>
          {snapshot.fixture !== undefined && (
            <p className="text-xs text-muted-foreground">
              Showing fixture {snapshot.fixture}. Changes to tools wait for the tool API.
            </p>
          )}
        </>
      )}
    </PageFrame>
  );
}
