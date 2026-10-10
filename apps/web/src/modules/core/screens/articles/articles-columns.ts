// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react';

/** Where the browser keeps the hidden columns of the articles list (design ui-222, question 5). */
const storageKey = 'northmes.core.articles.hiddenColumns';

/** The hidden columns this browser kept, or none when storage is blocked or holds no list. */
function stored(): readonly string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * The hidden columns of the articles list, kept per browser like the theme, never in the URL
 * (LI13); a browser without storage keeps them for the page alone.
 */
export function useHiddenColumns(): [readonly string[], (hidden: readonly string[]) => void] {
  const [hidden, setHidden] = useState(stored);
  const change = (next: readonly string[]) => {
    setHidden(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // The choice holds until the page closes.
    }
  };
  return [hidden, change];
}
