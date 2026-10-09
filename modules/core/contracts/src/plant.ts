// SPDX-License-Identifier: MIT
import { z } from 'zod';

/**
 * The words a plant slug may not be: a plant slug is the first segment of a web path (`/$plant`),
 * and these are the server's paths (ADR 0064), the station and company settings mounts, the former
 * admin mount (ADR 0066) and the web's sign-in page.
 */
export const reservedPlantSlugs: ReadonlySet<string> = new Set([
  'api',
  'graphql',
  'mcp',
  'health',
  'modules',
  'assets',
  'station',
  'settings',
  'admin',
  'sign-in',
]);

/**
 * A plant's slug, the plant's name in the URL and in the x-northmes-plant header (ADR 0007): lower
 * case letters and digits in words joined by single hyphens, at most 40 characters, unique per
 * installation (ADR 0066), and none of the reserved words.
 */
export const plantSlug = z
  .string()
  .max(40, 'A plant slug can be 1 to 40 characters.')
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    'Use lower-case letters and digits, with single hyphens between words.',
  )
  .refine((slug) => !reservedPlantSlugs.has(slug), {
    error: (issue) => `${String(issue.input)} is reserved for the web's own pages.`,
  });
