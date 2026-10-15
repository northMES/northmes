// SPDX-License-Identifier: AGPL-3.0-or-later
import { dashboardWidgetSlot } from '@northmes/core-contracts';
import { useContributions, useShell } from '@northmes/web-sdk';
import { Component, type ComponentType, type ReactNode } from 'react';

/** The props core gives a widget of the slot core/dashboard/widgets/v1 (ADR 0068). */
interface ContributedWidgetProps {
  /** The plant's slug, the $plant segment of the URL. */
  readonly plant: string;
}

interface BoundaryProps {
  readonly title: string;
  readonly children: ReactNode;
}

/**
 * Keeps a contributed widget's error inside its frame (ADR 0068 rule 8): the widget says it could
 * not be shown, and the rest of the dashboard keeps working.
 */
class ContributionBoundary extends Component<BoundaryProps, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    console.error(`The dashboard widget ${this.props.title} failed:`, error);
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <p className="text-muted-foreground">
        {this.props.title} could not be shown. Reload the page to try again.
      </p>
    );
  }
}

/**
 * The content of a widget that a module or plugin contributes: the component its web part supplies
 * for the contribution, given the plant, inside its own error boundary. A contribution that no
 * module offers the user, or whose module did not load, gets a line that says so.
 */
export function ContributedWidget({
  contribution,
  title,
}: {
  readonly contribution: string | null | undefined;
  readonly title: string;
}) {
  const { plant } = useShell();
  const found = useContributions(dashboardWidgetSlot).find(({ id }) => id === contribution);
  const Widget: ComponentType<ContributedWidgetProps> | undefined = found?.Component;
  if (Widget === undefined) {
    return (
      <p className="text-muted-foreground">
        This widget is unavailable. Its plugin is not installed, did not load, or you may not see
        it.
      </p>
    );
  }
  return (
    <ContributionBoundary title={title}>
      <Widget plant={plant} />
    </ContributionBoundary>
  );
}
