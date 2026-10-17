// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatDuration, formatPlantDateTime } from '@northmes/contracts/format';
import { type GanttExpected, type GanttFixture, g1, g1Expected } from '@northmes/planning-domain';
import type {
  ChainRow,
  ConstraintLine,
  GanttAnalysis,
  GanttDataSource,
  GanttJobOrder,
  GanttOperation,
  GanttOrder,
  GanttSnapshot,
  JobOrderAnalysis,
  OrderAnalysis,
  RowFloat,
  RowRelease,
} from './gantt-data.ts';

/** An ISO instant as epoch milliseconds: the one place a snapshot's instants are parsed. */
function ms(instant: string): number {
  return Date.parse(instant);
}

/** The order id of an order number in the fixture, where the server sends a uuid. */
function orderIdOf(number: string): string {
  return `po-${number}`;
}

type FixtureOrder = GanttFixture['productionOrders'][number];
type FixtureJobOrder = FixtureOrder['jobOrders'][number];

function operationOf(operation: FixtureOrder['operations'][number]): GanttOperation {
  return {
    id: operation.displayNumber,
    displayNumber: operation.displayNumber,
    sequence: operation.sequence,
    name: operation.name,
    quantity: operation.quantity,
    rates: operation.rates,
    leadTimeS: operation.leadTimeS,
    sendAheadQuantity: operation.sendAheadQuantity,
    isLocked: operation.isLocked,
    allowedEquipment: operation.allowedEquipment,
  };
}

/** A job order with its placement from the expected placements, keyed by display number. */
function jobOrderOf(
  order: FixtureOrder,
  row: FixtureJobOrder,
  placements: GanttExpected['placements'],
): GanttJobOrder {
  const placed = placements[row.productionOrderOperation];
  return {
    id: row.id,
    orderId: orderIdOf(order.number),
    operationId: row.productionOrderOperation,
    displayNumber: row.productionOrderOperation,
    equipment: row.equipment,
    quantity: row.quantity,
    status: row.status,
    placement: {
      setupStartMs: ms(row.setupStartAt),
      runStartMs: ms(row.runStartAt),
      endMs: ms(row.endAt),
      segments: (placed?.segments ?? [{ from: row.setupStartAt, to: row.endAt }]).map(
        ({ from, to }) => ({ fromMs: ms(from), toMs: ms(to) }),
      ),
    },
    plannedSetupS: row.plannedSetupS,
    plannedRunS: row.plannedRunS,
    rates: row.rates,
  };
}

function orderOf(order: FixtureOrder, placements: GanttExpected['placements']): GanttOrder {
  return {
    id: orderIdOf(order.number),
    number: order.number,
    article: order.article,
    quantity: order.quantity,
    deadlineDate: order.deadlineDate,
    deadlineMs: ms(order.deadlineInstant.instant),
    priority: order.priority,
    color: order.color,
    status: order.status,
    operations: order.operations.map(operationOf),
    jobOrders: order.jobOrders.map((row) => jobOrderOf(order, row, placements)),
  };
}

/** The float values of a row from GT1_GT2_floats; none for a row the fixture leaves out. */
function floatOf(displayNumber: string, expected: GanttExpected): RowFloat | undefined {
  const values = expected.GT1_GT2_floats[displayNumber];
  if (values === undefined) return undefined;
  return {
    earliestStartMs: ms(values.earliestStart.instant),
    waitWorkingS: values.waitWorkingS,
    latestStartMs: ms(values.latestStart.instant),
    latestEndMs: ms(values.latestEnd.instant),
    totalFloatWorkingS: values.totalFloatWorkingS,
    freeFloatWorkingS: values.freeFloatWorkingS,
    binding: {
      kind: values.bindingConstraint.kind,
      ...(values.bindingConstraint.boundBy !== undefined && {
        boundBy: values.bindingConstraint.boundBy,
      }),
      ...(values.bindingConstraint.equipment !== undefined && {
        equipment: values.bindingConstraint.equipment,
      }),
      ...(values.bindingConstraint.detail !== undefined && {
        detail: values.bindingConstraint.detail,
      }),
    },
    critical: values.critical,
  };
}

/** The latest-ending placed row of an operation, which sets the release of the next operation. */
function latestEnding(rows: readonly GanttJobOrder[]): GanttJobOrder | undefined {
  let latest: GanttJobOrder | undefined;
  for (const row of rows) {
    if (row.placement === undefined) continue;
    if (latest?.placement === undefined || row.placement.endMs > latest.placement.endMs) {
      latest = row;
    }
  }
  return latest;
}

