// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react';
import { Button } from '../../../../ui/primitives/button.tsx';

interface ArticleFormSummaryButtonProps {
  /** The button's text, such as Reload article or Restore article. */
  readonly label: string;
  readonly onAction: () => Promise<void>;
}

/** The action of the form's summary, busy while it runs. */
export function ArticleFormSummaryButton({ label, onAction }: ArticleFormSummaryButtonProps) {
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
