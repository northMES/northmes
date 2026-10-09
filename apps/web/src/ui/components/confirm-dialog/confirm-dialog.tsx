// SPDX-License-Identifier: AGPL-3.0-or-later
import { CircleAlert } from 'lucide-react';
import { type ReactElement, useEffect, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../../primitives/alert-dialog.tsx';

export interface ConfirmDialogProps {
  /** The button that opens the dialog; Cancel and Escape return focus to it. */
  readonly trigger: ReactElement;
  /** The question that names the dialog, such as "Archive article AX-500?". */
  readonly title: string;
  /** What the action does, which describes the dialog. */
  readonly description: string;
  /** The confirm button's text, such as "Archive article". */
  readonly confirmLabel: string;
  /**
   * Runs the action. The dialog closes when it resolves; when it rejects, the dialog stays open
   * with the error's message as an alert, and the confirm button tries again.
   */
  readonly onConfirm: () => Promise<void>;
  /** Where focus goes after a confirmed action, such as the h1; the trigger when it is not set. */
  readonly focusAfterConfirm?: () => HTMLElement | null;
}

/**
 * ConfirmDialog (design ui-222, DE23 and DE27; WCAG 3.3.4): shadcn's Alert Dialog that asks before
 * an action, named by its title and described by its text, with Cancel and the confirm button.
 * Tab stays in the dialog and Escape cancels.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
  focusAfterConfirm,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | undefined>();
  // Whether the action ran or is running; only the close and the unmount read it, so it is no
  // render state.
  const confirmed = useRef(false);
  const focusTarget = useRef(focusAfterConfirm);
  useEffect(() => {
    focusTarget.current = focusAfterConfirm;
  }, [focusAfterConfirm]);
  // The action may take the trigger away, as Archive gives way to Restore, and the dialog with it.
  // Focus then goes where the caller says once the page has settled.
  useEffect(
    () => () => {
      if (!confirmed.current) return;
      setTimeout(() => focusTarget.current?.()?.focus(), 0);
    },
    [],
  );

  const confirm = async () => {
    setRunning(true);
    setError(undefined);
    confirmed.current = true;
    try {
      await onConfirm();
      setOpen(false);
    } catch (failure) {
      confirmed.current = false;
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setRunning(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (running) return;
        if (next) {
          confirmed.current = false;
          setError(undefined);
        }
        setOpen(next);
      }}
    >
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent
        finalFocus={() => {
          // The dialog closed, so the unmount has no focus left to move.
          const after = confirmed.current;
          confirmed.current = false;
          return after ? (focusTarget.current?.() ?? true) : true;
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error !== undefined && (
          <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={running}>Cancel</AlertDialogCancel>
          <AlertDialogAction loading={running} onClick={confirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