/**
 * The release of a row from its predecessor operation: the predecessor's latest end plus the lead
 * time, or, with a send-ahead quantity, the instant the quantity is complete, which phase 1 takes
 * from GT4 for 1004.10 (the only send-ahead in G1) and phase 2 computes over the calendar.
 */
function releaseOf(
  order: GanttOrder,
  operation: GanttOperation,
  expected: GanttExpected,
): RowRelease | undefined {
  const index = order.operations.findIndex((each) => each.id === operation.id);
  const predecessor = order.operations[index - 1];
  if (predecessor === undefined) return undefined;
  const fromRow = latestEnding(order.jobOrders.filter((row) => row.operationId === predecessor.id));
  if (fromRow?.placement === undefined) return undefined;
  const sendAhead = predecessor.sendAheadQuantity > 0 && predecessor.displayNumber === '1004.10';
  const pointMs = sendAhead
    ? ms(expected.GT4_send_ahead_last_piece_1004.releaseOf300Pieces.instant)
    : fromRow.placement.endMs;
  return {
    fromRow: fromRow.displayNumber,
    fromJobOrderId: fromRow.id,
    pointMs,
    atMs: pointMs + operation.leadTimeS * 1000,
  };
}

/** The next placed row on a machine after an end, over every order. */
function nextOnMachine(
  rows: readonly GanttJobOrder[],
  equipment: string,
  afterMs: number,
  except: string,
): GanttJobOrder | undefined {
  let next: GanttJobOrder | undefined;
  for (const row of rows) {
    if (row.id === except || row.equipment !== equipment || row.placement === undefined) continue;
    if (row.placement.setupStartMs < afterMs) continue;
    if (next?.placement === undefined || row.placement.setupStartMs < next.placement.setupStartMs) {
      next = row;
    }
  }
  return next;
}

/** Whether another placed row on the machine overlaps this one. */
function overlapOnMachine(
  rows: readonly GanttJobOrder[],
  row: GanttJobOrder,
): GanttJobOrder | undefined {
  if (row.placement === undefined) return undefined;
  const { setupStartMs, endMs } = row.placement;
  return rows.find(
    (other) =>
      other.id !== row.id &&
      other.equipment === row.equipment &&
      other.placement !== undefined &&
      other.placement.setupStartMs < endMs &&
      other.placement.endMs > setupStartMs,
  );
}

/**
 * The constraint list of a row (plan 18, The constraint list of a row), in the order of the
 * constraint table: each kind that applies as one line with its value in plant time and whether
 * it holds. Built here from the snapshot; constraintsOf in the domain package replaces it.
 */
