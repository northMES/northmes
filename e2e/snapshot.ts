import { argosScreenshot, getCSPScriptHash } from '@argos-ci/playwright';
import type { Page } from '@playwright/test';

/**
 * The shell's content security policy with what argosScreenshot injects allowed: its script by the
 * hash Argos publishes, and inline styles for its stabilizing CSS. Every other inline script stays
 * blocked, so a spec still fails on one that the app adds (ADR 0019, ADR 0077).
 */
export function allowArgos(csp: string): string {
  return csp
    .split('; ')
    .map((directive) => {
      if (directive.startsWith('script-src ')) return `${directive} ${getCSPScriptHash()}`;
      if (directive.startsWith('style-src ')) return `${directive} 'unsafe-inline'`;
      return directive;
    })
    .join('; ');
}

/**
 * Serves every document the page loads with its content security policy passed through
 * allowArgos. A redirect goes back to the browser as it is, so the page follows it itself.
 */
export async function routeArgosCsp(page: Page): Promise<void> {
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.fallback();
    const response = await route.fetch({ maxRedirects: 0 });
    const headers = response.headers();
    const csp = headers['content-security-policy'];
    if (csp !== undefined) headers['content-security-policy'] = allowArgos(csp);
    return route.fulfill({ response, headers });
  });
}

/** The screenshot's name for a state, such as `the-articles-list-grouped-by-stock-unit`. */
export function snapshotName(state: string): string {
  return state
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Takes the Argos screenshot of the page in the named state (ADR 0077). The times that change in
 * every run, "Created" and "Last changed", are hidden and masked: a dialog's blurred backdrop
 * would spread their text past the mask. A state that is busy on purpose, such as a list while it
 * loads, passes busy, so Argos does not wait for aria-busy to clear.
 */
export async function snapshot(
  page: Page,
  state: string,
  { busy = false }: { readonly busy?: boolean } = {},
): Promise<void> {
  const times = page.locator(
    'main time, dt:text-is("Created") + dd, dt:text-is("Last changed") + dd',
  );
  const hideTimes = (visibility: string) =>
    times.evaluateAll((elements, value) => {
      for (const element of elements) (element as HTMLElement).style.visibility = value;
    }, visibility);
  // fullPage given here, not left to Argos's default, also turns sticky and fixed elements such
  // as the Save bar static, so the page's scroll position does not move them.
  await argosScreenshot(page, snapshotName(state), {
    fullPage: true,
    mask: [times],
    stabilize: { waitForAriaBusy: !busy },
    beforeScreenshot: () => hideTimes('hidden'),
    afterScreenshot: () => hideTimes(''),
  });
}
