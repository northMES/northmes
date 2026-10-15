// SPDX-License-Identifier: AGPL-3.0-or-later
import { dashboardMaxWidgets } from '@northmes/core-contracts';
import { ArrowDown, ArrowUp, Ellipsis, GripVertical, Plus, Settings2, Trash2 } from 'lucide-react';
import { type KeyboardEvent, type ReactNode, useEffect, useState } from 'react';
import { GridLayout, type Layout, useContainerWidth } from 'react-grid-layout';
import { announce } from '../../../../ui/lib/announce.ts';
import { Button } from '../../../../ui/primitives/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../../ui/primitives/dropdown-menu.tsx';
import {
  compactLayout,
  type EditedWidget,
  firstFreePlace,
  type MoveDirection,
  moveWidget,
  positionText,
  removeWidget,
} from './dashboard-edit-layout.ts';
import { columnsFor, gridLayout, readingOrder } from './dashboard-layout.ts';
import { DashboardWidget } from './dashboard-widget.tsx';

/** The grid's row height and gaps in px, as when viewing (design shell-454). */
const rowHeight = 72;
const gap = 16;

/** The id of the Add widget tile, a grid item beside the widgets. */
const tileId = 'add-widget';

/** The DOM ids of a widget's move button and Widget actions button, for focus. */
export const moveButtonId = (id: string) => `dashboard-move-${id}`;
export const actionsButtonId = (id: string) => `dashboard-actions-${id}`;
/** The DOM id of the Add widget tile's button. */
export const addTileId = 'dashboard-add-widget';

/** The arrow keys of a keyboard move and their direction. */
const arrows: Readonly<Record<string, MoveDirection>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/** The edge of the grid a widget that cannot move in a direction stands at. */
const edges: Readonly<Record<MoveDirection, string>> = {
  up: 'top',
  down: 'bottom',
  left: 'left edge',
  right: 'right edge',
};

/** A keyboard move in progress: the widget, the layout before the pickup and the DOM order. */
interface Pickup {
  readonly id: string;
  readonly before: readonly EditedWidget[];
  readonly order: readonly string[];
}

export interface DashboardEditGridProps {
  readonly tabName: string;
  readonly widgets: readonly EditedWidget[];
  readonly onChange: (widgets: readonly EditedWidget[]) => void;
  /** Opens the settings Sheet of a widget. */
  readonly onSettings: (id: string) => void;
  /** Opens the catalog for a widget at this place. */
  readonly onAdd: (place: { x: number; y: number }) => void;
}

/**
 * The open tab in edit mode (design shell-454, option A, with C's Add widget tile). Each widget
 * has Widget actions, with Settings, Move up, Move down and Remove. At 12 columns the column
 * guides show, and each widget has a move button that is also its drag handle: Enter or Space
 * picks the widget up, the arrow keys move it, Enter drops it and Escape puts it back, each step
 * said in the polite region (A7, WCAG 2.1.1, 2.5.7, 4.1.3). The widgets keep their DOM order while
 * one is picked up and take reading order again on the drop, with focus back on its move button.
 * The Add widget tile sits at the first free place; at 6 and one column it comes last. A drag at
 * 6 columns has no 12-column place to save, so moves there go through Widget actions.
 */
