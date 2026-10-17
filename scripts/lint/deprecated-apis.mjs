// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// Finds uses of deprecated APIs, the OpenSSF interfaces_current criterion. The TypeScript language
// service reports a use of a symbol marked @deprecated as suggestion 6385 and a call to a deprecated
// overload as 6387; the compiler itself reports neither, so tsc passes with them. Each finding names
// the file, the line, the column and the message.
//
// Biome's suspicious/noDeprecatedImports is no replacement: it flags an import when any overload of
// the symbol is deprecated, such as rxjs's from and TanStack Router's useBlocker, also when the code
// calls a current one.
//
// test/meta/deprecated-apis.test.ts runs the scan over apps/web's tsconfig.json, so pnpm check fails
// on a finding.

import path from 'node:path';
import ts from 'typescript';

/**
 * @typedef {{ path: string, text: string }} SourceFile
 * @typedef {{ path: string, line: number, column: number, code: number, message: string }} Finding
 */

/** '{0}' is deprecated, and: The signature '{0}' of '{1}' is deprecated. */
const deprecatedCodes = new Set([6385, 6387]);

/**
 * The deprecated uses in a set of files, each file's path relative to root.
 * @param {string} root The directory the paths are relative to.
 * @param {string[]} fileNames The project's files, absolute.
 * @param {ts.CompilerOptions} options The project's compiler options.
 * @param {(fileName: string) => string | undefined} readFile Reads a file, the library files too.
 * @returns {Finding[]}
 */
function findDeprecated(root, fileNames, options, readFile) {
  /** @type {ts.LanguageServiceHost} */
  const host = {
    getScriptFileNames: () => fileNames,
    getScriptVersion: () => '0',
    getScriptSnapshot: (fileName) => {
      const text = readFile(fileName);
      return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
    },
    getCurrentDirectory: () => root,
    getCompilationSettings: () => options,
    getDefaultLibFileName: (settings) => ts.getDefaultLibFilePath(settings),
    fileExists: (fileName) => readFile(fileName) !== undefined,
    readFile,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
  };
  const service = ts.createLanguageService(host, ts.createDocumentRegistry());
  /** @type {Finding[]} */
  const findings = [];
  for (const fileName of fileNames) {
    for (const diagnostic of service.getSuggestionDiagnostics(fileName)) {
      if (!deprecatedCodes.has(diagnostic.code) || diagnostic.start === undefined) continue;
      const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
      findings.push({
        path: path.relative(root, fileName).split(path.sep).join('/'),
        line: line + 1,
        column: character + 1,
        code: diagnostic.code,
        // A type in the message names its declaration file by its absolute path.
        message: ts
          .flattenDiagnosticMessageText(diagnostic.messageText, ' ')
          .replaceAll(path.join(root, path.sep), ''),
      });
    }
  }
  service.dispose();
  return findings;
}

/** The options for sources without a tsconfig.json: ES modules that import each other by path. */
const defaultOptions = {
  strict: true,
  noEmit: true,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  allowImportingTsExtensions: true,
};

/**
 * The deprecated uses in the given sources, compiled with the given options.
 * @param {string} root The directory the sources' paths are relative to.
 * @param {SourceFile[]} files The sources.
 * @param {ts.CompilerOptions} [options] The compiler options.
 * @returns {Finding[]}
 */
export function scan(root, files, options = defaultOptions) {
  const texts = new Map(files.map((file) => [path.join(root, file.path), file.text]));
  return findDeprecated(root, [...texts.keys()], options, (fileName) =>
    texts.has(fileName) ? texts.get(fileName) : ts.sys.readFile(fileName),
  );
}

/**
 * The deprecated uses in the files a tsconfig.json includes, outside node_modules.
 * @param {string} root The directory the findings' paths are relative to.
 * @param {string} configPath The tsconfig.json, relative to root.
 * @returns {Finding[]}
 */
export function scanProject(root, configPath) {
  const parsed = ts.getParsedCommandLineOfConfigFile(path.join(root, configPath), undefined, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
      throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    },
  });
  if (parsed === undefined) throw new Error(`${configPath}: no tsconfig`);
  const fileNames = parsed.fileNames.filter((fileName) => !fileName.includes('/node_modules/'));
  return findDeprecated(root, fileNames, parsed.options, ts.sys.readFile);
}
