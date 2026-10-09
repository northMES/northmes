// SPDX-License-Identifier: AGPL-3.0-or-later
import { CircleAlert } from 'lucide-react';
import {
  type ReactElement,
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
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
  /**
   * The button that opens the dialog; Cancel and Escape return focus to it. Without one, open and
   * onOpenChange control the dialog, as from a row menu's item.
   */
  readonly trigger?: ReactElement;
  /** Opens the dialog without a trigger; onOpenChange hears every change. */
  readonly open?: boolean;
  /** The question that names the dialog, such as "Archive article AX-500?". */
  readonly title: string;
  /** What the action does, which describes the dialog. */
  readonly description: string;
  /**
   * What the description goes on to name, under it, such as a list of what changes or what stays
   * after the action; it describes the dialog too, so a screen reader hears it with the description.
   * A string reads as one muted line.
   */
  readonly details?: ReactNode;
  /** The confirm button's text, such as "Archive article". */
  readonly confirmLabel: string;
  /**
   * Runs the action. The dialog closes when it resolves; when it rejects, the dialog stays open
   * with the error's message as an alert, and the confirm button tries again.
   */
  readonly onConfirm: () => Promise<void>;
  /** Where focus goes after a confirmed action, such as the h1; the trigger when it is not set. */
  readonly focusAfterConfirm?: () => HTMLElement | null;
  /** The confirm button warns: the action takes something away, such as Remove role. */
  readonly destructive?: boolean;
  /** The field that takes focus when the dialog opens, such as the reason; else the dialog's first. */
  readonly initialFocus?: RefObject<HTMLElement | null>;
  /** Runs when the dialog opens or closes, such as to clear the reason of an earlier opening. */
  readonly onOpenChange?: (open: boolean) => void;
  /** The body between the text and the buttons, such as what changes and a reason field. */
  readonly children?: ReactNode;
}

/**
 * ConfirmDialog (design ui-222, DE23 and DE27; WCAG 3.3.4): shadcn's Alert Dialog that asks before
 * an action, named by its title and described by its text and the details under it, with Cancel
 * and the confirm button. Tab stays in the dialog and Escape cancels. A body, such as a reason field, goes between the text
 * and the buttons, and initialFocus puts focus in it on open.
 */
export function ConfirmDialog({
  trigger,
  open: controlledOpen,
  title,
  description,
  details,
  confirmLabel,
  onConfirm,
  focusAfterConfirm,
  destructive = false,
  initialFocus,
  onOpenChange,
  children,
}: ConfirmDialogProps) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = controlledOpen ?? ownOpen;
  const setOpen = (next: boolean) => {
    setOwnOpen(next);
    onOpenChange?.(next);
  };
  const descriptionId = useId();
  const detailsId = useId();
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
      {trigger !== undefined && <AlertDialogTrigger render={trigger} />}
      <AlertDialogContent
        initialFocus={initialFocus}
        // Base UI describes the dialog by its description; details join it when there are any.
        {...(details !== undefined && { 'aria-describedby': `${descriptionId} ${detailsId}` })}
        finalFocus={() => {
          // The dialog closed, so the unmount has no focus left to move.
          const after = confirmed.current;
          confirmed.current = false;
          return after ? (focusTarget.current?.() ?? true) : true;
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {/* With details under it, the description is their lead sentence (design core-304, AS7). */}
          <AlertDialogDescription
            id={descriptionId}
            className={details === undefined ? undefined : 'text-foreground'}
          >
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {details !== undefined && (
          <div id={detailsId} className="flex flex-col gap-2">
            {typeof details === 'string' ? (
              <p className="text-sm text-muted-foreground">{details}</p>
            ) : (
              details
            )}
          </div>
        )}
        {children}
        {error !== undefined && (
          <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={running}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? 'destructive' : 'default'}
            loading={running}
            onClick={confirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
