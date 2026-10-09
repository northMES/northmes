// SPDX-License-Identifier: AGPL-3.0-or-later
import { classifyError } from '@northmes/web-sdk';
import { CircleAlert, Copy, RotateCw } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
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
      readonly title?: string;
      readonly description: string;
      readonly action?: ReactNode;
    }
  /**
   * The data could not be loaded: the error, the correlation id and Try again. The correlation id
   * comes from the failed request, read by classifyError, unless the page names one.
   */
  | {
      readonly status: 'error';
      readonly title: string;
      /** Without one, ui-222's words: check the connection, try again, and the correlation id. */
      readonly description?: string;
      /** The failed request's error, whose correlation id the state shows. */
      readonly error?: unknown;
      readonly correlationId?: string;
      /** Sends the request again; Try again stays busy until the promise settles. */
      readonly onRetry: () => Promise<unknown>;
    };

export interface PageFrameProps {
  /** The route title, rendered as the page's only h1. */
  readonly title: string;
  /** The page actions, such as New article: in the shell's top bar, else beside the h1. */
  readonly actions?: ReactNode;
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
  /**
   * The part of the document title between the title and the shell's, when the page names one,
   * such as the module of a module page not found: "Page not found · Equipment · Plant A ·
   * NorthMES" (D2 ST5).
   */
  readonly titleSection?: string;
  /** The list toolbar, which stays in every state. */
  readonly toolbar?: ReactNode;
  readonly state?: PageState;
  /** The populated content, also rendered while loading. */
  readonly children: ReactNode;
}

const stateCard = 'gap-3 rounded-xl border border-solid bg-card px-6 py-16';

/** An empty state: a heading, its text and the action that leads on. */
export function EmptyState({
  title,
  description,
  action,
}: Omit<Extract<PageState, { status: 'empty' }>, 'status'>) {
  return (
    <Empty className={stateCard}>
      <EmptyHeader className="max-w-prose">
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

/** The props of an error state: the page's error and whether its Try again runs. */
type ErrorStateProps = Omit<Extract<PageState, { status: 'error' }>, 'status'> & {
  /** Try again runs: the button shows Trying again with aria-busy and aria-disabled (SE7). */
  readonly retrying?: boolean;
};

/** The correlation id of an error state: the page's own, else the failed request's. */
function correlationIdOf({
  correlationId,
  error,
}: Pick<ErrorStateProps, 'correlationId' | 'error'>) {
  return correlationId ?? (error === undefined ? undefined : classifyError(error).correlationId);
}

/**
 * An error state (design ui-222, ST4 and ST8): an alert with the page's title and ui-222's text,
 * then the correlation id with Copy correlation id, and Try again, which keeps focus in its loading
 * state while the request runs (shell-306, SE7). The alert holds only the heading and the text, so
 * Trying again and the new correlation id of a failed retry do not announce it again; the polite
 * region reports the outcome once (shell-306, E22).
 */
export function ErrorState({
  title,
  description,
  error,
  correlationId: own,
  onRetry,
  retrying = false,
}: ErrorStateProps) {
  const correlationId = correlationIdOf({ correlationId: own, error });
  const text =
    description ??
    (correlationId === undefined
      ? 'Check the connection, then try again.'
      : 'Check the connection, then try again. If it fails again, give your plant admin the correlation id.');
  return (
    <Empty className={stateCard}>
      <EmptyHeader role="alert" className="max-w-prose">
        <EmptyMedia className="size-10 rounded-full bg-destructive-subtle text-destructive">
          <CircleAlert aria-hidden className="size-5" />
        </EmptyMedia>
        <EmptyTitle>
          <h2 className="text-base font-semibold">{title}</h2>
        </EmptyTitle>
        <EmptyDescription>{text}</EmptyDescription>
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
      {/* The D1 Button loading state: full opacity, the progress label, focus kept (D1 Q8). */}
      <Button loading={retrying} onClick={() => onRetry()}>
        {!retrying && <RotateCw aria-hidden />}
        {retrying ? 'Trying again' : 'Try again'}
      </Button>
    </Empty>
  );
}

/** The first letter in lower case, so a title reads inside a sentence. */
function inSentence(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** A Try again in progress: the error state it started from, and whether its request settled. */
interface Retry {
  readonly from: Extract<PageState, { status: 'error' }>;
  readonly settled: boolean;
}

/**
 * The frame of a screen (plan 06, UI patterns): the h1 from the route title, which the shell
 * focuses after a route change (tabindex -1) and which names the document ("Articles · Plant A ·
 * NorthMES" in the shell, "Articles · NorthMES" outside it), the page actions, the toolbar, and the
 * data region in its state. In the shell the breadcrumb and the page actions render in the top bar
 * (D2), before main in the Tab order. Loading marks the region busy around the content's skeleton;
 * empty and error replace the content. Try again keeps the error state and its focus while the
 * request runs, then moves focus to the h1 once the page loads; an empty state's action that takes
 * the state away without moving focus itself moves focus to the h1 too.
 */
export function PageFrame({
  title,
  actions,
  crumbs = [],
  currentCrumb = title,
  titleSection,
  toolbar,
  state = { status: 'ready' },
  children,
}: PageFrameProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const topBar = usePageFrameTopBar();
  const titleContext = topBar?.titleContext;
  // The page names the document while it shows; a page without a frame gets the plain name.
  useEffect(() => {
    document.title = [title, titleSection, titleContext, 'NorthMES']
      .filter((part) => part !== undefined)
      .join(' · ');
    return () => {
      document.title = 'NorthMES';
    };
  }, [title, titleSection, titleContext]);
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
  // Try again (shell-306, SE7): the error state stays, busy, until the request settles and the
  // page has its next state. Then focus moves to the h1 when the page loaded, or stays on Try again
  // when it failed again, and the polite region says so once.
  const [retry, setRetry] = useState<Retry | undefined>(undefined);
  useEffect(() => {
    if (retry === undefined || !retry.settled || state.status === 'loading') return;
    setRetry(undefined);
    if (state.status === 'error') {
      const changed = correlationIdOf(state) === undefined ? '' : ' The correlation id changed.';
      announce(`Still ${inSentence(state.title)}.${changed}`);
    } else {
      requestAnimationFrame(() => heading.current?.focus());
    }
  }, [retry, state]);
  const shown: PageState = retry === undefined ? state : retry.from;
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
        <h1 ref={heading} tabIndex={-1} className="text-title font-semibold">
          {title}
        </h1>
        {actions !== undefined && topBar === null && (
          <div className="flex flex-wrap gap-2">{actions}</div>
        )}
      </div>
      {toolbar}
      <div aria-busy={shown.status === 'loading' || undefined}>
        {shown.status === 'empty' ? (
          <EmptyState title={shown.title} description={shown.description} action={shown.action} />
        ) : shown.status === 'error' ? (
          <ErrorState
            {...shown}
            retrying={retry !== undefined}
            onRetry={async () => {
              const from = shown;
              setRetry({ from, settled: false });
              // A refused retry settles too: the page's next state says how it went.
              await from.onRetry().catch(() => {});
              setRetry({ from, settled: true });
            }}
          />
        ) : (
          children
        )}
      </div>
    </div>
  );
}
