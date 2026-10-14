// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@apollo/client/react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ConfirmDialog } from '../../../../ui/components/confirm-dialog/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { Button } from '../../../../ui/primitives/button.tsx';
import { dashboardSearch } from '../../access-search.ts';
import { DashboardEditor } from './dashboard-editor.tsx';
import { DashboardGrid } from './dashboard-grid.tsx';
import { DashboardTabPicker, scopeIcons } from './dashboard-tab-picker.tsx';
import { CoreDashboardTabs, type DashboardTab } from './dashboard-tabs.graphql.ts';

/** The DOM id of Edit layout, which takes focus again when edit mode ends. */
const editLayoutId = 'dashboard-edit-layout';

/** Who sees each kind of tab, in the scope line above the grid (design shell-454, A1). */
const scopeLines: Readonly<Record<DashboardTab['scope'], string>> = {
  COMPANY: 'Everyone at the company sees this tab.',
  PLANT: 'Everyone at this plant sees this tab.',
  OWN: 'Only you see this tab, at every plant of the company.',
};

/** The scope line of the open tab: its scope icon and who sees it. */
function ScopeLine({ tab }: { readonly tab: DashboardTab }) {
  const Icon = scopeIcons[tab.scope];
  return (
    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Icon aria-hidden className="size-4 shrink-0" />
      {scopeLines[tab.scope]}
    </p>
  );
}

/**
 * The dashboard, the plant's landing page at the plant root (ADR 0078, design shell-454, option
 * A): the h1 Dashboard, the row of tabs, the open tab's scope line and its widgets on the grid. The
 * open tab is in the URL as tab, the first tab without one or with a tab the user does not see.
 * Edit layout, on a tab the user may change, puts the open tab into edit mode, which the URL does
 * not hold; opening another tab over unsaved changes asks first.
 */
export function DashboardScreen() {
  const navigate = useNavigate();
  const search = dashboardSearch(useSearch({ strict: false }));
  const { data, error, refetch } = useQuery(CoreDashboardTabs);
  const tabs = data?.coreDashboardTabs;
  const open = tabs?.find((tab) => tab.id === search.tab) ?? tabs?.[0];
  const [editing, setEditing] = useState<string>();
  const [dirty, setDirty] = useState(false);
  const [askBefore, setAskBefore] = useState<string>();
  const [focusEditLayout, setFocusEditLayout] = useState(false);
  const isEditing = open?.canEdit === true && editing === open.id;
  useEffect(() => {
    if (!focusEditLayout) return;
    document.getElementById(editLayoutId)?.focus();
    setFocusEditLayout(false);
  }, [focusEditLayout]);
  const openTab = (tab: string) => {
    setEditing(undefined);
    setDirty(false);
    void navigate({ to: '.', search: { tab } });
  };
  const stopEditing = () => {
    setEditing(undefined);
    setDirty(false);
    setFocusEditLayout(true);
  };
  let state: PageState = { status: 'ready' };
  if (tabs === undefined && error !== undefined) {
    state = {
      status: 'error',
      title: 'Could not load the dashboard',
      error,
      onRetry: () => refetch(),
    };
  } else if (tabs === undefined) {
    state = { status: 'loading' };
  } else if (open === undefined) {
    state = {
      status: 'empty',
      title: 'No dashboard tabs yet',
      description: "The company's and the plant's shared tabs show here once they exist.",
    };
  }
  return (
    <PageFrame
      title="Dashboard"
      state={state}
      actions={
        open?.canEdit && !isEditing ? (
          <Button id={editLayoutId} variant="outline" onClick={() => setEditing(open.id)}>
            <Pencil aria-hidden />
            Edit layout
          </Button>
        ) : undefined
      }
    >
      {open !== undefined && tabs !== undefined && (
        <div className="flex flex-col gap-4">
          <DashboardTabPicker
            tabs={tabs}
            value={open.id}
            onValueChange={(tab) => {
              if (tab === open.id) return;
              if (isEditing && dirty) setAskBefore(tab);
              else openTab(tab);
            }}
          />
          <ScopeLine tab={open} />
          {isEditing ? (
            <DashboardEditor
              key={open.id}
              tab={open}
              onClose={stopEditing}
              onDirtyChange={setDirty}
              onReload={async () =>
                (await refetch()).data?.coreDashboardTabs.find((tab) => tab.id === open.id)
              }
            />
          ) : open.widgets.length === 0 ? (
            <p className="text-sm text-muted-foreground">{open.name} has no widgets yet.</p>
          ) : (
            <DashboardGrid tab={open} />
          )}
        </div>
      )}
      {open !== undefined && (
        <ConfirmDialog
          open={askBefore !== undefined}
          onOpenChange={(next) => {
            if (!next) setAskBefore(undefined);
          }}
          title="Discard your changes?"
          description={`Your changes to ${open.name} are not saved. If you open another tab, they are lost.`}
          confirmLabel="Discard changes"
          destructive
          onConfirm={async () => {
            if (askBefore !== undefined) openTab(askBefore);
          }}
        />
      )}
    </PageFrame>
  );
}
