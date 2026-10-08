// The types of plugin-build.mjs, for the TypeScript tests that build a plugin.

export interface BuiltPlugin {
  /** The files the build wrote, relative to the plugin's folder, such as dist/server.js. */
  readonly files: readonly string[];
  /**
   * Per built file, the package specifiers its code still imports, such as the host-provided
   * packages the build left external. Imports of the build's own files are left out.
   */
  readonly imports: Readonly<Record<string, readonly string[]>>;
}

/**
 * Builds the plugin package in `dir` into its dist/ folder and copies the installable package
 * (package.json, dist/ and migrations/) to `outDir`, which it empties first.
 */
export function buildPlugin(dir: string, outDir: string): Promise<BuiltPlugin>;

export interface MainIo {
  log(line: string): void;
  error(line: string): void;
  /** The repository root, which holds examples/ and plugins/. */
  readonly root: string;
}

/** pnpm plugin:build <id>: builds the plugin and copies it to plugins/<id>/, returns the exit code. */
export function main(argv: readonly string[], io: MainIo): Promise<number>;
