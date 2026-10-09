// SPDX-License-Identifier: AGPL-3.0-or-later
import { useBlocker } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../primitives/alert-dialog.tsx';

export interface UnsavedChangesGuardProps {
  /**
   * The form has changes that are not saved. Pass false while a save runs, so the save's own
   * navigation to the saved record goes through.
   */
  readonly when: boolean;
}

/**
 * Asks before a form page with changes is left (issue 401; design ui-222, question 9): a
 * navigation to another path opens an alert dialog with Stay on page, which keeps the page, the
 * typed values and the focus, and Leave page, which goes on. Closing or reloading the tab gets the
 * browser's own question. A change of the search alone, such as a tab, is no leaving.
 */
export function UnsavedChangesGuard({ when }: UnsavedChangesGuardProps) {
  // The blocker reads the latest value when a navigation starts, not the one of its first render.
  const blocking = useRef(when);
  useEffect(() => {
    blocking.current = when;
  }, [when]);
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) => blocking.current && current.pathname !== next.pathname,
    enableBeforeUnload: () => blocking.current,
    withResolver: true,
  });
  return (
    <AlertDialog
      open={blocker.status === 'blocked'}
      onOpenChange={(open) => {
        if (!open) blocker.reset?.();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
          <AlertDialogDescription>
            Your changes on this page are not saved. If you leave, they are lost.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Stay on page</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => blocker.proceed?.()}>
            Leave page
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
