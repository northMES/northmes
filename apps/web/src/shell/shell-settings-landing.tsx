// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Navigate } from '@tanstack/react-router';
import { createContext, useContext } from 'react';
import { PageFrame, type PageState } from '../ui/components/page-frame/index.ts';

/** Where the settings landing leads: the first settings page the user may open, once known. */
export interface SettingsLandingState {
  /** The first page of the plant settings navigation the user may open, or undefined for none. */
  readonly href: string | undefined;
  /** Whether the permissions that decide the entries are still loading. */
  readonly loading: boolean;
  /** Why the permissions could not be read, when they could not. */
  readonly failed?: unknown;
  /** Reads the permissions again, after a failed read. */
  readonly retry: () => Promise<unknown>;
}

const SettingsLandingContext = createContext<SettingsLandingState>({
  href: undefined,
  loading: true,
  retry: async () => undefined,
});

/** The plant layout's answer to where the settings landing leads. */
export const SettingsLandingProvider = SettingsLandingContext.Provider;

/**
 * The settings landing at /<plant>/settings (design shell-313, C5; #876): it goes on to the first
 * settings page the user may open, the page the Settings button opens. It has a page of its own
 * only while the permissions load, after a failed read, with Try again (ui-222's wording), and for
 * a user who may open none of the pages. Its trail ends with Settings, and its title reads
 * "Settings · Plant A · NorthMES".
 */
export function ShellSettingsLanding() {
  const { href, loading, failed, retry } = useContext(SettingsLandingContext);
  if (href !== undefined) return <Navigate to={href} replace />;
  const state: PageState =
    failed !== undefined
      ? { status: 'error', title: 'Could not load settings', error: failed, onRetry: retry }
      : loading
        ? { status: 'loading' }
        : {
            status: 'empty',
            description:
              'You hold no permission that opens a settings page here. Ask a plant admin for a role that includes one.',
          };
  return (
    // With a page to open the landing forwards before it renders content.
    <PageFrame title="Settings" state={state}>
      {null}
    </PageFrame>
  );
}
