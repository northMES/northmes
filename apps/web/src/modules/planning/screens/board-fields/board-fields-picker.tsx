// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { cn } from 'cn';
import { useId, useState } from 'react';
import { SearchField } from '../../../../ui/components/search-field/index.ts';
import { Badge } from '../../../../ui/primitives/badge.tsx';
import { Button } from '../../../../ui/primitives/button.tsx';
import { Checkbox } from '../../../../ui/primitives/checkbox.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/primitives/dialog.tsx';
import type { BoardFieldOption } from '../../board-fields.ts';

/** The catalog's groups as the picker shows them (#762, BF4). */
export interface BoardFieldsCatalog {
  readonly core: readonly BoardFieldOption[];
  readonly erp: readonly BoardFieldOption[];
  readonly module: readonly BoardFieldOption[];
}

/**
 * The field picker (#762, BF4): the NorthMES fields, the ERP fields found in the imported orders
 * with a sample value and how many orders carry each, and the module fields, each with its source.
 * A field already in the list shows checked and disabled as Added; a block list's picker stops at
 * the room the list has left. The chosen fields go to the end of the list in the picker's order.
 */
export function BoardFieldsPicker({
  open,
  title,
  catalog,
  added,
  room,
  onAdd,
  onCancel,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly catalog: BoardFieldsCatalog;
  readonly added: readonly string[];
  /** How many more fields the list takes; none for no limit. */
  readonly room?: number;
  readonly onAdd: (ids: readonly string[]) => void;
  readonly onCancel: () => void;
}) {
  const [chosen, setChosen] = useState<readonly string[]>([]);
  const [query, setQuery] = useState('');
  const baseId = useId();
  // The picker starts empty each time: what it held goes when it closes, by Add or by Cancel.
  const close = (then: () => void) => {
    setChosen([]);
    setQuery('');
    then();
  };
  const groups = [
    { key: 'core', title: 'NorthMES fields', options: catalog.core },
    { key: 'erp', title: 'ERP fields, found in the imported orders', options: catalog.erp },
    { key: 'module', title: 'Module fields', options: catalog.module },
  ];
  const text = query.trim().toLowerCase();
  const matches = (option: BoardFieldOption) =>
    text === '' ||
    option.label.toLowerCase().includes(text) ||
    option.description.toLowerCase().includes(text);
  const roomLeft = room === undefined ? undefined : room - chosen.length;
  // The chosen fields in the picker's order, which is the order they join the list in.
  const ordered = groups.flatMap((group) =>
    group.options.map((option) => option.id).filter((id) => chosen.includes(id)),
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close(onCancel);
      }}
    >
      <DialogContent className="max-h-[calc(100vh-2rem)] grid-rows-[auto_auto_minmax(0,1fr)_auto] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            The fields go to the end of the list; move them afterwards. Fields already in the list
            are marked Added.
            {room !== undefined && ` The list takes ${room} more.`}
          </DialogDescription>
        </DialogHeader>
        <SearchField label="Search fields" value={query} onSearch={setQuery} />
        <div className="grid min-h-0 content-start gap-4 overflow-y-auto pe-1">
          {groups.map((group) => {
            const shown = group.options.filter(matches);
            if (shown.length === 0) return null;
            return (
              <fieldset key={group.key} className="grid gap-0.5">
                <legend className="pb-1 text-xs font-semibold text-muted-foreground">
                  {group.title}
                </legend>
                {shown.map((option, index) => {
                  const isAdded = added.includes(option.id);
                  const isChosen = chosen.includes(option.id);
                  const disabled =
                    isAdded || (!isChosen && roomLeft !== undefined && roomLeft <= 0);
                  // ERP keys are as the ERP sent them, so the element ids take the position.
                  const id = `${baseId}-${group.key}-${index}`;
                  return (
                    <label
                      key={option.id}
                      htmlFor={id}
                      className={cn(
                        'grid min-h-9 grid-cols-[auto_1fr_auto] items-center gap-x-2.5 rounded-md px-2 py-1',
                        isChosen && 'bg-info-subtle',
                        disabled && 'text-muted-foreground',
                      )}
                    >
                      <Checkbox
                        id={id}
                        checked={isAdded || isChosen}
                        disabled={disabled}
                        onCheckedChange={(checked) =>
                          setChosen((current) =>
                            checked
                              ? [...current, option.id]
                              : current.filter((each) => each !== option.id),
                          )
                        }
                      />
                      <span className="grid leading-[1.125rem]">
                        <span
                          className={cn(option.source === 'erp' && 'font-mono text-[0.8125rem]')}
                        >
                          {option.label}
                        </span>
                        <span className="text-xs text-muted-foreground">{option.description}</span>
                      </span>
                      <Badge variant="secondary">{isAdded ? 'Added' : option.sourceLabel}</Badge>
                    </label>
                  );
                })}
              </fieldset>
            );
          })}
        </div>
        <DialogFooter className="items-center">
          <p className="me-auto text-sm text-muted-foreground">
            {chosen.length === 1 ? '1 field chosen' : `${chosen.length} fields chosen`}
          </p>
          <Button type="button" variant="outline" onClick={() => close(onCancel)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={chosen.length === 0}
            onClick={() => close(() => onAdd(ordered))}
          >
            {chosen.length === 0
              ? 'Add fields'
              : chosen.length === 1
                ? 'Add 1 field'
                : `Add ${chosen.length} fields`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
