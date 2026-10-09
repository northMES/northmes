// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react';
import { Button } from '../../primitives/button.tsx';

export interface ErrorSummaryActionProps {
  /** The button's text, such as Reload article or Restore article. */
  readonly label: string;
  readonly onAction: () => Promise<void>;
}

/** An action under the error summary's text, busy while it runs. */
export function ErrorSummaryAction({ label, onAction }: ErrorSummaryActionProps) {
  const [running, setRunning] = useState(false);
  return (
    <Button
      variant="outline"
      loading={running}
      onClick={async () => {
        setRunning(true);
        try {
          await onAction();
        } finally {
          setRunning(false);
        }
      }}
    >
      {label}
    </Button>
  );
}
