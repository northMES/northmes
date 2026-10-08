// Keeps app paths out of string literals (docs/adr/0062-web-form-contracts-url-view-state-and-
// module-link-manifests.md): paths come from link builders and apiPath.

import ts from 'typescript';

/**
 * @typedef {{ path: string, text: string }} RepositoryFile
 * @typedef {{ path: string, literal: string, reason?: string }} AllowlistEntry
 * @typedef {{ path: string, line: number, literal: string }} Finding
 */

/**
 * The folders the rule covers. Paths are repository-relative with forward slashes, as `git ls-files`
 * prints them.
 */
const scannedFolders = [
  /^modules\/[^/]+\/web\//,
  /^examples\/[^/]+\/web\//,
  /^apps\/web\//,
  /^e2e\//,
];

/** TypeScript and JavaScript sources, the files the TypeScript parser reads. */
const sourceExtension = /\.[cm]?[jt]sx?$/;

/** The JSX attributes that take a path. */
const pathAttributes = new Set(['to', 'href']);

/** The calls whose options object takes a path in `to`. */
const navigationCalls = new Set(['navigate', 'redirect']);

/** @param {string} path */
function isScanned(path) {
  return sourceExtension.test(path) && scannedFolders.some((folder) => folder.test(path));
}

/**
 * An absolute path on this origin. A protocol-relative URL (`//host/...`) names another host.
 * @param {string} value
 */
function isAppPath(value) {
  return value.startsWith('/') && !value.startsWith('//');
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
 * The literals that start the value of an expression: a string or template literal, the left end of
 * a `+` concatenation and both branches of a conditional, read through parentheses, `as`,
 * `satisfies` and `!`. A template literal's text is its source between the backticks.
 * @param {ts.Expression} expression
 * @param {ts.SourceFile} source
 * @returns {{ node: ts.Node, text: string }[]}
 */
function leadingLiterals(expression, source) {
  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isNonNullExpression(expression)
  ) {
    return leadingLiterals(expression.expression, source);
  }
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return [{ node: expression, text: expression.text }];
  }
  if (ts.isTemplateExpression(expression)) {
    return [{ node: expression, text: expression.getText(source).slice(1, -1) }];
  }
  if (
    ts.isBinaryExpression(expression) &&
    expression.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    return leadingLiterals(expression.left, source);
  }
  if (ts.isConditionalExpression(expression)) {
    return [
      ...leadingLiterals(expression.whenTrue, source),
      ...leadingLiterals(expression.whenFalse, source),
    ];
  }
  return [];
}

/**
 * Throws on the first allowlist entry whose reason is missing or blank.
 * @param {readonly AllowlistEntry[]} allowlist
 */
function checkReasons(allowlist) {
  allowlist.forEach((entry, index) => {
    if (typeof entry.reason !== 'string' || entry.reason.trim() === '') {
      throw new Error(
        `Path literal allowlist entry ${index + 1} (${entry.path}, ${entry.literal}) gives no reason`,
      );
    }
  });
}

/**
 * Finds app paths written as string literals. Throws when an allowlist entry gives no reason.
 * @param {readonly RepositoryFile[]} files
 * @param {readonly AllowlistEntry[]} allowlist
 * @returns {Finding[]}
 */
export function scan(files, allowlist) {
  checkReasons(allowlist);
  const isAllowed = (path, literal) =>
    allowlist.some((entry) => entry.path === path && entry.literal === literal);
  /** @type {Finding[]} */
  const findings = [];

  for (const { path, text } of files.filter((file) => isScanned(file.path))) {
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
    const visit = (node) => {
      const literals = pathExpressions(node, source).flatMap((expression) =>
        leadingLiterals(expression, source),
      );
      for (const literal of literals) {
        if (isAppPath(literal.text) && !isAllowed(path, literal.text)) {
          const start = literal.node.getStart(source);
          findings.push({
            path,
            line: source.getLineAndCharacterOfPosition(start).line + 1,
            literal: literal.text,
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  return findings;
}
