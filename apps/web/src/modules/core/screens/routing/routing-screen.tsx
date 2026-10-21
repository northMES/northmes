// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatPlantDateTime } from '@northmes/contracts/format';
import { coreLinks } from '@northmes/core-contracts';
import { planningLinks } from '@northmes/planning-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useParams, useSearch } from '@tanstack/react-router';
import { cn } from 'cn';
import { Lock, Pencil, Route } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
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
import { SourceTag } from '../../components/source-tag/index.ts';
import {
  enteredText,
  operationSourceKind,
  percentText,
  secondsText,
  timeOrNone,
  timeOrZero,
} from '../../routing-facts.ts';
import { routingPageSearch } from '../../routing-search.ts';
import {
  type Routing,
  type RoutingOperation,
  RoutingsForbidden,
  type RoutingsSnapshot,
} from '../../routings-data.ts';
import { useRoutings } from '../../routings-source-context.ts';
import { RoutingDuration } from './routing-duration.tsx';

const head = 'h-auto px-2 py-2 text-xs font-semibold text-muted-foreground';
const cell = 'px-2 py-2 whitespace-normal';
/** An inherited value is muted, an override weighs 600 (design #729, proposals). */
const inherited = 'text-muted-foreground';
const override = 'font-semibold';

/** The operations table of a routing (RO1): every rate field, the machines and the source. */
function OperationsTable({ routing }: { readonly routing: Routing }) {
  const { plant } = useShell();
  return (
    <Table>
      <TableCaption className="sr-only">
        Operations of {routing.articleName} in routing sequence
      </TableCaption>
      <TableHeader className="bg-muted">
        <TableRow className="hover:bg-transparent">
          {[
            'No.',
            'Name',
            'Cycle time',
            'Retool',
            'Fixed time',
            'OEE target',
            'Pieces per cycle',
            'Cycles per piece',
            'Lead time',
            'Send-ahead',
            'Machines',
            'Source',
          ].map((label) => (
            <TableHead key={label} scope="col" className={head}>
              {label}
            </TableHead>
          ))}
          <TableHead scope="col" className={head}>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {routing.operations.map((operation) => {
          const defaultMachine = operation.machines.find((machine) => machine.default);
          const entered = enteredText(operation);
          return (
            <TableRow key={operation.sequence}>
              <TableCell className={cn(cell, 'font-mono')}>{operation.sequence}</TableCell>
              <TableCell className={cell}>{operation.name}</TableCell>
              <TableCell className={cn(cell, 'font-mono')}>
                <span className="flex flex-col">
                  <span>{secondsText(operation.cycleSeconds)}</span>
                  {entered !== undefined && (
                    <span className="text-xs text-muted-foreground">{entered}</span>
                  )}
                </span>
              </TableCell>
              <TableCell className={cn(cell, 'font-mono')}>
                {timeOrZero(operation.retoolSeconds)}
              </TableCell>
              <TableCell className={cn(cell, 'font-mono')}>
                {timeOrZero(operation.fixedSeconds)}
              </TableCell>
              <TableCell className={cn(cell, 'font-mono')}>
                {percentText(operation.oeeTarget)}
              </TableCell>
              <TableCell className={cn(cell, 'font-mono')}>{operation.piecesPerCycle}</TableCell>
              <TableCell className={cn(cell, 'font-mono')}>{operation.cyclesPerPiece}</TableCell>
              <TableCell
                className={cn(cell, 'font-mono', operation.kept !== undefined && override)}
              >
                {timeOrNone(operation.leadTimeS)}
              </TableCell>
              <TableCell className={cn(cell, 'font-mono')}>
                {operation.sendAheadQuantity === 0 ? 'None' : `${operation.sendAheadQuantity} pcs`}
              </TableCell>
              <TableCell className={cell}>
                <span className="flex flex-col">
                  <span>{defaultMachine?.name ?? ''}, default</span>
                  <span className="text-xs text-muted-foreground">
                    {operation.machines.length} allowed
                  </span>
                </span>
              </TableCell>
              <TableCell className={cell}>
                <SourceTag kind={operationSourceKind(operation)} />
              </TableCell>
              <TableCell className={cell}>
                <Link
                  to={
                    coreLinks.routings.routing.editOperation({
                      plant,
                      articleId: routing.articleNumber,
                      sequence: String(operation.sequence),
                    }).href
                  }
                  aria-label={`Edit operation ${operation.sequence}`}
                  className={cn(buttonVariants({ variant: 'outline' }), 'h-8 px-2.5')}
                >
                  <Pencil aria-hidden />
                  Edit
                </Link>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/** A sub-section of an operation: its h3 and content. */
function Part({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

/** One operation of the routing (RO1): kept note, machines, tools, materials, planned duration. */
function OperationSection({
  routing,
  operation,
  snapshot,
}: {
  readonly routing: Routing;
  readonly operation: RoutingOperation;
  readonly snapshot: RoutingsSnapshot;
}) {
  const { plant } = useShell();
  const id = useId();
  const kept = operation.kept;
  const value = (own: number | undefined, base: number, text: (n: number) => string) =>
    own === undefined ? (
      <span className={inherited}>{text(base)}</span>
    ) : (
      <span className={override}>{text(own)}</span>
    );
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 text-card-foreground"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={id} className="text-base font-semibold">
          Operation {operation.sequence} {operation.name}
        </h2>
        <Link
          to={
            coreLinks.routings.routing.editOperation({
              plant,
              articleId: routing.articleNumber,
              sequence: String(operation.sequence),
            }).href
          }
          className={cn(buttonVariants({ variant: 'outline' }), 'h-8 px-3')}
        >
          <Pencil aria-hidden />
          Edit operation {operation.sequence}
        </Link>
      </div>
      {kept === undefined ? (
        <p className="text-sm text-muted-foreground">
          Every value from the ERP, routing version {routing.erpVersion}.
        </p>
      ) : (
        <div className="grid gap-1 rounded-md border border-warning bg-warning-subtle p-3 text-sm">
          <p className="flex items-start gap-2">
            <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
            <span>
              {`Kept in NorthMES since ${formatPlantDateTime(kept.sinceMs, snapshot.plant.timeZone)}, by ${kept.by}. The import leaves this operation unchanged.`}
            </span>
          </p>
          <p>
            {`Lead time changed from the ERP's ${timeOrNone(kept.erpLeadTimeS)} to ${timeOrNone(operation.leadTimeS)}. Reason: ${kept.reason}.`}
          </p>
          <Button variant="outline" className="h-8 justify-self-start px-3" disabled>
            Take the ERP's values
          </Button>
        </div>
      )}
      <Part title="Allowed machines">
        <Table>
          <TableCaption className="sr-only">
            Allowed machines of operation {operation.sequence}
          </TableCaption>
          <TableHeader className="bg-muted">
            <TableRow className="hover:bg-transparent">
              {[
                'Machine',
                'Default',
                'Cycle time',
                'Pieces per cycle',
                'Cycles per piece',
                'Retool',
                'Source',
              ].map((label) => (
                <TableHead key={label} scope="col" className={head}>
                  {label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {operation.machines.map((machine) => (
              <TableRow key={machine.code}>
                <TableCell className={cell}>
                  <span className="flex flex-col">
                    <span>{machine.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{machine.code}</span>
                  </span>
                </TableCell>
                <TableCell className={cell}>{machine.default ? 'Default' : ''}</TableCell>
                <TableCell className={cn(cell, 'font-mono')}>
                  {value(machine.cycleSeconds, operation.cycleSeconds, secondsText)}
                </TableCell>
                <TableCell className={cn(cell, 'font-mono')}>
                  {value(machine.piecesPerCycle, operation.piecesPerCycle, String)}
                </TableCell>
                <TableCell className={cn(cell, 'font-mono')}>
                  {value(machine.cyclesPerPiece, operation.cyclesPerPiece, String)}
                </TableCell>
                <TableCell className={cn(cell, 'font-mono')}>
                  {value(machine.retoolSeconds, operation.retoolSeconds, timeOrZero)}
                </TableCell>
                <TableCell className={cell}>
                  <SourceTag kind={machine.source === 'northmes' ? 'northmes' : 'erp'} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground">
          A muted value inherits the operation's. The OEE target comes from the operation only; a
          machine cannot override it.
        </p>
      </Part>
      <Part title="Tools">
        {operation.tools.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Operation {operation.sequence} uses no tool.
          </p>
        ) : (
          <Table>
            <TableCaption className="sr-only">Tools of operation {operation.sequence}</TableCaption>
            <TableHeader className="bg-muted">
              <TableRow className="hover:bg-transparent">
                {['Tool', 'Name', 'Pieces per cycle', 'Source'].map((label) => (
                  <TableHead key={label} scope="col" className={head}>
                    {label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {operation.tools.map((tool) => (
                <TableRow key={tool.code}>
                  <TableCell className={cn(cell, 'font-mono')}>{tool.code}</TableCell>
                  <TableCell className={cell}>{tool.name}</TableCell>
                  <TableCell className={cn(cell, 'font-mono')}>
                    {tool.piecesPerCycle === undefined ? (
                      <span className={inherited}>No override</span>
                    ) : (
                      <span className={override}>{tool.piecesPerCycle}</span>
                    )}
                  </TableCell>
                  <TableCell className={cell}>
                    <SourceTag kind={tool.source === 'northmes' ? 'northmes' : 'erp'} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <p className="text-xs text-muted-foreground">
          The tool a job order uses is chosen in NorthMES and never sent to the ERP.
        </p>
      </Part>
      <Part title="Materials">
        {operation.materials.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Operation {operation.sequence} consumes no material.
          </p>
        ) : (
          <Table>
            <TableCaption className="sr-only">
              Materials of operation {operation.sequence}
            </TableCaption>
            <TableHeader className="bg-muted">
              <TableRow className="hover:bg-transparent">
                {['Article', 'Name', 'Per piece', 'Source warehouse', 'Source'].map((label) => (
                  <TableHead key={label} scope="col" className={head}>
                    {label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {operation.materials.map((material) => (
                <TableRow key={material.number}>
                  <TableCell className={cn(cell, 'font-mono')}>{material.number}</TableCell>
                  <TableCell className={cell}>{material.name}</TableCell>
                  <TableCell className={cn(cell, 'font-mono')}>
                    {material.perPiece} {material.unit}
                  </TableCell>
                  <TableCell className={cn(cell, 'font-mono')}>{material.warehouse}</TableCell>
                  <TableCell className={cell}>
                    <SourceTag kind="erp" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Part>
      <RoutingDuration routing={routing} operation={operation} />
      <p className="text-xs text-muted-foreground">
        A tool's pieces per cycle wins over the machine's, the machine's over the operation's. The
        OEE target, {percentText(operation.oeeTarget)}, is{' '}
        {snapshot.planningFactorSource === 'none'
          ? `not used: ${snapshot.plant.name}'s planning factor source is None.`
          : 'the planning factor.'}{' '}
        Rates freeze on a job order when it is placed.
      </p>
    </section>
  );
}

/**
 * The routing of an article under Master data (plan 07, Core master data that planning reads and
 * Planned duration; design #729, RO1 to RO8): the article's name in the h1 with its number and
 * Show stock, the operations with every rate field and their source, then each operation with its
 * machines and their overrides, its tools, its materials, whether a planner keeps NorthMES values
 * and its planned duration. One active routing per article. The preview key opens the loading,
 * no-routing, failed and no-access states on the fixture.
 */
export function RoutingScreen() {
  const { plant } = useShell();
  const { articleId = '' } = useParams({ strict: false });
  const search = routingPageSearch(useSearch({ strict: false }));
  const { snapshot, error, retry } = useRoutings(search.preview);
  const routing = snapshot?.routings.find((each) => each.articleNumber === articleId);

  let state: PageState = { status: 'ready' };
  if (snapshot === undefined && error instanceof RoutingsForbidden) {
    state = {
      status: 'empty',
      icon: Lock,
      title: 'You need the permission to read routings at this plant',
      description: 'Ask your plant admin for a role that can read routings.',
    };
  } else if (snapshot === undefined && error !== undefined) {
    state = { status: 'error', title: 'Could not load the routing', error, onRetry: retry };
  } else if (snapshot === undefined) {
    state = { status: 'loading' };
  } else if (routing === undefined) {
    state = {
      status: 'empty',
      icon: Route,
      title: 'This article has no routing',
      description:
        'Routings come from the ERP with the article’s operations, or are created here for orders that NorthMES releases. Without a routing an order of the article cannot be released or planned.',
      action: (
        <Button variant="outline" disabled>
          Create routing
        </Button>
      ),
    };
  }
  return (
    <PageFrame
      title={routing?.articleName ?? 'Routing'}
      crumbs={[{ label: 'Routings', href: coreLinks.routings({ plant }).href }]}
      state={state}
      meta={
        routing === undefined ? undefined : (
          <span className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="font-mono">{routing.articleNumber}</span>
            <Link
              to={planningLinks.stock.article({ plant, articleId: routing.articleNumber }).href}
              className="text-link underline underline-offset-2 hover:no-underline"
            >
              Show stock
            </Link>
          </span>
        )
      }
    >
      {snapshot !== undefined && routing !== undefined && (
        <>
          <p className="text-sm text-muted-foreground">
            {`Active routing, ERP routing version ${routing.erpVersion}, imported ${formatPlantDateTime(routing.importedAtMs, snapshot.plant.timeZone)}. One active routing per article.`}
          </p>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <SourceTag kind="erp" /> set by the import, read-only
            </span>
            <span className="inline-flex items-center gap-1.5">
              <SourceTag kind="northmes" /> a planner's value
            </span>
            <span className="inline-flex items-center gap-1.5">
              <SourceTag kind="kept" /> the import leaves the operation unchanged
            </span>
            {snapshot.fixture !== undefined && <span>Showing fixture {snapshot.fixture}.</span>}
          </p>
          <OperationsTable routing={routing} />
          {routing.operations.map((operation) => (
            <OperationSection
              key={operation.sequence}
              routing={routing}
              operation={operation}
              snapshot={snapshot}
            />
          ))}
        </>
      )}
    </PageFrame>
  );
}
