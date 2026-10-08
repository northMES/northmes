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

export interface MainIo {
  log(line: string): void;
  error(line: string): void;
  /** The repository root, which the rendered path is relative to. */
  readonly root: string;
  now(): Date;
}

/** pnpm gen:migration <module> <slug>: writes the rendered file and returns the exit code. */
export function main(argv: readonly string[], io: MainIo): Promise<number>;
