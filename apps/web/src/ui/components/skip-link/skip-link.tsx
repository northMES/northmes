// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Skip to main content (D1 Q12, a NorthMES pattern): the page's first stop, hidden until it has
 * focus, in the primary colors. Following it moves focus to the element with targetId, which has
 * tabindex -1, so the next Tab reaches the first stop in the content (WCAG 2.4.1).
 */
export function SkipLink({ targetId }: { readonly targetId: string }) {
  return (
    <a
      href={`#${targetId}`}
      onClick={(event) => {
        // The router would read the hash as a navigation; focus moves without one.
        event.preventDefault();
        document.getElementById(targetId)?.focus();
      }}
      className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
    >
      Skip to main content
    </a>
  );
}
