// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation } from '@apollo/client/react';
import {
  type DashboardWidgetType,
  dashboardMaxWidgets,
  dashboardSizesOf,
  dashboardSizeUnits,
} from '@northmes/core-contracts';
import { Check, Pencil } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { v7 as uuidv7 } from 'uuid';
import { ConflictSummary } from '../../../../ui/components/conflict-summary/index.ts';
import { ErrorSummary } from '../../../../ui/components/error-summary/index.ts';
import { UnsavedChangesGuard } from '../../../../ui/components/unsaved-changes-guard/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { hasErrorCode, refusalMessage } from '../../../../ui/lib/graphql-errors.ts';
import { Button } from '../../../../ui/primitives/button.tsx';
import { DashboardCatalog, typeName } from './dashboard-catalog.tsx';
import { actionsButtonId, addTileId, DashboardEditGrid } from './dashboard-edit-grid.tsx';
import {
  addWidget,
  compactLayout,
  type EditedWidget,
  firstFreePlace,
  layoutInput,
  positionText,
} from './dashboard-edit-layout.ts';
import type { DashboardTab } from './dashboard-tabs.graphql.ts';
import { DashboardWidgetSettings } from './dashboard-widget-settings.tsx';
import { CoreSaveDashboardTab } from './save-dashboard-tab.graphql.ts';

/** Who sees each kind of tab, as the edit bar says it (design shell-454, A1). */
const audiences: Readonly<Record<DashboardTab['scope'], string>> = {
  COMPANY: 'Everyone at the company sees this tab.',
  PLANT: 'Everyone at this plant sees this tab.',
  OWN: 'Only you see this tab, at every plant of the company.',
};

/** A session's starting point: the saved layout, pulled up as the grid shows it, and its version. */
interface Start {
  readonly version: number;
  readonly widgets: readonly EditedWidget[];
}

function startOf(tab: DashboardTab): Start {
  return {
    version: tab.version,
    widgets: compactLayout(tab.widgets.map(({ __typename, ...widget }) => widget)),
  };
}

/** Why the last Done did not save. */
type Problem =
  | { readonly kind: 'conflict' }
  | { readonly kind: 'failed'; readonly message: string };

export interface DashboardEditorProps {
  readonly tab: DashboardTab;
  /** Ends edit mode, after a save or a Cancel. */
  readonly onClose: () => void;
  /** Hears whether the session has changes that Done has not saved. */
  readonly onDirtyChange: (dirty: boolean) => void;
  /** Reads the tabs again and gives this tab as saved, after a version conflict. */
  readonly onReload: () => Promise<DashboardTab | undefined>;
}

/**
 * One edit session of a tab (design shell-454, option A): the edit bar, which says who sees the
 * tab, with Cancel and Done, the grid in edit mode, the catalog and the widget settings. The
 * changes stay in the page until Done, which saves the session as one command with the version
 * it started from (ADR 0078); a version conflict keeps the changes and offers Reload, which starts
 * the session again from the saved layout. Leaving the page with changes asks first.
 */
