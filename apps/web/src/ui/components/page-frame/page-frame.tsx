// SPDX-License-Identifier: AGPL-3.0-or-later
import { CircleAlert, Copy, type LucideIcon, RotateCw } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { announce } from '../../lib/announce.ts';
import { Button } from '../../primitives/button.tsx';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../../primitives/empty.tsx';
import { IconButton } from '../icon-button/index.ts';
import { PageFrameBreadcrumb } from './page-frame-breadcrumb.tsx';
import { type Crumb, usePageFrameTopBar } from './page-frame-top-bar.tsx';

/** What a page's data region shows (plan 06, Page states). */
export type PageState =
  | { readonly status: 'ready' }
  /** The content renders its own skeleton of the populated layout and is marked busy. */
  | { readonly status: 'loading' }
  /**
   * First run, filtered empty, not found or forbidden: what is missing and the way on. A page
   * opened without its permission leaves out the title, because its h1 already says it.
   */
  | {
      readonly status: 'empty';
      /** An icon above the heading, such as Lock on a forbidden state (design ui-222, ST19). */
      readonly icon?: LucideIcon;
      readonly title?: string;
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
  /** The page actions, such as New article: in the shell's top bar, else beside the h1. */
  readonly actions?: ReactNode;
  /**
   * The header slot beside the h1, such as "11 roles at Acme AB" on a list or the kind of a role
   * on its page (design core-304, Shell, frame and slots).
   */
  readonly meta?: ReactNode;
  /**
   * The crumbs between the module and this page, such as Articles above an article. The shell's
   * top bar shows them after the plant and the module crumbs, and the title as the last crumb.
   */
  readonly crumbs?: readonly Crumb[];
  /**
   * The last crumb, the current page, when the trail names it apart from its title: the company
   * landing is "Company settings", and its trail ends with the company (design shell-313, C5).
   */
  readonly currentCrumb?: string;
  /** The list toolbar, which stays in every state. */
  readonly toolbar?: ReactNode;
  readonly state?: PageState;
  /** The populated content, also rendered while loading. */
  readonly children: ReactNode;
}

const stateCard = 'gap-3 rounded-xl border border-solid bg-card px-6 py-16';

/** An empty state: its icon, a heading, its text and the action that leads on. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: Omit<Extract<PageState, { status: 'empty' }>, 'status'>) {
  return (
    <Empty className={stateCard}>
      <EmptyHeader className="max-w-prose">
        {Icon !== undefined && (
          <EmptyMedia className="size-10 rounded-full bg-muted text-muted-foreground">
            <Icon aria-hidden className="size-5" />
          </EmptyMedia>
        )}
        {title !== undefined && (
          <EmptyTitle>
            <h2 className="text-base font-semibold">{title}</h2>
          </EmptyTitle>
        )}
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action !== undefined && <EmptyContent>{action}</EmptyContent>}
    </Empty>
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
    <Empty role="alert" className={stateCard}>
      <EmptyHeader className="max-w-prose">
        <EmptyMedia className="size-10 rounded-full bg-destructive-subtle text-destructive">
          <CircleAlert aria-hidden className="size-5" />
        </EmptyMedia>
        <EmptyTitle>
          <h2 className="text-base font-semibold">{title}</h2>
        </EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {correlationId !== undefined && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          Correlation id
          <span className="font-mono text-foreground">{correlationId}</span>
          <IconButton
            label="Copy correlation id"
            variant="ghost"
            size="icon-sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(correlationId);
                announce('Correlation id copied');
              } catch {
                // The browser refuses without focus, without permission or on an insecure origin.
                announce('Could not copy the correlation id. Select it and copy it by hand.');
              }
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
    </Empty>
  );
}

/**
 * The frame of a screen (plan 06, UI patterns): the h1 from the route title, which the shell
 * focuses after a route change (tabindex -1) and which names the document ("Articles · Plant A ·
 * NorthMES" in the shell, "Articles · NorthMES" outside it), the header slot beside it, the page
 * actions, the toolbar, and the data region in its state. In the shell the breadcrumb and the page
 * actions render in the top bar (D2), before main in the Tab order. Loading marks the region busy
 * around the content's skeleton; empty and error replace the content. Try again moves focus to the h1, because the error state goes away, and so
 * does an empty state's action that takes the state away without moving focus itself.
 */
export function PageFrame({
  title,
  actions,
  meta,
  crumbs = [],
  currentCrumb = title,
  toolbar,
  state = { status: 'ready' },
  children,
}: PageFrameProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const topBar = usePageFrameTopBar();
  const titleContext = topBar?.titleContext;
  // The page names the document while it shows; a page without a frame gets the plain name.
  useEffect(() => {
    document.title = [title, titleContext, 'NorthMES']
      .filter((part) => part !== undefined)
      .join(' · ');
    return () => {
      document.title = 'NorthMES';
    };
  }, [title, titleContext]);
  // The action of an empty or error state, such as Go to the first page, removes the state and
  // the focused button with it. Unless the action moved focus itself, focus moves to the h1.
  const shownStatus = useRef(state.status);
  useEffect(() => {
    const left = shownStatus.current;
    shownStatus.current = state.status;
    const lost = document.activeElement === null || document.activeElement === document.body;
    if (left !== state.status && (left === 'empty' || left === 'error') && lost) {
      heading.current?.focus();
    }
  }, [state.status]);
  return (
    <div className="flex flex-col gap-4">
      {topBar?.breadcrumb &&
        createPortal(
          <PageFrameBreadcrumb crumbs={[...topBar.trail, ...crumbs]} current={currentCrumb} />,
          topBar.breadcrumb,
        )}
      {actions !== undefined &&
        topBar?.actions &&
        createPortal(<div className="flex items-center gap-2">{actions}</div>, topBar.actions)}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 ref={heading} tabIndex={-1} className="text-title font-semibold">
            {title}
          </h1>
          {meta !== undefined && (
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {meta}
            </div>
          )}
        </div>
        {actions !== undefined && topBar === null && (
          <div className="flex flex-wrap gap-2">{actions}</div>
        )}
      </div>
      {toolbar}
      <div aria-busy={state.status === 'loading' || undefined}>
        {state.status === 'empty' ? (
          <EmptyState
            icon={state.icon}
            title={state.title}
            description={state.description}
            action={state.action}
          />
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
