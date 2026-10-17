// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { formatPlantDateTime, formatSpan } from '@northmes/contracts/format';
import { useEffect, useId, useRef } from 'react';
import { ConfirmDialog } from '../../../../ui/components/confirm-dialog/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { Badge } from '../../../../ui/primitives/badge.tsx';
import { Button } from '../../../../ui/primitives/button.tsx';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../../../../ui/primitives/sheet.tsx';
import type { DraftChange, DraftConflict, GanttDraft } from '../../gantt-draft.ts';

/** Why Save is drawn disabled until the plan server exists (plan 18, phase 2). */
export const saveReason = 'Saving needs the plan server.';

export interface GanttDraftDrawerProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly draft: GanttDraft;
  readonly conflicts: readonly DraftConflict[];
  readonly timeZone: string;
  readonly machineName: (code: string | undefined) => string;
  readonly onCascadeFromHere: (conflict: DraftConflict) => void;
  readonly onMoveBack: (conflict: DraftConflict) => void;
  readonly onDiscardChange: (jobOrderId: string) => void;
  readonly onDiscardDraft: () => void;
  /** The element that takes focus once the drawer has closed. */
  readonly finalFocus: () => HTMLElement | null;
}

/** "1 change", "6 changes". */
export function changesText(count: number): string {
  return count === 1 ? '1 change' : `${count} changes`;
}

/** One conflict line (plan 18, Resolving a break in the draft) with the actions that fit its kind. */
function ConflictLine({
  conflict,
  onCascadeFromHere,
  onMoveBack,
}: {
  readonly conflict: DraftConflict;
  readonly onCascadeFromHere: () => void;
  readonly onMoveBack: () => void;
}) {
  const precedence = ['LEAD_TIME', 'SEND_AHEAD', 'LAST_PIECE'].includes(conflict.code);
  return (
    <li
      className="grid gap-1.5 rounded-md border border-late-foreground/40 p-2"
      data-conflict={conflict.code}
    >
      <p className="text-[0.8125rem] leading-[1.125rem]">
        {conflict.text} ({conflict.code})
      </p>
      <div className="flex flex-wrap gap-1.5">
        {precedence && (
          <Button variant="outline" className="h-7 px-2.5 text-xs" onClick={onCascadeFromHere}>
            Cascade from here
          </Button>
        )}
        <Button variant="outline" className="h-7 px-2.5 text-xs" onClick={onMoveBack}>
          Move back
        </Button>
      </div>
    </li>
  );
}

function ChangeLine({
  change,
  timeZone,
  machineName,
  onDiscard,
}: {
  readonly change: DraftChange;
  readonly timeZone: string;
  readonly machineName: (code: string | undefined) => string;
  readonly onDiscard: () => void;
}) {
  return (
    <li
      className="grid gap-1 border-b border-border py-1.5 last:border-b-0"
      data-draft-row={change.jobOrderId}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs font-semibold">{change.displayNumber}</span>
        <Badge variant="outline">Ready to save</Badge>
        <span className="grow" />
        <Button variant="ghost" className="h-7 px-2 text-xs" onClick={onDiscard}>
          Discard
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {machineName(change.equipment)},{' '}
        {formatSpan(change.to.setupStartMs, change.to.endMs, timeZone)}
        {change.from !== undefined &&
          `; was ${formatPlantDateTime(change.from.setupStartMs, timeZone)}`}
        {change.reason === 'cascade' && '; moved by the cascade'}
        {change.reason === 'snappedToRelease' && '; snapped to its release'}
        {change.reason === 'snappedToLastPiece' && '; snapped to its last-piece bound'}
      </p>
    </li>
  );
}

/**
 * The My draft drawer (plan 18, Resolving a break in the draft; D3 DR1): the changes of the
 * planner's draft with their status, every conflict the draft creates as one line with the actions
 * that fit it, Save changes disabled with its reason, and Discard draft, which asks first. The
 * conflict count is announced politely when it changes.
 */
export function GanttDraftDrawer({
  open,
  onClose,
  draft,
  conflicts,
  timeZone,
  machineName,
  onCascadeFromHere,
  onMoveBack,
  onDiscardChange,
  onDiscardDraft,
  finalFocus,
}: GanttDraftDrawerProps) {
  const reasonId = useId();
  const count = draft.changes.length;
  const spokenConflicts = useRef(conflicts.length);
  useEffect(() => {
    if (conflicts.length === spokenConflicts.current) return;
    spokenConflicts.current = conflicts.length;
    if (count > 0) {
      announce(
        conflicts.length === 1
          ? '1 conflict in your draft'
          : `${conflicts.length} conflicts in your draft`,
      );
    }
  }, [conflicts.length, count]);
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent
        side="right"
        data-draft-drawer
        finalFocus={() => finalFocus() ?? undefined}
        className="w-80 gap-3 overflow-y-auto p-4 text-sm sm:max-w-sm"
      >
        <SheetHeader className="p-0">
          <SheetTitle className="text-base font-semibold">
            {count === 0 ? 'My draft' : `My draft, ${changesText(count)}`}
          </SheetTitle>
          <SheetDescription className="text-data">
            Moves on the Gantt go into your draft. Save writes them to the plan.
          </SheetDescription>
        </SheetHeader>
        {count === 0 ? (
          <p className="text-[0.8125rem]">No changes in your draft</p>
        ) : (
          <>
            {conflicts.length === 0 ? (
              <p className="text-[0.8125rem] text-muted-foreground">No conflicts in your draft</p>
            ) : (
              <ul
                aria-label={
                  conflicts.length === 1
                    ? '1 conflict in your draft'
                    : `${conflicts.length} conflicts in your draft`
                }
                className="grid gap-1.5"
              >
                {conflicts.map((conflict) => (
                  <ConflictLine
                    key={`${conflict.code}-${conflict.rows.join('-')}`}
                    conflict={conflict}
                    onCascadeFromHere={() => onCascadeFromHere(conflict)}
                    onMoveBack={() => onMoveBack(conflict)}
                  />
                ))}
              </ul>
            )}
            <ul aria-label="Changes" className="grid">
              {draft.changes.map((change) => (
                <ChangeLine
                  key={change.jobOrderId}
                  change={change}
                  timeZone={timeZone}
                  machineName={machineName}
                  onDiscard={() => onDiscardChange(change.jobOrderId)}
                />
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button aria-disabled="true" aria-describedby={reasonId} className="h-8 px-3">
                Save changes
              </Button>
              <ConfirmDialog
                trigger={
                  <Button variant="outline" className="h-8 px-3">
                    Discard draft
                  </Button>
                }
                title={`Discard all ${changesText(count)}?`}
                description="Every move in your draft is undone and the plan shows the committed rows again."
                confirmLabel={`Discard ${changesText(count)}`}
                destructive
                onConfirm={async () => onDiscardDraft()}
              />
            </div>
            <p id={reasonId} className="text-xs text-muted-foreground">
              {saveReason}
            </p>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
