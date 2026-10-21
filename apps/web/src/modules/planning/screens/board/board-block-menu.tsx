// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { useNavigate } from '@tanstack/react-router';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../../../../ui/primitives/dropdown-menu.tsx';
import type { GanttSnapshot } from '../../gantt-data.ts';
import { moveRefusalOf, refusalMessage } from '../gantt/gantt-move.ts';

/**
 * The block menu (plan 07, Moving without dragging; design D3, IN7): Move, which opens the Move
 * dialog, and Open order, at the block that Shift+F10, the context menu key or a right click opened
 * it from; Escape returns focus to the block. A job order that cannot move keeps Move, disabled and
 * named with the reason. Lock and Break soft lock wait for the plan server.
 */
export function BlockMenu({
  menu,
  snapshot,
  plant,
  onClose,
  onMove,
}: {
  readonly menu: { readonly jobOrderId: string; readonly anchor: HTMLElement } | undefined;
  readonly snapshot: GanttSnapshot;
  readonly plant: string;
  readonly onClose: () => void;
  readonly onMove: (jobOrderId: string) => void;
}) {
  const navigate = useNavigate();
  const order =
    menu === undefined
      ? undefined
      : snapshot.productionOrders.find((each) =>
          each.jobOrders.some((row) => row.id === menu.jobOrderId),
        );
  const row = order?.jobOrders.find((each) => each.id === menu?.jobOrderId);
  const refused = menu === undefined ? undefined : moveRefusalOf(snapshot, menu.jobOrderId);
  return (
    <DropdownMenu
      open={menu !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DropdownMenuContent
        anchor={menu?.anchor}
        aria-label={`Actions for ${row?.displayNumber ?? ''}`}
        finalFocus={() => menu?.anchor ?? true}
        className="w-56"
      >
        <DropdownMenuItem
          disabled={refused !== undefined}
          onClick={() => {
            if (menu !== undefined && refused === undefined) onMove(menu.jobOrderId);
          }}
        >
          Move
          {refused !== undefined && row !== undefined && (
            <span className="sr-only">, {refusalMessage(row.displayNumber, refused)}</span>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            if (order === undefined) return;
            onClose();
            void navigate({ href: planningLinks.orders.order({ plant, orderId: order.id }).href });
          }}
        >
          Open order
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
