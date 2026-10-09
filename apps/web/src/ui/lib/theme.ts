// SPDX-License-Identifier: AGPL-3.0-or-later
import { useCallback, useState } from 'react';

/** The D1 themes; the dark variant of theme.css reads data-theme on the html element. */
export type Theme = 'light' | 'dark';

/** The key of the viewer's choice in localStorage, kept per browser. */
export const themeStorageKey = 'northmes-theme';

/** The theme the viewer chose before, or undefined when there is none or storage is blocked. */
export function storedTheme(): Theme | undefined {
  try {
    const value = localStorage.getItem(themeStorageKey);
    return value === 'light' || value === 'dark' ? value : undefined;
  } catch {
    return undefined;
  }
}

/** The theme the system asks for, which the page follows until the viewer chooses one. */
function systemTheme(): Theme {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/** Sets the theme the viewer chose before on the html element, at boot and when the shell mounts. */
export function applyStoredTheme(): void {
  const theme = storedTheme();
  if (theme !== undefined) document.documentElement.dataset.theme = theme;
}

/**
 * The theme on screen and the setter of the theme switch: it sets data-theme on the html element
 * and keeps the choice in localStorage, which a blocked storage skips without failing.
 */
export function useTheme(): readonly [Theme, (theme: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(() => storedTheme() ?? systemTheme());
  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(themeStorageKey, next);
    } catch {
      // A private window or blocked site data keeps the theme for this page only.
    }
  }, []);
  return [theme, setTheme];
}
