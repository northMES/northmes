// SPDX-License-Identifier: AGPL-3.0-or-later
import { type DashboardWidgetType, dashboardSizesOf } from '@northmes/core-contracts';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
import { type FormEvent, useId, useState } from 'react';
import { TextField } from '../../../../ui/components/text-field/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { Button } from '../../../../ui/primitives/button.tsx';
import { Label } from '../../../../ui/primitives/label.tsx';
import { RadioGroup, RadioGroupItem } from '../../../../ui/primitives/radio-group.tsx';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '../../../../ui/primitives/sheet.tsx';
import { typeName } from './dashboard-catalog.tsx';
import {
  type EditedWidget,
  type MoveDirection,
  moveWidget,
  positionText,
  resizeWidget,
  sizeName,
  sizeText,
} from './dashboard-edit-layout.ts';

/** The longest title core.saveDashboardTab takes. */
const titleMax = 80;

/** The Position buttons, in the order of B3 (design shell-454). */
const moves: readonly { direction: MoveDirection; label: string; Icon: typeof ArrowUp }[] = [
  { direction: 'up', label: 'Move up', Icon: ArrowUp },
  { direction: 'down', label: 'Move down', Icon: ArrowDown },
  { direction: 'left', label: 'Move left', Icon: ArrowLeft },
  { direction: 'right', label: 'Move right', Icon: ArrowRight },
];

interface SettingsFormProps {
  readonly widgetId: string;
  readonly widgets: readonly EditedWidget[];
  readonly onApply: (widgets: readonly EditedWidget[], title: string) => void;
}

/**
 * The form of the settings Sheet. It works on its own copy of the layout, so Position and Size show
 * their result in words while the grid under the Sheet stays as it was until Apply (design
 * shell-454, A3).
 */
function SettingsForm({ widgetId, widgets, onApply }: SettingsFormProps) {
  const [layout, setLayout] = useState(widgets);
  const start = widgets.find(({ id }) => id === widgetId);
  const [title, setTitle] = useState(start?.title ?? '');
  const [error, setError] = useState<string>();
  const sizeId = useId();
  const widget = layout.find(({ id }) => id === widgetId);
  if (start === undefined || widget === undefined) return null;
  const type = widget.type.toLowerCase() as DashboardWidgetType;

  const move = (direction: MoveDirection) => {
    const next = moveWidget(layout, widgetId, direction);
    setLayout(next);
    const moved = next.find(({ id }) => id === widgetId) ?? widget;
    announce(positionText(moved));
  };
  const apply = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (trimmed === '') return setError('Enter a title.');
    if (trimmed.length > titleMax) return setError(`Use at most ${titleMax} characters.`);
    onApply(layout, trimmed);
  };

  return (
    <form onSubmit={apply} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
        <TextField
          label="Title"
          value={title}
          maxLength={titleMax + 20}
          error={error}
          hint="The widget's heading. Two copies of one widget read best with different titles."
          onChange={(event) => {
            setTitle(event.target.value);
            setError(undefined);
          }}
        />
        <div className="flex flex-col gap-2">
          <p id={sizeId} className="text-xs font-semibold">
            Size
          </p>
          <RadioGroup
            aria-labelledby={sizeId}
            value={widget.size}
            onValueChange={(size) => {
              const next = resizeWidget(layout, widgetId, size as EditedWidget['size']);
              setLayout(next);
              announce(`${sizeText(size as EditedWidget['size'])}.`);
            }}
            className="gap-3"
          >
            {dashboardSizesOf[type].map((lower) => {
              const size = lower.toUpperCase() as EditedWidget['size'];
              const id = `${sizeId}-${lower}`;
              return (
                <div key={size} className="flex items-center gap-3 text-sm">
                  <RadioGroupItem id={id} value={size} />
                  <Label htmlFor={id} className="font-normal">
                    {sizeName(size)}
                    <span className="text-muted-foreground">
                      {sizeText(size).slice(sizeName(size).length)}
                    </span>
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-xs font-semibold">Position</legend>
          <div className="grid grid-cols-2 gap-2">
            {moves.map(({ direction, label, Icon }) => (
              <Button
                key={direction}
                type="button"
                variant="outline"
                onClick={() => move(direction)}
              >
                <Icon aria-hidden />
                {label}
              </Button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">{positionText(widget)}</p>
        </fieldset>
      </div>
      <SheetFooter className="flex-row border-t">
        <Button type="submit">Apply</Button>
        <SheetClose render={<Button type="button" variant="outline" />}>Cancel</SheetClose>
      </SheetFooter>
    </form>
  );
}

export interface DashboardWidgetSettingsProps {
  /** The widget whose settings show, or undefined while the Sheet is closed. */
  readonly widgetId: string | undefined;
  readonly widgets: readonly EditedWidget[];
  readonly tabName: string;
  readonly onClose: () => void;
  /** Takes the layout with the widget's new size and place, and its title. */
  readonly onApply: (widgets: readonly EditedWidget[], title: string) => void;
  /** Where focus goes when the Sheet closes: the widget's Widget actions. */
  readonly finalFocus: () => HTMLElement | null;
}

/**
 * The settings of one widget in edit mode (design shell-454, A3, with B's Position): its Title, its
 * Size among the sizes its type allows, and Position, four buttons that move it a step and say its
 * place. The changes reach the grid on Apply; Cancel and Escape drop them.
 */
export function DashboardWidgetSettings({
  widgetId,
  widgets,
  tabName,
  onClose,
  onApply,
  finalFocus,
}: DashboardWidgetSettingsProps) {
  // The Sheet keeps the last widget while it closes, so its content does not jump.
  const [shownId, setShownId] = useState(widgetId);
  if (widgetId !== undefined && widgetId !== shownId) setShownId(widgetId);
  const widget = widgets.find(({ id }) => id === shownId);
  return (
    <Sheet
      open={widgetId !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="w-full gap-0 sm:max-w-md" finalFocus={finalFocus}>
        <SheetHeader className="border-b">
          <SheetTitle className="text-lg">Widget settings</SheetTitle>
          {widget !== undefined && (
            <SheetDescription>
              {widget.title}: a {typeName(widget.type.toLowerCase() as DashboardWidgetType)} on{' '}
              {tabName}.
            </SheetDescription>
          )}
        </SheetHeader>
        {widgetId !== undefined && (
          <SettingsForm key={widgetId} widgetId={widgetId} widgets={widgets} onApply={onApply} />
        )}
      </SheetContent>
    </Sheet>
  );
}
