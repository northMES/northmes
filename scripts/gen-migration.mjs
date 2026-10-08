import { readFileSync } from 'node:fs';

const tableTemplate = readFileSync(new URL('./templates/table.sql', import.meta.url), 'utf8');

/**
 * The UTC yyyymmddHHMMss timestamp that starts a migration file name (ADR 0006).
 * @param {Date} now
 */
function timestamp(now) {
  return now.toISOString().slice(0, 'yyyy-mm-ddTHH:MM:ss'.length).replace(/\D/g, '');
}

/**
 * Renders the table template for a new table in a module's schema, and the path of its migration
 * file from the repository root.
 * @param {{ module: string, slug: string, now: Date }} options
 */
export function render({ module, slug, now }) {
  const schema = module.replaceAll('-', '_');
  const sql = tableTemplate.replaceAll('{{schema}}', schema).replaceAll('{{table}}', slug);
  return { path: `modules/${module}/migrations/${timestamp(now)}_${slug}.sql`, sql };
}
