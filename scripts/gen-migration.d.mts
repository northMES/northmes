// The types of gen-migration.mjs, for the TypeScript tests that render a migration file.

export interface RenderOptions {
  /** The module id, which names the folder under modules/ and, as its SQL name, the schema. */
  readonly module: string;
  /** The table name, which also ends the file name. */
  readonly slug: string;
  readonly now: Date;
}

export interface RenderedMigration {
  /** The file's path from the repository root. */
  readonly path: string;
  readonly sql: string;
}

export function render(options: RenderOptions): RenderedMigration;
