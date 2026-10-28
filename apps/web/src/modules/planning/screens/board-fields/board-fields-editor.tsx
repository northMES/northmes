// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cn } from 'cn';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { IconButton } from '../../../../ui/components/icon-button/index.ts';
import { Badge } from '../../../../ui/primitives/badge.tsx';
import { Button } from '../../../../ui/primitives/button.tsx';
import type { BoardFieldOption } from '../../board-fields.ts';
import { BoardFieldsPicker } from './board-fields-picker.tsx';

/** The control that keeps focus after a change, by field id and action. */
type FocusTarget = { readonly id: string; readonly action: 'up' | 'down' | 'remove' } | 'add';

/**
 * One list's editor (#762, BF2): the fields in order, each with its source and Move up, Move down
 * and Remove, so the order changes without dragging (WCAG 2.5.7). Focus stays on the moved field's
 * button, or moves to the next field's Remove, and a status line says what changed. Add opens the
 * picker; a block list stops at its limit.
 */
export function BoardFieldsEditor({
  label,
  ids,
  optionOf,
  catalog,
  limit,
  addLabel,
  emptyTitle,
  emptyText,
  onChange,
}: {
  /** The list's name, such as Block fields. */
  readonly label: string;
  readonly ids: readonly string[];
  readonly optionOf: (id: string) => BoardFieldOption;
  readonly catalog: Parameters<typeof BoardFieldsPicker>[0]['catalog'];
  /** The most fields the list takes; none for the hover fields. */
  readonly limit?: number;
  readonly addLabel: string;
  readonly emptyTitle: string;
  readonly emptyText: string;
  readonly onChange: (ids: readonly string[]) => void;
}) {
  const [status, setStatus] = useState('');
  const [picking, setPicking] = useState(false);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const addButton = useRef<HTMLButtonElement>(null);
  const focusNext = useRef<FocusTarget | undefined>(undefined);
  useEffect(() => {
    const target = focusNext.current;
    if (target === undefined) return;
    focusNext.current = undefined;
    if (target === 'add') addButton.current?.focus();
    else buttons.current.get(`${target.id}:${target.action}`)?.focus();
  });
  const full = limit !== undefined && ids.length >= limit;
  const countText = (count: number) =>
    limit === undefined
      ? `${count} ${count === 1 ? 'field' : 'fields'}.`
      : `${count} of ${limit} fields.`;

  const move = (index: number, by: -1 | 1) => {
    const id = ids[index];
    if (id === undefined) return;
    const next = [...ids];
    next.splice(index, 1);
    next.splice(index + by, 0, id);
    focusNext.current = { id, action: by === -1 ? 'up' : 'down' };
    // A field moved to an end keeps focus on the other move button, which stays enabled.
    if (index + by === 0 && by === -1) focusNext.current = { id, action: 'down' };
    if (index + by === ids.length - 1 && by === 1) focusNext.current = { id, action: 'up' };
    onChange(next);
    setStatus(`${optionOf(id).label} moved to position ${index + by + 1} of ${ids.length}.`);
  };
  const remove = (index: number) => {
    const id = ids[index];
    if (id === undefined) return;
    const next = ids.filter((_, each) => each !== index);
    const after = next[index] ?? next[index - 1];
    focusNext.current = after === undefined ? 'add' : { id: after, action: 'remove' };
    onChange(next);
    setStatus(`${optionOf(id).label} removed. ${countText(next.length)}`);
  };
  const add = (added: readonly string[]) => {
    setPicking(false);
    if (added.length === 0) return;
    const next = [...ids, ...added];
    const last = next[next.length - 1];
    // A list the fields fill disables Add, so focus goes to the last field's Remove instead.
    focusNext.current =
      limit !== undefined && next.length >= limit && last !== undefined
        ? { id: last, action: 'remove' }
        : 'add';
    onChange(next);
    setStatus(
      `${added.length === 1 ? `${optionOf(added[0] ?? '').label} added` : `${added.length} fields added`}. ${countText(next.length)}`,
    );
  };

  return (
    <div className="grid gap-3">
      {ids.length === 0 ? (
        <div className="grid gap-1 rounded-md border border-dashed border-input p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{emptyTitle}</p>
          <p>{emptyText}</p>
        </div>
      ) : (
        <ol
          aria-label={`${label}, in order`}
          className="overflow-hidden rounded-md border border-border"
        >
          {ids.map((id, index) => {
            const option = optionOf(id);
            return (
              <li
                key={id}
                data-field-label={option.label}
                className="flex min-h-10 flex-wrap items-center gap-2 border-t border-border py-1 ps-2 pe-1 first:border-t-0"
              >
                <span aria-hidden className="w-6 text-end font-mono text-xs text-muted-foreground">
                  {index + 1}
                </span>
                <span className="flex min-w-24 flex-1 flex-wrap items-center gap-2">
                  <span className={cn(option.source === 'erp' && 'font-mono text-[0.8125rem]')}>
                    {option.label}
                  </span>
                  <Badge variant="secondary">{option.sourceLabel}</Badge>
                </span>
                <span className="ms-auto flex gap-0.5">
                  <IconButton
                    label={`Move ${option.label} up`}
                    variant="ghost"
                    disabled={index === 0}
                    ref={(button: HTMLButtonElement | null) => {
                      if (button === null) buttons.current.delete(`${id}:up`);
                      else buttons.current.set(`${id}:up`, button);
                    }}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp aria-hidden />
                  </IconButton>
                  <IconButton
                    label={`Move ${option.label} down`}
                    variant="ghost"
                    disabled={index === ids.length - 1}
                    ref={(button: HTMLButtonElement | null) => {
                      if (button === null) buttons.current.delete(`${id}:down`);
                      else buttons.current.set(`${id}:down`, button);
                    }}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown aria-hidden />
                  </IconButton>
                  <IconButton
                    label={`Remove ${option.label}`}
                    variant="ghost"
                    ref={(button: HTMLButtonElement | null) => {
                      if (button === null) buttons.current.delete(`${id}:remove`);
                      else buttons.current.set(`${id}:remove`, button);
                    }}
                    onClick={() => remove(index)}
                  >
                    <X aria-hidden />
                  </IconButton>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button
          ref={addButton}
          type="button"
          variant="outline"
          disabled={full}
          onClick={() => setPicking(true)}
        >
          <Plus aria-hidden />
          {addLabel}
        </Button>
        {limit !== undefined && (
          <p className="text-[0.8125rem] text-muted-foreground">
            {full ? `${limit} of ${limit}. Remove a field to add another.` : countText(ids.length)}
          </p>
        )}
        <p role="status" className="text-[0.8125rem] text-muted-foreground">
          {status}
        </p>
      </div>
      <BoardFieldsPicker
        open={picking}
        title={addLabel}
        catalog={catalog}
        added={ids}
        room={limit === undefined ? undefined : limit - ids.length}
        onAdd={add}
        onCancel={() => setPicking(false)}
      />
    </div>
  );
}
