import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';

/** The WCAG 2.2 A and AA rules of ADR 0021, the only rules a check runs. */
export const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

type AxeResults = Awaited<ReturnType<AxeBuilder['analyze']>>;

/** One line per violation: the rule, its help text and the elements it hit. */
export function describeViolations(violations: AxeResults['violations']): string {
  return violations
    .map((violation) => {
      const targets = violation.nodes.map((node) => node.target.join(' ')).join(', ');
      return `${violation.id} (${violation.impact ?? 'no impact'}): ${violation.help} at ${targets}. ${violation.helpUrl}`;
    })
    .join('\n');
}

/**
 * Runs axe on the page as it is now and fails when it breaks a WCAG 2.2 A or AA rule. Results
 * that axe cannot decide (incomplete) are reported on the test, not failed (ADR 0021).
 */
export async function checkA11y(page: Page, testInfo: TestInfo, state: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
  if (results.incomplete.length > 0) {
    testInfo.annotations.push({
      type: 'axe incomplete',
      description: `${state}: ${results.incomplete.map((result) => result.id).join(', ')}`,
    });
  }
  if (results.violations.length > 0) {
    throw new Error(
      `${state} breaks ${results.violations.length} WCAG 2.2 AA rule(s):\n${describeViolations(results.violations)}`,
    );
  }
}
