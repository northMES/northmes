// Keeps app paths out of string literals (docs/adr/0062-web-form-contracts-url-view-state-and-
// module-link-manifests.md): paths come from link builders and apiPath.

import ts from 'typescript';

/**
 * @typedef {{ path: string, text: string }} RepositoryFile
 * @typedef {{ path: string, literal: string, reason: string }} AllowlistEntry
 * @typedef {{ path: string, line: number, literal: string }} Finding
 */

/** The JSX attributes that take a path. */
const pathAttributes = new Set(['to', 'href']);

/** @param {string} value */
function isAppPath(value) {
  return value.startsWith('/');
}

/**
 * The string literal a JSX attribute holds, written directly or inside braces.
 * @param {ts.JsxAttribute} attribute
 */
function attributeLiteral(attribute) {
  const value = attribute.initializer;
  if (value && ts.isJsxExpression(value)) {
    return value.expression && ts.isStringLiteral(value.expression) ? value.expression : undefined;
  }
  return value && ts.isStringLiteral(value) ? value : undefined;
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
      const literal =
        ts.isJsxAttribute(node) && pathAttributes.has(node.name.getText(source))
          ? attributeLiteral(node)
          : undefined;
      if (literal && isAppPath(literal.text)) {
        const start = literal.getStart(source);
        findings.push({
          path,
          line: source.getLineAndCharacterOfPosition(start).line + 1,
          literal: literal.text,
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  return findings;
}