export function DashboardEditor({ tab, onClose, onDirtyChange, onReload }: DashboardEditorProps) {
  const [start, setStart] = useState(() => startOf(tab));
  const [widgets, setWidgets] = useState(start.widgets);
  const [catalogAt, setCatalogAt] = useState<{ x: number; y: number }>();
  const [settingsFor, setSettingsFor] = useState<string>();
  const [problem, setProblem] = useState<Problem>();
  const [save, { loading }] = useMutation(CoreSaveDashboardTab);
  // Where focus goes when a Sheet closes: the new widget's or the set-up widget's Widget actions.
  const focusAfterSheet = useRef<string>(undefined);
  const bar = useRef<HTMLElement>(null);
  const dirty = layoutInput(widgets) !== layoutInput(start.widgets);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    bar.current?.focus();
  }, []);

  const add = (type: DashboardWidgetType) => {
    const size = dashboardSizesOf[type][0];
    const upper = size.toUpperCase() as EditedWidget['size'];
    const place = catalogAt ?? firstFreePlace(widgets, upper);
    const widget: EditedWidget = {
      id: uuidv7(),
      type: type.toUpperCase() as EditedWidget['type'],
      size: upper,
      x: Math.min(place.x, 12 - dashboardSizeUnits[size].w),
      y: place.y,
      title: typeName(type),
    };
    const next = addWidget(widgets, widget);
    setWidgets(next);
    focusAfterSheet.current = actionsButtonId(widget.id);
    setCatalogAt(undefined);
    const placed = next.find(({ id }) => id === widget.id) ?? widget;
    announce(`${widget.title} added. ${positionText(placed)}`);
  };

  const done = async () => {
    if (!dirty) return onClose();
    setProblem(undefined);
    try {
      await save({
        variables: {
          input: { id: tab.id, expectedVersion: start.version, layout: layoutInput(widgets) },
        },
      });
      announce(`Saved ${tab.name}.`);
      onClose();
    } catch (error) {
      setProblem(
        hasErrorCode(error, 'core.version_conflict')
          ? { kind: 'conflict' }
          : {
              kind: 'failed',
              message:
                refusalMessage(error) ??
                'The layout was not saved. Check the connection, then select Done again.',
            },
      );
    }
  };

  const reload = async () => {
    const saved = await onReload();
    if (saved !== undefined) {
      const next = startOf(saved);
      setStart(next);
      setWidgets(next.widgets);
    }
    setProblem(undefined);
  };

  const full = widgets.length >= dashboardMaxWidgets;
  return (
    <div className="flex flex-col gap-4">
      <section
        ref={bar}
        tabIndex={-1}
        aria-label="Edit layout"
        className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm focus-visible:outline-none"
      >
        <Pencil aria-hidden className="size-4 shrink-0" />
        <p className="mr-auto min-w-0 flex-1 basis-60">
          Editing {tab.name}. {audiences[tab.scope]} Changes are saved when you select Done.
          {full && ` The tab holds ${dashboardMaxWidgets} widgets, the most a tab can.`}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={() => void done()} disabled={loading}>
            <Check aria-hidden />
            Done
          </Button>
        </div>
      </section>
      {problem?.kind === 'conflict' && (
        <ConflictSummary noun="dashboard tab" errors={[]} onReload={reload} />
      )}
      {problem?.kind === 'failed' && (
        <ErrorSummary heading="Could not save the layout" errors={[]}>
          <p>{problem.message}</p>
        </ErrorSummary>
      )}
      <DashboardEditGrid
        tabName={tab.name}
        widgets={widgets}
        onChange={setWidgets}
        onSettings={(id) => {
          focusAfterSheet.current = actionsButtonId(id);
          setSettingsFor(id);
        }}
        onAdd={(place) => {
          focusAfterSheet.current = addTileId;
          setCatalogAt(place);
        }}
      />
      <DashboardCatalog
        open={catalogAt !== undefined}
        onOpenChange={(open) => {
          if (!open) setCatalogAt(undefined);
        }}
        tabName={tab.name}
        onAdd={add}
        finalFocus={() => document.getElementById(focusAfterSheet.current ?? addTileId)}
      />
      <DashboardWidgetSettings
        widgetId={settingsFor}
        widgets={widgets}
        tabName={tab.name}
        onClose={() => setSettingsFor(undefined)}
        onApply={(next, title) => {
          setWidgets(
            next.map((widget) => (widget.id === settingsFor ? { ...widget, title } : widget)),
          );
          setSettingsFor(undefined);
          announce(`Settings of ${title} applied.`);
        }}
        finalFocus={() => document.getElementById(focusAfterSheet.current ?? addTileId)}
      />
      <UnsavedChangesGuard when={dirty && !loading} />
    </div>
  );
}
