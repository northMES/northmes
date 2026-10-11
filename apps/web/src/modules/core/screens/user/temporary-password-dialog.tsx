// SPDX-License-Identifier: AGPL-3.0-or-later
import { Copy } from 'lucide-react';
import { type RefObject, useId, useRef } from 'react';
import { announce } from '../../../../ui/lib/announce.ts';
import { Button } from '../../../../ui/primitives/button.tsx';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/primitives/dialog.tsx';
import { Field, FieldDescription, FieldLabel } from '../../../../ui/primitives/field.tsx';
import { Input } from '../../../../ui/primitives/input.tsx';

interface TemporaryPasswordDialogProps {
  readonly name: string;
  readonly password: string;
  readonly open: boolean;
  /** Created for a new user, or reset for one whose old password stops working. */
  readonly variant?: 'created' | 'reset';
  /** Done or Escape close it: the password is gone for good. */
  readonly onClose: () => void;
  /** Copy password, which has focus when the dialog opens; a caller may focus it earlier. */
  readonly copyRef?: RefObject<HTMLButtonElement | null>;
  /** Where focus goes after Done: the user's h1 unless the caller names another place. */
  readonly finalFocus?: () => HTMLElement | null;
}

/**
 * The temporary password, shown once in a dialog, never in a toast (design core-304, US17 and
 * US18): what to do with it, after a reset that the old password no longer works, a read-only
 * textbox labelled Temporary password beside Copy password, which has focus, the hint that it is
 * shown only now, and Done. After Done the password cannot be shown again, and focus goes to the
 * user's h1, or where finalFocus says, such as Reset password.
 */
export function TemporaryPasswordDialog({
  name,
  password,
  open,
  variant = 'created',
  onClose,
  copyRef,
  finalFocus,
}: TemporaryPasswordDialogProps) {
  const fieldId = useId();
  const hintId = useId();
  const ownCopy = useRef<HTMLButtonElement>(null);
  const copy = copyRef ?? ownCopy;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        initialFocus={copy}
        finalFocus={() => finalFocus?.() ?? document.querySelector<HTMLElement>('h1') ?? true}
        className="sm:max-w-130"
      >
        <DialogHeader>
          <DialogTitle>Temporary password for {name}</DialogTitle>
          <DialogDescription render={<div />} className="flex flex-col gap-1">
            <p className="text-foreground">
              Give it to {name}, who must choose a new password at the next sign-in.
            </p>
            {variant === 'reset' && <p>The old password no longer works.</p>}
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor={fieldId} className="text-xs font-semibold">
            Temporary password
          </FieldLabel>
          <div className="flex flex-wrap gap-2">
            <Input
              id={fieldId}
              readOnly
              value={password}
              aria-describedby={hintId}
              className="min-w-0 flex-1 font-mono"
            />
            <Button
              ref={copy}
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(password);
                  announce('Password copied.');
                } catch {
                  announce('Could not copy the password. Select it and copy it by hand.');
                }
              }}
            >
              <Copy aria-hidden />
              Copy password
            </Button>
          </div>
          <FieldDescription id={hintId} className="text-xs">
            Shown only now. After you close this dialog, it cannot be shown again.
          </FieldDescription>
        </Field>
        <DialogFooter className="mx-0 mb-0 border-t-0 bg-transparent p-0">
          <DialogClose render={<Button />}>Done</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
