// The types of plugin-build.mjs, for the TypeScript tests that build a plugin.

export interface BuiltPlugin {
  /** The files the build wrote, relative to the plugin's folder, such as dist/server.js. */
  readonly files: readonly string[];
  /** Per built file, the specifiers it still imports: the host-provided packages left external. */
  readonly imports: Readonly<Record<string, readonly string[]>>;
}

/** Builds the plugin package in `dir` into its dist/ folder. */
export function buildPlugin(dir: string, outDir: string): Promise<BuiltPlugin>;
