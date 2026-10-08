import { readFileSync } from 'node:fs';

const tableTemplate = readFileSync(new URL('./templates/table.sql', import.meta.url), 'utf8');

/**
 * Renders the table template for a new table in a module's schema.
 * @param {{ module: string, slug: string, now: Date }} options
 */
export function render({ module, slug }) {
  const schema = module.replaceAll('-', '_');
  const sql = tableTemplate.replaceAll('{{schema}}', schema).replaceAll('{{table}}', slug);
  return { sql };
}
