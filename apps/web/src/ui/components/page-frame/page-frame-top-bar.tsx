// SPDX-License-Identifier: AGPL-3.0-or-later
import { createContext, useContext } from 'react';

/** One crumb of the breadcrumb: its label and the href of its page, or plain text without one. */
export interface Crumb {
  readonly label: string;
  readonly href?: string;
}

/**
 * What the shell's top bar offers a page frame (D2): the element of the breadcrumb and the element
 * of the page actions, and the crumbs and the title part the shell knows, such as the plant.
 */
export interface PageFrameTopBarValue {
  /** The crumbs before the page's own: the plant, then the module. */
  readonly trail: readonly Crumb[];
  /** The middle part of the document title, such as the plant: "Articles · Plant A · NorthMES". */
  readonly titleContext?: string;
  /** The top bar's breadcrumb slot, where the page frame renders the trail. */
  readonly breadcrumb: HTMLElement | null;
  /** The top bar's page actions slot, where the page frame renders its actions. */
  readonly actions: HTMLElement | null;
}

const PageFrameTopBarContext = createContext<PageFrameTopBarValue | null>(null);

/** Rendered by the shell around the route, with its top bar's slots. */
export const PageFrameTopBar = PageFrameTopBarContext.Provider;

/** The shell's top bar, or null outside the shell, where a page frame keeps its actions inline. */
export function usePageFrameTopBar(): PageFrameTopBarValue | null {
  return useContext(PageFrameTopBarContext);
}