function constraintsOf(
  snapshot: Omit<GanttSnapshot, 'analysis'>,
  order: GanttOrder,
  row: GanttJobOrder,
  release: RowRelease | undefined,
  orderAnalysis: OrderAnalysis,
  allRows: readonly GanttJobOrder[],
): ConstraintLine[] {
  const zone = snapshot.plant.timeZone;
  const at = (epochMs: number) => formatPlantDateTime(epochMs, zone);
  const operation = order.operations.find((each) => each.id === row.operationId);
  const lines: ConstraintLine[] = [];
  const machine = snapshot.equipment.find((each) => each.code === row.equipment);
  const machineName = machine?.name ?? row.equipment ?? 'no machine';

  lines.push(
    orderAnalysis.late
      ? {
          kind: 'deadline',
          text: `Deadline of order ${order.number}: ${at(order.deadlineMs)}, late by ${formatDuration(-orderAnalysis.slackElapsedS)}`,
          holds: false,
          involves: [order.number],
        }
      : {
          kind: 'deadline',
          text: `Deadline of order ${order.number}: ${at(order.deadlineMs)}, slack ${formatDuration(orderAnalysis.slackElapsedS)}`,
          holds: true,
        },
  );

  if (release !== undefined && operation !== undefined && row.placement !== undefined) {
    const boundStart = snapshot.settings.retoolOverlapsLeadTime
      ? row.placement.runStartMs
      : row.placement.setupStartMs;
    const predecessor = order.operations.find((each) => each.id === release.fromRow);
    const sendAhead = (predecessor?.sendAheadQuantity ?? 0) > 0;
    const holds = boundStart >= release.atMs;
    const lead =
      operation.leadTimeS > 0 ? `, lead ${formatDuration(operation.leadTimeS)}` : ', lead 0';
    const base = sendAhead
      ? `Release from ${release.fromRow}: ${at(release.atMs)} (${predecessor?.sendAheadQuantity} pieces complete at ${at(release.pointMs)}${lead})`
      : `Release from ${release.fromRow}: ${at(release.atMs)} (${release.fromRow} ends ${at(release.pointMs)}${lead})`;
    lines.push(
      holds
        ? { kind: 'release', text: base, holds: true }
        : {
            kind: 'release',
            text: `${base}: starts ${formatDuration((release.atMs - boundStart) / 1000)} before its release`,
            holds: false,
            code: sendAhead ? 'SEND_AHEAD' : 'LEAD_TIME',
            involves: [release.fromRow],
          },
    );
    const fromRow = allRows.find((each) => each.id === release.fromJobOrderId);
    if (fromRow?.placement !== undefined) {
      const cycleS = (row.rates.cycleSeconds * row.rates.cyclesPerPiece) / row.rates.piecesPerCycle;
      const minEndMs = fromRow.placement.endMs + (operation.leadTimeS + cycleS) * 1000;
      const holdsLast = row.placement.endMs >= minEndMs;
      lines.push({
        kind: 'lastPiece',
        text: `Last piece: ends at or after ${at(minEndMs)} (${release.fromRow} end plus lead plus one cycle)`,
        holds: holdsLast,
        ...(!holdsLast && { code: 'LAST_PIECE', involves: [release.fromRow] }),
      });
    }
  }

  if (operation?.isLocked) {
    lines.push({
      kind: 'hardLock',
      text: 'Hard lock: the row keeps its machine and its start',
      holds: true,
    });
  }
  if (row.status !== 'planned') {
    lines.push({
      kind: 'started',
      text: 'Started: the machine and the actual start stay',
      holds: true,
    });
  }
  if (
    row.placement !== undefined &&
    row.placement.setupStartMs >= snapshot.nowMs &&
    row.placement.setupStartMs < snapshot.fenceMs
  ) {
    lines.push({
      kind: 'frozenWindow',
      text: `Frozen window until ${at(snapshot.fenceMs)}: the row keeps its machine and order`,
      holds: true,
    });
  }

  if (operation !== undefined) {
    const names = operation.allowedEquipment.map(
      (code) => snapshot.equipment.find((each) => each.code === code)?.name ?? code,
    );
    const allowed =
      row.equipment === undefined || operation.allowedEquipment.includes(row.equipment);
    lines.push({
      kind: 'allowedMachines',
      text: allowed
        ? `Allowed machines: ${names.join(', ')}`
        : `Allowed machines: ${names.join(', ')}; ${machineName} is not allowed`,
      holds: allowed,
      ...(!allowed && { code: 'MACHINE_NOT_ALLOWED' }),
    });
  }

  if (row.equipment !== undefined && row.placement !== undefined) {
    const overlap = overlapOnMachine(allRows, row);
    if (overlap !== undefined) {
      lines.push({
        kind: 'oneJobAtATime',
        text: `One job at a time on ${machineName}: overlaps ${overlap.displayNumber}`,
        holds: false,
        code: 'OVERLAP',
        involves: [overlap.displayNumber],
      });
    } else {
      const next = nextOnMachine(allRows, row.equipment, row.placement.endMs, row.id);
      lines.push({
        kind: 'oneJobAtATime',
        text:
          next?.placement === undefined
            ? `One job at a time on ${machineName}: nothing follows in the loaded range`
            : `One job at a time on ${machineName}: next is ${next.displayNumber} at ${at(next.placement.setupStartMs)}`,
        holds: true,
      });
    }
    lines.push({
      kind: 'calendar',
      text: `Calendar ${machine?.calendar ?? snapshot.calendar.name}: all work in open time`,
      holds: true,
    });
  }

  if (machine !== undefined && !machine.isPlannable) {
    lines.push({
      kind: 'notPlannable',
      text: `${machineName} is not plannable: autoplan leaves the row where it is`,
      holds: true,
    });
  }
  return lines;
}

/** The chain of an order from its expected chain rows, with each row's ids resolved. */
function chainOf(
  expected: GanttExpected['GT1_chain_1001'],
  orders: readonly GanttOrder[],
): OrderAnalysis['chain'] {
  const rows: ChainRow[] = [];
  for (const row of expected.chain) {
    const order = orders.find((each) => each.jobOrders.some((jo) => jo.displayNumber === row.row));
    const jobOrder = order?.jobOrders.find((jo) => jo.displayNumber === row.row);
    if (order === undefined || jobOrder === undefined) continue;
    rows.push({
      row: row.row,
      jobOrderId: jobOrder.id,
      orderId: order.id,
      bindingConstraint: row.bindingConstraint,
      critical: row.critical ?? false,
      root: row.root ?? false,
      ...(row.otherOrder !== undefined && { otherOrder: row.otherOrder }),
      ...(row.totalFloatWorkingS !== undefined && { totalFloatWorkingS: row.totalFloatWorkingS }),
    });
  }
  return { rows, criticalRows: expected.criticalRows };
}

