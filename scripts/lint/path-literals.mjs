// Keeps app paths out of string literals (docs/adr/0062-web-form-contracts-url-view-state-and-
// module-link-manifests.md): paths come from link builders and apiPath.

import ts from 'typescript';

/**
 * @typedef {{ path: string, text: string }} RepositoryFile
 * @typedef {{ path: string, literal: string, reason: string }} AllowlistEntry
 * @typedef {{ path: string, line: number, literal: string }} Finding
 */

/** @param {string} value */
function isAppPath(value) {
  return value.startsWith('/');
}

/**
 * Finds app paths written as string literals.
 * @param {readonly RepositoryFile[]} files
 * @param {readonly AllowlistEntry[]} _allowlist
 * @returns {Finding[]}
 */
export function scan(files, _allowlist) {
  /** @type {Finding[]} */
  const findings = [];

  for (const { path, text } of files) {
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node) => {
      if (
        ts.isJsxAttribute(node) &&
        node.name.getText(source) === 'to' &&
        node.initializer &&
        ts.isStringLiteral(node.initializer) &&
        isAppPath(node.initializer.text)
      ) {
        const start = node.initializer.getStart(source);
        findings.push({
          path,
          line: source.getLineAndCharacterOfPosition(start).line + 1,
          literal: node.initializer.text,
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  return findings;
}
