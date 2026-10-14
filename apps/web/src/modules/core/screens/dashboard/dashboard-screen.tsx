// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@apollo/client/react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { dashboardSearch } from '../../access-search.ts';
import { DashboardGrid } from './dashboard-grid.tsx';
import { DashboardTabPicker, scopeIcons } from './dashboard-tab-picker.tsx';
import { CoreDashboardTabs, type DashboardTab } from './dashboard-tabs.graphql.ts';

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
 * Edit layout, the catalog and the widget settings come with edit mode.
 */
export function DashboardScreen() {
  const navigate = useNavigate();
  const search = dashboardSearch(useSearch({ strict: false }));
  const { data, error, refetch } = useQuery(CoreDashboardTabs);
  const tabs = data?.coreDashboardTabs;
  const open = tabs?.find((tab) => tab.id === search.tab) ?? tabs?.[0];
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
    <PageFrame title="Dashboard" state={state}>
      {open !== undefined && tabs !== undefined && (
        <div className="flex flex-col gap-4">
          <DashboardTabPicker
            tabs={tabs}
            value={open.id}
            onValueChange={(tab) => void navigate({ to: '.', search: { tab } })}
          />
          <ScopeLine tab={open} />
          {open.widgets.length === 0 ? (
            <p className="text-sm text-muted-foreground">{open.name} has no widgets yet.</p>
          ) : (
            <DashboardGrid tab={open} />
          )}
        </div>
      )}
    </PageFrame>
  );
}