function orderAnalysisOf(
  order: GanttOrder,
  orders: readonly GanttOrder[],
  expected: GanttExpected,
): OrderAnalysis {
  const placed = order.jobOrders.flatMap((row) =>
    row.placement === undefined ? [] : [row.placement],
  );
  const plannedStartMs =
    placed.length === 0 ? undefined : Math.min(...placed.map((p) => p.setupStartMs));
  const plannedEndMs = placed.length === 0 ? undefined : Math.max(...placed.map((p) => p.endMs));
  if (order.number === '1001') {
    return {
      late: false,
      slackElapsedS: expected.GT1_float_1001.slackToDeadlineElapsedS,
      plannedStartMs,
      plannedEndMs: ms(expected.GT1_float_1001.plannedEnd.instant),
      chain: chainOf(expected.GT1_chain_1001, orders),
    };
  }
  if (order.number === '1003') {
    return {
      late: true,
      slackElapsedS: -expected.GT2_late_chain_1003.lateByElapsedS,
      lateByWorking: {
        seconds: expected.GT2_late_chain_1003.lateByWorkingSOnMILL1,
        equipment: 'MILL1',
      },
      plannedStartMs,
      plannedEndMs: ms(expected.GT2_late_chain_1003.plannedEnd.instant),
      chain: chainOf(expected.GT2_chain_1003, orders),
    };
  }
  const slackElapsedS = plannedEndMs === undefined ? 0 : (order.deadlineMs - plannedEndMs) / 1000;
  return { late: slackElapsedS < 0, slackElapsedS, plannedStartMs, plannedEndMs };
}

/** The snapshot of the fixture G1 with its analysis from the expected values. */
export function g1Snapshot(
  fixture: GanttFixture = g1,
  expected: GanttExpected = g1Expected,
): GanttSnapshot {
  const orders = fixture.productionOrders.map((order) => orderOf(order, expected.placements));
  const allRows = orders.flatMap((order) => order.jobOrders);
  const base: Omit<GanttSnapshot, 'analysis'> = {
    fixture: fixture.id,
    plant: fixture.plant,
    settings: {
      deadlineRule: fixture.settings.deadlineRule,
      shiftEndForDeadline: fixture.settings.shiftEndForDeadline,
      frozenHours: fixture.settings.frozenHours,
      leadTimeBasis: fixture.settings.leadTimeBasis,
      retoolOverlapsLeadTime: fixture.settings.retoolOverlapsLeadTime,
    },
    nowMs: ms(fixture.now.instant),
    fenceMs: ms(fixture.fence.instant),
    calendar: {
      name: fixture.calendar.name,
      weekdays: fixture.calendar.weekdays,
      shift: fixture.calendar.shift,
      breaks: fixture.calendar.breaks,
      workingSecondsPerDay: fixture.calendar.workingSecondsPerDay,
    },
    equipmentGroups: fixture.equipmentGroups.map(({ code, name }) => ({ code, name })),
    equipment: fixture.equipment,
    productionOrders: orders,
  };
  const orderAnalyses: Record<string, OrderAnalysis> = {};
  for (const order of orders) orderAnalyses[order.id] = orderAnalysisOf(order, orders, expected);
  const jobOrders: Record<string, JobOrderAnalysis> = {};
  for (const order of orders) {
    const orderAnalysis = orderAnalyses[order.id];
    if (orderAnalysis === undefined) continue;
    for (const row of order.jobOrders) {
      const operation = order.operations.find((each) => each.id === row.operationId);
      const release = operation === undefined ? undefined : releaseOf(order, operation, expected);
      const float = floatOf(row.displayNumber, expected);
      jobOrders[row.id] = {
        ...(float !== undefined && { float }),
        ...(release !== undefined && { release }),
        constraints: constraintsOf(base, order, row, release, orderAnalysis, allRows),
      };
    }
  }
  const analysis: GanttAnalysis = {
    jobOrders,
    orders: orderAnalyses,
    workload: expected.GT5_workload_week45,
  };
  return { ...base, analysis };
}

/**
 * The mock data source of phase 1 (plan 18): every load answers with the fixture G1, whatever the
 * range and filter, so the product owner evaluates the Gantt on known data before a backend
 * exists. The screen shows "Showing fixture G1" while it is in use.
 */
export const g1DataSource: GanttDataSource = {
  load: async () => g1Snapshot(),
};
