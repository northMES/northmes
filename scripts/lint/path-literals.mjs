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

/** The calls whose options object takes a path in `to`. */
const navigationCalls = new Set(['navigate']);

/** @param {string} value */
function isAppPath(value) {
  return value.startsWith('/');
}

/**
 * The name of the function a call calls: `navigate` for both `navigate()` and `router.navigate()`.
 * @param {ts.CallExpression} call
 */
function calleeName(call) {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) {
    return callee.text;
  }
  return ts.isPropertyAccessExpression(callee) ? callee.name.text : undefined;
}

/**
 * The value of a property written as `name: value` or `'name': value` in an object literal.
 * @param {ts.ObjectLiteralExpression} object
 * @param {string} name
 */
function propertyValue(object, name) {
  for (const property of object.properties) {
    if (
      ts.isPropertyAssignment(property) &&
      (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
      property.name.text === name
    ) {
      return property.initializer;
    }
  }
  return undefined;
}

/**
 * The expressions in a node that take an app path: the value of a `to` or `href` JSX attribute, the
 * `to` option of a navigate call and the URL of a `goto` call such as `page.goto(url)`.
 * @param {ts.Node} node
 * @param {ts.SourceFile} source
 * @returns {ts.Expression[]}
 */
function pathExpressions(node, source) {
  if (ts.isJsxAttribute(node)) {
    const value = node.initializer;
    if (!value || !pathAttributes.has(node.name.getText(source))) {
      return [];
    }
    if (ts.isJsxExpression(value)) {
      return value.expression ? [value.expression] : [];
    }
    return ts.isStringLiteral(value) ? [value] : [];
  }
  if (ts.isCallExpression(node)) {
    const name = calleeName(node);
    const [first] = node.arguments;
    if (!first) {
      return [];
    }
    if (name === 'goto' && ts.isPropertyAccessExpression(node.expression)) {
      return [first];
    }
    if (name && navigationCalls.has(name) && ts.isObjectLiteralExpression(first)) {
      const to = propertyValue(first, 'to');
      return to ? [to] : [];
    }
  }
  return [];
}

/**
 * Finds app paths written as string literals.
 * @param {readonly RepositoryFile[]} files
 * @param {readonly AllowlistEntry[]} allowlist
 * @returns {Finding[]}
 */
export function scan(files, allowlist) {
  const isAllowed = (path, literal) =>
    allowlist.some((entry) => entry.path === path && entry.literal === literal);
  /** @type {Finding[]} */
  const findings = [];

  for (const { path, text } of files) {
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
    const visit = (node) => {
      for (const expression of pathExpressions(node, source)) {
        if (
          ts.isStringLiteral(expression) &&
          isAppPath(expression.text) &&
          !isAllowed(path, expression.text)
        ) {
          const start = expression.getStart(source);
          findings.push({
            path,
            line: source.getLineAndCharacterOfPosition(start).line + 1,
            literal: expression.text,
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  return findings;
}
