// SPDX-License-Identifier: AGPL-3.0-or-later
import { Copy } from 'lucide-react';
import { useId, useRef } from 'react';
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
import { Field, FieldLabel } from '../../../../ui/primitives/field.tsx';
import { Input } from '../../../../ui/primitives/input.tsx';

interface TemporaryPasswordDialogProps {
  readonly name: string;
  readonly password: string;
  readonly open: boolean;
  /** Done or Escape close it: the password is gone for good. */
  readonly onClose: () => void;
}

/**
 * The temporary password, shown once in a dialog, never in a toast (design core-304, US17): a
 * read-only textbox labelled Temporary password, Copy password with focus, and Done. After Done
 * the password cannot be shown again, and focus goes to the user's h1.
 */
export function TemporaryPasswordDialog({
  name,
  password,
  open,
  onClose,
}: TemporaryPasswordDialogProps) {
  const copy = useRef<HTMLButtonElement>(null);
  const fieldId = useId();
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
        finalFocus={() => document.querySelector<HTMLElement>('h1') ?? true}
        className="sm:max-w-120"
      >
        <DialogHeader>
          <DialogTitle>Temporary password for {name}</DialogTitle>
          <DialogDescription>
            Give it to {name}, who signs in with it. Shown only now. After you close this dialog, it
            cannot be shown again.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor={fieldId} className="text-xs font-semibold">
            Temporary password
          </FieldLabel>
          <Input id={fieldId} readOnly value={password} className="font-mono" />
        </Field>
        <DialogFooter className="mx-0 mb-0 border-t-0 bg-transparent p-0">
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
          <DialogClose render={<Button />}>Done</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
