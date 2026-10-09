// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react';
import { Button } from '../../../../ui/primitives/button.tsx';

/** Reload article, busy while the saved article loads. */
export function ArticleFormReloadButton({ onReload }: { readonly onReload: () => Promise<void> }) {
  const [reloading, setReloading] = useState(false);
  return (
    <Button
      variant="outline"
      loading={reloading}
      onClick={async () => {
        setReloading(true);
        try {
          await onReload();
        } finally {
          setReloading(false);
        }
      }}
    >
      Reload article
    </Button>
  );
}
