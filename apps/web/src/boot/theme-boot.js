// SPDX-License-Identifier: AGPL-3.0-or-later
/*
 * Sets the theme the viewer chose before on the html element before the first paint (design
 * shell-306, BO2). index.html's head loads it as a classic script, which the content security
 * policy allows from the server's origin, while an inline script it would block. It reads the key
 * and values of applyStoredTheme in src/ui/lib/theme.ts. Without a stored choice, or with storage
 * blocked, it sets nothing and the page follows the system.
 */
(() => {
  try {
    const theme = window.localStorage.getItem('northmes-theme');
    if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  } catch {
    // A private window or blocked site data leaves the system's theme.
  }
})();
