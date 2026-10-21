// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatDuration } from '@northmes/contracts/format';
import { useId, useState } from 'react';
import { NativeSelect, NativeSelectOption } from '../../../../ui/primitives/native-select.tsx';
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
import { plannedDuration, secondsText, timeOrZero } from '../../routing-facts.ts';
import type { Routing, RoutingOperation } from '../../routings-data.ts';

const head = 'h-auto px-2 py-1.5 text-xs font-semibold text-muted-foreground';
const cell = 'px-2 py-1.5 whitespace-normal';

/** An input with its unit: "60 s", "40 min", or a plain number for a count or a factor. */
function inputText(label: string, value: number): string {
  if (label === 'Cycle time') return secondsText(value);
  if (label === 'Retool' || label === 'Fixed time') return timeOrZero(value);
  return String(value);
}

/** "10 h" or "7 h 30 min": a planned time. */
function plannedText(seconds: number): string {
  return formatDuration(seconds, { form: 'hours' });
}

/**
 * The Planned duration panel of an operation (plan 07, Planned duration; ADR 0027; design #729,
 * RO1): the quantity of the article's first open order on a machine with a tool, each input with
 * its source, the formula in numbers, the planned time, and the planned time on every other choice
 * of machine and tool. The selects recompute it.
 */
export function RoutingDuration({
  routing,
  operation,
  planningFactorSource,
}: {
  readonly routing: Routing;
  readonly operation: RoutingOperation;
  readonly planningFactorSource: 'none' | 'oeeTarget';
}) {
  const id = useId();
  const order = routing.openOrders[0];
  const quantity = order?.quantity ?? 1;
  const fallback = operation.machines.find((machine) => machine.default) ?? operation.machines[0];
  const [machine, setMachine] = useState(fallback?.code ?? '');
  const [tool, setTool] = useState('');
  const duration = plannedDuration(
    operation,
    machine,
    tool === '' ? undefined : tool,
    quantity,
    planningFactorSource,
  );
  const value = (label: string) =>
    duration.inputs.find((input) => input.label === label)?.value ?? 0;
  const machineName = (code: string) =>
    operation.machines.find((each) => each.code === code)?.name ?? code;
  const choices = operation.machines.flatMap((each) =>
    [undefined, ...operation.tools.map((each) => each.code)].map((toolCode) => ({
      machine: each.code,
      tool: toolCode,
    })),
  );
  const others = choices.filter(
    (choice) => choice.machine !== machine || (choice.tool ?? '') !== tool,
  );
  return (
    <fieldset
      aria-label={`Planned duration of operation ${operation.sequence}`}
      className="grid gap-2 rounded-md border border-border p-3 text-sm"
    >
      <legend className="px-1 text-xs font-semibold text-muted-foreground">Planned duration</legend>
      <p className="flex flex-wrap items-center gap-2">
        <span>
          {quantity} pcs{order === undefined ? '' : ` of order ${order.number}`} on
        </span>
        <label htmlFor={`${id}-machine`} className="sr-only">
          Machine
        </label>
        <NativeSelect
          id={`${id}-machine`}
          size="sm"
          value={machine}
          onChange={(event) => setMachine(event.target.value)}
        >
          {operation.machines.map((each) => (
            <NativeSelectOption key={each.code} value={each.code}>
              {each.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <span>with</span>
        <label htmlFor={`${id}-tool`} className="sr-only">
          Tool
        </label>
        <NativeSelect
          id={`${id}-tool`}
          size="sm"
          value={tool}
          onChange={(event) => setTool(event.target.value)}
        >
          <NativeSelectOption value="">No tool</NativeSelectOption>
          {operation.tools.map((each) => (
            <NativeSelectOption key={each.code} value={each.code}>
              {each.code}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </p>
      <dl className="grid grid-cols-[auto_auto_1fr] gap-x-3 gap-y-0.5">
        {duration.inputs.map((input) => (
          <div key={input.label} className="contents">
            <dt className="text-muted-foreground">{input.label}</dt>
            <dd className="text-end font-mono">{inputText(input.label, input.value)}</dd>
            <dd className="text-xs text-muted-foreground">{input.source}</dd>
          </div>
        ))}
      </dl>
      <p className="font-mono text-xs">
        setup = retool {value('Retool')} + fixed {value('Fixed time')} = {duration.setupS} s
      </p>
      <p className="font-mono text-xs">
        run = ceil({quantity} × {value('Cycles per piece')} ÷ {value('Pieces per cycle')}) ×{' '}
        {value('Cycle time')} ÷ {value('Planning factor')} = {duration.runS} s
      </p>
      <dl className="flex items-baseline gap-3">
        <dt className="font-semibold">Planned time</dt>
        <dd className="font-mono font-semibold">{plannedText(duration.totalS)}</dd>
      </dl>
      {others.length > 0 && (
        <ScrollTable label="Planned time on the other choices">
          <Table>
            <TableCaption className="sr-only">Planned time on the other choices</TableCaption>
            <TableHeader className="bg-muted">
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col" className={head}>
                  Choice
                </TableHead>
                <TableHead scope="col" className={`${head} text-end`}>
                  Cycles
                </TableHead>
                <TableHead scope="col" className={`${head} text-end`}>
                  Planned
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {others.map((choice) => {
                const other = plannedDuration(
                  operation,
                  choice.machine,
                  choice.tool,
                  quantity,
                  planningFactorSource,
                );
                return (
                  <TableRow key={`${choice.machine}-${choice.tool ?? ''}`}>
                    <TableCell className={cell}>
                      {machineName(choice.machine)}
                      {choice.tool === undefined ? '' : ` with ${choice.tool}`}
                    </TableCell>
                    <TableCell className={`${cell} text-end font-mono`}>{other.cycles}</TableCell>
                    <TableCell className={`${cell} text-end font-mono`}>
                      {plannedText(other.totalS)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollTable>
      )}
    </fieldset>
  );
}
