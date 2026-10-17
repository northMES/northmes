// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatDuration } from '@northmes/contracts/format';
import type { ChainRow, GanttOrder, GanttSnapshot } from '../../gantt-data.ts';

/** One sentence of the chain explanation, with the row it names as a link target. */
export interface ChainSentence {
  /** The display number the sentence starts with, which is a link that focuses the row. */
  readonly row?: string;
  readonly jobOrderId?: string;
  readonly text: string;
  /** The last sentence is the lead the planner follows. */
  readonly lead: boolean;
}

/** The critical chain of an order as the view shows it (plan 18, Float and the critical chain). */
export interface ChainView {
  readonly order: GanttOrder;
  readonly rows: readonly ChainRow[];
  /** The ids of the rows on the chain, of this order and of others. */
  readonly rowIds: ReadonlySet<string>;
  /** The root row and its machine code: "1001.10 on CNC1". */
  readonly rootText: string;
  /** "Critical chain of 1003 shown, 3 rows, root 1001.10 on CNC1". */
  readonly announcement: string;
  /** "Critical chain, 3 rows, root 1001.10 on CNC 1". */
  readonly title: string;
  readonly sentences: readonly ChainSentence[];
}

/** The order of a job order id, by searching the orders. */
function orderOfJobOrder(snapshot: GanttSnapshot, jobOrderId: string): GanttOrder | undefined {
  return snapshot.productionOrders.find((order) =>
    order.jobOrders.some((row) => row.id === jobOrderId),
  );
}

/**
 * The chain of an order from the snapshot's analysis: the rows, the root, the announcement and
 * the explanation as text, one sentence per row built from the binding constraint, the wait and
 * the floats: "1003 is late by 15 h 15 min. 1003.20 on Mill 1 starts when 1003.10 ends. 1003.10 on
 * CNC 1 waits 6 h 50 min for 1001.10. 1001.10 is free and has 11 h 45 min of total float."
 */
export function chainOf(snapshot: GanttSnapshot, orderId: string): ChainView | undefined {
  const order = snapshot.productionOrders.find((each) => each.id === orderId);
  const analysis = snapshot.analysis.orders[orderId];
  const chain = analysis?.chain;
  if (order === undefined || analysis === undefined || chain === undefined) return undefined;
  const machineName = (code: string | undefined) =>
    snapshot.equipment.find((machine) => machine.code === code)?.name ?? code ?? 'no machine';
  const root = chain.rows.find((row) => row.root) ?? chain.rows[chain.rows.length - 1];
  const rootRow =
    root === undefined
      ? undefined
      : orderOfJobOrder(snapshot, root.jobOrderId)?.jobOrders.find(
          (row) => row.id === root.jobOrderId,
        );
  const rootText = root === undefined ? '' : `${root.row} on ${rootRow?.equipment ?? ''}`;
  const sentences: ChainSentence[] = [
    {
      text: analysis.late
        ? `${order.number} is late by ${formatDuration(-analysis.slackElapsedS)}.`
        : `${order.number} is on time, slack ${formatDuration(analysis.slackElapsedS)}.`,
      lead: false,
    },
  ];
  chain.rows.forEach((row, index) => {
    const jobOrder = orderOfJobOrder(snapshot, row.jobOrderId)?.jobOrders.find(
      (each) => each.id === row.jobOrderId,
    );
    const float = snapshot.analysis.jobOrders[row.jobOrderId]?.float;
    const machine = machineName(jobOrder?.equipment);
    const kind = float?.binding.kind;
    let text: string;
    if (kind === 'release' && float?.binding.boundBy !== undefined) {
      text = `on ${machine} starts when ${float.binding.boundBy} ends.`;
    } else if (kind === 'machine' && float?.binding.boundBy !== undefined) {
      text = `on ${machine} waits ${formatDuration(float.waitWorkingS)} for ${float.binding.boundBy}.`;
    } else if (kind === 'free' || row.bindingText === 'free') {
      const total = float?.totalFloatWorkingS ?? row.totalFloatWorkingS;
      text =
        total === undefined
          ? 'is free.'
          : `is free and has ${formatDuration(total)} of total float.`;
    } else {
      text = `on ${machine} is bound by ${row.bindingText}.`;
    }
    sentences.push({
      row: row.row,
      jobOrderId: row.jobOrderId,
      text,
      lead: index === chain.rows.length - 1,
    });
  });
  return {
    order,
    rows: chain.rows,
    rowIds: new Set(chain.rows.map((row) => row.jobOrderId)),
    rootText,
    announcement: `Critical chain of ${order.number} shown, ${chain.rows.length} rows, root ${rootText}`,
    title: `Critical chain, ${chain.rows.length} rows, root ${root?.row ?? ''} on ${machineName(rootRow?.equipment)}`,
    sentences,
  };
}
