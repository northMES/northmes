// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useParams, useSearch } from '@tanstack/react-router';
import { cn } from 'cn';
import { Lock } from 'lucide-react';
import { useId, useState } from 'react';
import { FormSection } from '../../../../ui/components/form-section/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { ReadOnlyField } from '../../../../ui/components/read-only-field/index.ts';
import { TextField } from '../../../../ui/components/text-field/index.ts';
import { TextareaField } from '../../../../ui/components/textarea-field/index.ts';
import { Button, buttonVariants } from '../../../../ui/primitives/button.tsx';
import { Checkbox } from '../../../../ui/primitives/checkbox.tsx';
import { Field, FieldDescription, FieldLabel } from '../../../../ui/primitives/field.tsx';
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
import { routingActionReason, secondsText, timeOrNone, timeOrZero } from '../../routing-facts.ts';
import { routingPageSearch } from '../../routing-search.ts';
import { type RoutingOperation, RoutingsForbidden } from '../../routings-data.ts';
import { useRoutings } from '../../routings-source-context.ts';

const head = 'h-auto px-2 py-2 text-xs font-semibold text-muted-foreground';
const cell = 'px-2 py-2 whitespace-normal';

/** A number in a field: hours, minutes or a percentage, without trailing zeros. */
function shown(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

/**
 * The edit form of a routing operation (plan 07, do_not_update; design #729, RO4): Keep NorthMES
 * values, which makes the import leave the operation unchanged and asks for a reason; the
 * operation number, always from the ERP; the name and every rate field; the allowed machines and
 * tools with their sources; the materials, which stay the ERP's; and the reason. Save waits for
 * the routing API: the form holds its values and writes nothing.
 */
export function EditRoutingOperationScreen() {
  const { plant } = useShell();
  const { articleNumber = '', sequence = '' } = useParams({ strict: false });
  const search = routingPageSearch(useSearch({ strict: false }));
  const { snapshot, error, retry } = useRoutings(search.preview);
  const routing = snapshot?.routings.find((each) => each.articleNumber === articleNumber);
  const operation = routing?.operations.find((each) => String(each.sequence) === sequence);
  const back = coreLinks.routings.routing({ plant, articleNumber }).href;

  let state: PageState = { status: 'ready' };
  if (snapshot === undefined && error instanceof RoutingsForbidden) {
    state = {
      status: 'empty',
      icon: Lock,
      title: 'You need the permission to change routings at this plant',
      description: 'Ask your plant admin for a role that can change routings.',
    };
  } else if (snapshot === undefined && error !== undefined) {
    state = { status: 'error', title: 'Could not load the operation', error, onRetry: retry };
  } else if (snapshot === undefined) {
    state = { status: 'loading' };
  } else if (operation === undefined) {
    state = {
      status: 'empty',
      title: 'This operation does not exist or you cannot see it',
      description: 'The link may be out of date, or the routing changed with the last import.',
      action: (
        <Link to={back} className={buttonVariants({ variant: 'outline' })}>
          Back to the routing
        </Link>
      ),
    };
  }
  return (
    <PageFrame
      title={
        operation === undefined
          ? 'Edit operation'
          : `Edit operation ${operation.sequence} ${operation.name}`
      }
      crumbs={[
        { label: 'Routings', href: coreLinks.routings({ plant }).href },
        ...(routing === undefined ? [] : [{ label: routing.articleName, href: back }]),
      ]}
      state={state}
    >
      {routing !== undefined && operation !== undefined && (
        <OperationForm
          key={`${routing.articleNumber}-${operation.sequence}`}
          operation={operation}
          back={back}
        />
      )}
    </PageFrame>
  );
}

function OperationForm({
  operation,
  back,
}: {
  readonly operation: RoutingOperation;
  readonly back: string;
}) {
  const keepId = useId();
  const [keep, setKeep] = useState(operation.kept !== undefined);
  const [values, setValues] = useState({
    name: operation.name,
    cycle: shown(operation.cycleSeconds),
    retool: shown(operation.retoolSeconds / 60),
    fixed: shown(operation.fixedSeconds / 60),
    oee: shown(operation.oeeTarget * 100),
    pieces: shown(operation.piecesPerCycle),
    cycles: shown(operation.cyclesPerPiece),
    lead: shown(operation.leadTimeS / 3600),
    sendAhead: shown(operation.sendAheadQuantity),
    reason: operation.kept?.reason ?? '',
  });
  const set = (key: keyof typeof values) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));
  // While Keep is off the import owns the values, so the fields read only and look it.
  const field = (key: keyof typeof values, label: string, hint: string, numeric = true) => (
    <TextField
      label={label}
      value={values[key]}
      onChange={set(key)}
      hint={hint}
      readOnly={!keep}
      className={keep ? undefined : '[&_input]:bg-muted'}
      {...(numeric && { inputMode: 'decimal' as const })}
    />
  );
  return (
    <form
      className="grid max-w-3xl gap-4"
      onSubmit={(event) => event.preventDefault()}
      aria-describedby="edit-routing-reason"
    >
      <Field orientation="horizontal" className="items-start rounded-md border border-border p-3">
        <Checkbox id={keepId} checked={keep} onCheckedChange={setKeep} />
        <div className="grid gap-1">
          <FieldLabel htmlFor={keepId}>Keep NorthMES values for this operation</FieldLabel>
          <FieldDescription>
            While this is on, the import leaves operation {operation.sequence} and its machines
            unchanged. Turn it off to take the ERP's values again at the next import.
          </FieldDescription>
        </div>
      </Field>
      <FormSection title="Operation">
        <div className="grid gap-4 sm:grid-cols-2">
          <ReadOnlyField
            label="Operation number"
            value={String(operation.sequence)}
            tag="Always from the ERP"
            hint="The ERP's operation number identifies the operation."
          />
          {field('name', 'Name', 'The name on the board and the job order list.', false)}
          {field(
            'cycle',
            'Cycle time',
            `Seconds per cycle.${operation.cycleEntered.unit === 'piecesPerHour' ? ` Entered as ${operation.cycleEntered.value} pcs/h.` : ''}`,
          )}
          {field('retool', 'Retool', 'Minutes.')}
          {field('fixed', 'Fixed time', 'Minutes.')}
          {field(
            'oee',
            'OEE target',
            'Percent. The planning factor when the plant uses the OEE target.',
          )}
          {field('pieces', 'Pieces per cycle', 'Pieces one cycle makes.')}
          {field('cycles', 'Cycles per piece', 'Cycles one piece takes.')}
          {field(
            'lead',
            'Lead time',
            `Hours. ${operation.kept === undefined ? '' : `The ERP sends ${timeOrNone(operation.kept.erpLeadTimeS)}. `}Waiting time before this operation, elapsed.`,
          )}
          {field('sendAhead', 'Send-ahead', 'Pieces of this operation that release the next one.')}
        </div>
      </FormSection>
      <FormSection title="Allowed machines">
        <p className="text-sm text-muted-foreground">
          A blank cell inherits the operation's value. Adding a machine waits with Save for the
          routing API.
        </p>
        <ScrollTable label={`Allowed machines of operation ${operation.sequence}`}>
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
                      <span className="font-mono text-xs text-muted-foreground">
                        {machine.code}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className={cell}>{machine.default ? 'Default' : ''}</TableCell>
                  <TableCell className={cn(cell, 'font-mono')}>
                    {machine.cycleSeconds === undefined ? '' : secondsText(machine.cycleSeconds)}
                  </TableCell>
                  <TableCell className={cn(cell, 'font-mono')}>
                    {machine.piecesPerCycle ?? ''}
                  </TableCell>
                  <TableCell className={cn(cell, 'font-mono')}>
                    {machine.cyclesPerPiece ?? ''}
                  </TableCell>
                  <TableCell className={cn(cell, 'font-mono')}>
                    {machine.retoolSeconds === undefined ? '' : timeOrZero(machine.retoolSeconds)}
                  </TableCell>
                  <TableCell className={cell}>
                    {machine.addedBy === undefined ? (
                      <SourceTag kind={machine.source === 'northmes' ? 'northmes' : 'erp'} />
                    ) : (
                      `Added by ${machine.addedBy}`
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollTable>
      </FormSection>
      <FormSection title="Tools">
        <p className="text-sm text-muted-foreground">
          A tool's pieces per cycle wins over the machine's.
        </p>
        {operation.tools.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Operation {operation.sequence} uses no tool.
          </p>
        ) : (
          <ScrollTable label={`Tools of operation ${operation.sequence}`}>
            <Table>
              <TableCaption className="sr-only">
                Tools of operation {operation.sequence}
              </TableCaption>
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
                      {tool.piecesPerCycle ?? ''}
                    </TableCell>
                    <TableCell className={cell}>
                      <SourceTag kind={tool.source === 'northmes' ? 'northmes' : 'erp'} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollTable>
        )}
      </FormSection>
      <FormSection title="Materials">
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <SourceTag kind="erp" />
          {operation.materials.length === 0
            ? `Materials stay as the ERP sends them. Operation ${operation.sequence} consumes no material.`
            : `Materials stay as the ERP sends them: ${operation.materials
                .map((material) => `${material.perPiece} ${material.unit} ${material.name}`)
                .join(', ')} per piece.`}
        </p>
      </FormSection>
      <TextareaField
        label="Reason for the change"
        value={values.reason}
        onChange={set('reason')}
        maxLength={500}
        readOnly={!keep}
        hint={
          keep
            ? 'Shown in History. 3 to 500 characters.'
            : 'Turn on Keep NorthMES values to change the operation and give the reason.'
        }
      />
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button type="submit" disabled>
          Save operation
        </Button>
        <Link to={back} className={buttonVariants({ variant: 'outline' })}>
          Cancel
        </Link>
        <p id="edit-routing-reason" className="text-xs text-muted-foreground">
          {routingActionReason} Placed job orders keep their frozen rates. Free job orders take the
          new values at the next autoplan or move.
        </p>
      </div>
    </form>
  );
}
