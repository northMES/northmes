// SPDX-License-Identifier: AGPL-3.0-or-later
import { CircleAlert, Copy, RotateCw } from 'lucide-react';
import { type ReactNode, useRef } from 'react';
import { announce } from './announce.ts';
import { Button, IconButton } from './button.tsx';

/** What a page's data region shows (plan 06, Page states). */
export type PageState =
  | { readonly status: 'ready' }
  /** The content renders its own skeleton of the populated layout and is marked busy. */
  | { readonly status: 'loading' }
  /** First run, filtered empty, not found or forbidden: what is missing and the way on. */
  | {
      readonly status: 'empty';
      readonly title: string;
      readonly description: string;
      readonly action?: ReactNode;
    }
  /** The data could not be loaded: the error, the correlation id and Try again. */
  | {
      readonly status: 'error';
      readonly title: string;
      readonly description: string;
      readonly correlationId?: string;
      readonly onRetry: () => void;
    };

export interface PageFrameProps {
  /** The route title, rendered as the page's only h1. */
  readonly title: string;
  /** The page actions, such as New article, beside the h1. */
  readonly actions?: ReactNode;
  /** The list toolbar, which stays in every state. */
  readonly toolbar?: ReactNode;
  readonly state?: PageState;
  /** The populated content, also rendered while loading. */
  readonly children: ReactNode;
}

const stateCard =
  'flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-6 py-16 text-center';

/** An empty state: a heading, its text and the action that leads on. */
export function EmptyState({
  title,
  description,
  action,
}: Omit<Extract<PageState, { status: 'empty' }>, 'status'>) {
  return (
    <div className={stateCard}>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}

/** An error state: an alert with the correlation id, Copy correlation id and Try again. */
export function ErrorState({
  title,
  description,
  correlationId,
  onRetry,
}: Omit<Extract<PageState, { status: 'error' }>, 'status'>) {
  return (
    <div role="alert" className={stateCard}>
      <span className="flex size-10 items-center justify-center rounded-full bg-destructive-subtle text-destructive">
        <CircleAlert aria-hidden className="size-5" />
      </span>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
      {correlationId !== undefined && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          Correlation id
          <span className="font-mono text-foreground">{correlationId}</span>
          <IconButton
            label="Copy correlation id"
            variant="ghost"
            size="icon-sm"
            onClick={async () => {
              await navigator.clipboard.writeText(correlationId);
              announce('Correlation id copied');
            }}
          >
            <Copy />
          </IconButton>
        </p>
      )}
      <Button onClick={onRetry}>
        <RotateCw aria-hidden />
        Try again
      </Button>
    </div>
  );
}

/**
 * The frame of a screen (plan 06, UI patterns): the h1 from the route title, which the shell
 * focuses after a route change (tabindex -1), the page actions, the toolbar, and the data region
 * in its state. Loading marks the region busy around the content's skeleton; empty and error
 * replace the content. Try again moves focus to the h1, because the error state goes away.
 */
export function PageFrame({
  title,
  actions,
  toolbar,
  state = { status: 'ready' },
  children,
}: PageFrameProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 ref={heading} tabIndex={-1} className="text-title font-semibold">
          {title}
        </h1>
        {actions !== undefined && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {toolbar}
      <div aria-busy={state.status === 'loading' || undefined}>
        {state.status === 'empty' ? (
          <EmptyState title={state.title} description={state.description} action={state.action} />
        ) : state.status === 'error' ? (
          <ErrorState
            title={state.title}
            description={state.description}
            correlationId={state.correlationId}
            onRetry={() => {
              state.onRetry();
              heading.current?.focus();
            }}
          />
        ) : (
          children
        )}
      </div>
    </div>
  );
}