export function DashboardEditGrid({
  tabName,
  widgets,
  onChange,
  onSettings,
  onAdd,
}: DashboardEditGridProps) {
  const { width, containerRef, mounted } = useContainerWidth();
  const columns = columnsFor(width);
  const [pickup, setPickup] = useState<Pickup>();
  const [focusId, setFocusId] = useState<string>();
  useEffect(() => {
    if (focusId === undefined) return;
    document.getElementById(focusId)?.focus();
    setFocusId(undefined);
  }, [focusId]);

  const ordered =
    pickup === undefined
      ? readingOrder(widgets)
      : pickup.order.flatMap((id) => widgets.filter((widget) => widget.id === id));
  const tile = widgets.length < dashboardMaxWidgets ? firstFreePlace(widgets, 'SMALL') : undefined;
  const title = (id: string) => widgets.find((widget) => widget.id === id)?.title ?? '';
  const placeOf = (layout: readonly EditedWidget[], id: string) =>
    layout.find((widget) => widget.id === id) ?? { x: 0, y: 0 };

  const step = (id: string, direction: MoveDirection, focus: string) => {
    const next = moveWidget(widgets, id, direction);
    if (next === widgets) {
      announce(`${title(id)} is already at the ${edges[direction]}.`);
      return;
    }
    onChange(next);
    announce(`${title(id)} moved. ${positionText(placeOf(next, id))}`);
    setFocusId(focus);
  };
  const remove = (id: string) => {
    onChange(removeWidget(widgets, id));
    announce(`${title(id)} removed.`);
    setFocusId(addTileId);
  };
  const drop = () => {
    if (pickup === undefined) return;
    announce(`${title(pickup.id)} dropped. ${positionText(placeOf(widgets, pickup.id))}`);
    setPickup(undefined);
    setFocusId(moveButtonId(pickup.id));
  };
  const onMoveKey = (id: string) => (event: KeyboardEvent) => {
    const direction = arrows[event.key];
    if (pickup === undefined || pickup.id !== id) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      setPickup({ id, before: widgets, order: ordered.map((widget) => widget.id) });
      announce(
        `${title(id)} picked up. ${positionText(placeOf(widgets, id))} Arrow keys move it, Enter drops it, Escape cancels.`,
      );
      return;
    }
    if (direction !== undefined) {
      event.preventDefault();
      const next = moveWidget(widgets, id, direction);
      if (next !== widgets) onChange(next);
      announce(positionText(placeOf(next, id)));
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      drop();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onChange(pickup.before);
      setPickup(undefined);
      announce(
        `Move cancelled. ${title(id)} is back at ${positionText(placeOf(pickup.before, id)).replace('Column', 'column')}`,
      );
    }
  };

  const chrome = (widget: EditedWidget, movable: boolean) => (
    <DashboardWidget
      widget={widget}
      className="border border-dashed border-foreground/30 ring-0"
      leading={
        movable ? (
          <Button
            id={moveButtonId(widget.id)}
            variant="ghost"
            size="icon-sm"
            aria-label={`Move ${widget.title}`}
            aria-pressed={pickup?.id === widget.id}
            className="dashboard-move cursor-grab"
            onKeyDown={onMoveKey(widget.id)}
            onBlur={() => {
              if (pickup?.id === widget.id) drop();
            }}
          >
            <GripVertical aria-hidden />
          </Button>
        ) : undefined
      }
      trailing={
        <WidgetActions
          widget={widget}
          onSettings={() => onSettings(widget.id)}
          onMove={(direction) => step(widget.id, direction, actionsButtonId(widget.id))}
          onRemove={() => remove(widget.id)}
        />
      }
    />
  );
  const tileButton = tile && (
    <AddWidgetTile onClick={() => onAdd(tile)} className={columns === 1 ? 'min-h-40' : ''} />
  );
  const label = `Widgets of ${tabName}`;

  if (!mounted || columns === 1) {
    return (
      <div ref={containerRef}>
        <ol aria-label={label} className="flex flex-col gap-4">
          {ordered.map((widget) => (
            <li key={widget.id}>{chrome(widget, false)}</li>
          ))}
          {tileButton && <li>{tileButton}</li>}
        </ol>
      </div>
    );
  }

  const movable = columns === 12;
  const items: Layout = [
    ...gridLayout(widgets, columns, { movable }),
    ...(tile === undefined
      ? []
      : [
          movable
            ? { i: tileId, ...tile, w: 3, h: 2, static: true }
            : { i: tileId, x: 0, y: 10_000, w: 3, h: 2, static: false },
        ]),
  ];
  const children: { key: string; node: ReactNode; x: number; y: number }[] = ordered.map(
    (widget) => ({ key: widget.id, node: chrome(widget, movable), x: widget.x, y: widget.y }),
  );
  if (tileButton) {
    const at = movable && tile ? tile : { x: 0, y: Number.MAX_SAFE_INTEGER };
    const index = children.findIndex(({ x, y }) => y > at.y || (y === at.y && x > at.x));
    children.splice(index === -1 ? children.length : index, 0, {
      key: tileId,
      node: tileButton,
      ...at,
    });
  }
  return (
    <div ref={containerRef} className="relative">
      {movable && (
        <div aria-hidden className="pointer-events-none absolute inset-0 grid grid-cols-12 gap-4">
          {Array.from({ length: 12 }, (_, index) => (
            <div key={index} className="rounded-md bg-muted/60" />
          ))}
        </div>
      )}
      {/* biome-ignore lint/a11y/useSemanticElements: an ol may hold only li, and the library's div sits between. */}
      <div role="list" aria-label={label}>
        <GridLayout
          width={width}
          layout={items}
          gridConfig={{ cols: columns, rowHeight, margin: [gap, gap], containerPadding: [0, 0] }}
          dragConfig={{ enabled: movable, handle: '.dashboard-move' }}
          resizeConfig={{ enabled: false }}
          onDragStop={(layout, _old, item) => {
            const placed = widgets.map((widget) => {
              const at = layout.find(({ i }) => i === widget.id);
              return at === undefined ? widget : { ...widget, x: at.x, y: at.y };
            });
            const next = compactLayout(placed);
            onChange(next);
            if (item !== null && item.i !== tileId) {
              announce(`${title(item.i)} dropped. ${positionText(placeOf(next, item.i))}`);
            }
          }}
          className="dashboard-grid"
        >
          {children.map(({ key, node }) => (
            // biome-ignore lint/a11y/useSemanticElements: the library places each item as a div.
            <div key={key} role="listitem">
              {node}
            </div>
          ))}
        </GridLayout>
      </div>
    </div>
  );
}

/** A widget's Widget actions menu in edit mode (design shell-454, A9). */
function WidgetActions({
  widget,
  onSettings,
  onMove,
  onRemove,
}: {
  readonly widget: EditedWidget;
  readonly onSettings: () => void;
  readonly onMove: (direction: 'up' | 'down') => void;
  readonly onRemove: () => void;
}) {
  const label = `Widget actions, ${widget.title}`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            id={actionsButtonId(widget.id)}
            variant="ghost"
            size="icon-sm"
            aria-label={label}
          />
        }
      >
        <Ellipsis aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44" aria-label={label}>
        <DropdownMenuItem onClick={onSettings}>
          <Settings2 aria-hidden />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onMove('up')}>
          <ArrowUp aria-hidden />
          Move up
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onMove('down')}>
          <ArrowDown aria-hidden />
          Move down
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onRemove}>
          <Trash2 aria-hidden />
          Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The Add widget tile at the first free place in edit mode (design shell-454, C2). */
function AddWidgetTile({
  onClick,
  className,
}: {
  readonly onClick: () => void;
  readonly className?: string;
}) {
  return (
    <button
      id={addTileId}
      type="button"
      onClick={onClick}
      className={`flex size-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-foreground/40 bg-background text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ${className ?? ''}`}
    >
      <Plus aria-hidden className="size-5" />
      Add widget
    </button>
  );
}
