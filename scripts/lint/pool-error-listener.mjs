// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// Every pg pool gets an error handler before use
// (docs/adr/0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md). When
// Postgres ends an idle connection, as it does for each one when useTestDatabase drops a test
// database with (force), pg-pool emits error on the pool. Without a listener that error is thrown:
// it fails a Vitest run as an unhandled error, and Vitest prints the pg client that pg-pool puts on
// the error.
//
// A pool construction is `new Pool(...)`, `new <anything>.Pool(...)`, or `new X(...)` where X is
// imported as Pool from pg or as the default export of pg-pool. It is a finding unless one of
// these holds:
// - `.on('error', ...)` is chained on the construction itself.
// - The construction is assigned to a variable or a property, the first mention of that variable
//   or property afterwards is `.on('error', ...)` on it, and that call is a statement of the block
//   that holds the construction. So a listener inside an if, or in a later hook, does not count.
// `.once` does not count, because pg-pool emits one error for each idle connection that ends. The
// scan parses each file with TypeScript, so a Pool in a comment or a string is not a finding.
//
// test/meta/pool-error-listener.test.ts scans every TypeScript and JavaScript file that git tracks
// outside docs/, so pnpm check fails on a finding.

import ts from 'typescript';

/**
 * @typedef {{ path: string, text: string }} SourceFile
 * @typedef {{ path: string, line: number }} Finding
 */

/** A cheap filter, so only files that may construct a pool are parsed. */
const mayConstructPool = /\bPool\b|['"]pg-pool['"]/;

/**
 * The local names that a file imports pg's Pool under: `import { Pool as PgPool } from 'pg'` and
 * `import BarePool from 'pg-pool'`.
 * @param {ts.SourceFile} source
 * @returns {Set<string>}
 */
function importedPoolNames(source) {
  const names = new Set(['Pool']);
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }
    const from = statement.moduleSpecifier.text;
    const clause = statement.importClause;
    if (from === 'pg-pool' && clause?.name) names.add(clause.name.text);
    const bindings = clause?.namedBindings;
    if ((from === 'pg' || from === 'pg-pool') && bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        if ((element.propertyName ?? element.name).text === 'Pool') names.add(element.name.text);
      }
    }
  }
  return names;
}

/**
 * @param {ts.Node} node
 * @param {Set<string>} poolNames
 * @returns {node is ts.NewExpression}
 */
function isPoolConstruction(node, poolNames) {
  if (!ts.isNewExpression(node)) return false;
  const callee = ts.skipParentheses(node.expression);
  if (ts.isIdentifier(callee)) return poolNames.has(callee.text);
  return ts.isPropertyAccessExpression(callee) && callee.name.text === 'Pool';
}

/**
 * The outermost expression that still evaluates to `node`: through parentheses, `as`, `satisfies`
 * and `!`.
 * @param {ts.Node} node
 */
function outermost(node) {
  let current = node;
  while (
    ts.isParenthesizedExpression(current.parent) ||
    ts.isAsExpression(current.parent) ||
    ts.isSatisfiesExpression(current.parent) ||
    ts.isNonNullExpression(current.parent)
  ) {
    current = current.parent;
  }
  return current;
}

/**
 * The statement that holds `node` directly in a block, a source file or a switch clause.
 * @param {ts.Node} node
 * @returns {ts.Node | undefined}
 */
function statementOf(node) {
  let current = node;
  while (current.parent) {
    const { parent } = current;
    if (
      ts.isBlock(parent) ||
      ts.isSourceFile(parent) ||
      ts.isModuleBlock(parent) ||
      ts.isCaseClause(parent) ||
      ts.isDefaultClause(parent)
    ) {
      return current;
    }
    current = parent;
  }
  return undefined;
}

/**
 * The variable or property the construction is assigned to, as its text: `pool` or `this.pool`.
 * @param {ts.NewExpression} construction
 * @returns {string | undefined}
 */
function bindingOf(construction) {
  const node = outermost(construction);
  const { parent } = node;
  if (ts.isVariableDeclaration(parent) && parent.initializer === node) {
    return ts.isIdentifier(parent.name) ? parent.name.text : undefined;
  }
  if (
    ts.isBinaryExpression(parent) &&
    parent.right === node &&
    parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    (ts.isIdentifier(parent.left) || ts.isPropertyAccessExpression(parent.left))
  ) {
    return parent.left.getText();
  }
  return undefined;
}

/**
 * The first mention of `binding` that starts after `position`: an identifier, or a property access
 * such as `this.pool`. The names in `other.pool` and `{ pool: other }` do not mention a variable
 * called pool.
 * @param {ts.SourceFile} source
 * @param {string} binding
 * @param {number} position
 * @returns {ts.Node | undefined}
 */
function firstMentionAfter(source, binding, position) {
  /** @type {ts.Node | undefined} */
  let first;
  /** @param {ts.Node} node */
  const visit = (node) => {
    if (first || node.end <= position) return;
    if (node.getStart(source) >= position && mentions(node, binding, source)) {
      first = node;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return first;
}

/**
 * @param {ts.Node} node
 * @param {string} binding
 * @param {ts.SourceFile} source
 */
function mentions(node, binding, source) {
  if (ts.isIdentifier(node)) {
    const { parent } = node;
    const isMemberName =
      (ts.isPropertyAccessExpression(parent) || ts.isPropertyAssignment(parent)) &&
      parent.name === node;
    return !isMemberName && node.text === binding;
  }
  return ts.isPropertyAccessExpression(node) && node.getText(source) === binding;
}

/**
 * The `.on('error', ...)` call whose object is `node`, if it is one.
 * @param {ts.Node} node
 * @returns {ts.CallExpression | undefined}
 */
function errorListenerOn(node) {
  const object = outermost(node);
  const access = object.parent;
  if (!ts.isPropertyAccessExpression(access) || access.expression !== object) return undefined;
  if (access.name.text !== 'on') return undefined;
  const call = access.parent;
  if (!ts.isCallExpression(call) || call.expression !== access) return undefined;
  const [event] = call.arguments;
  const isError = event !== undefined && ts.isStringLiteralLike(event) && event.text === 'error';
  return isError ? call : undefined;
}

/**
 * Whether the pool that `construction` makes gets its error listener before use.
 * @param {ts.NewExpression} construction
 * @param {ts.SourceFile} source
 */
function isListened(construction, source) {
  if (errorListenerOn(construction)) return true;
  const binding = bindingOf(construction);
  if (!binding) return false;
  const mention = firstMentionAfter(source, binding, construction.end);
  const listener = mention && errorListenerOn(mention);
  if (!listener) return false;
  const statement = outermost(listener).parent;
  return (
    ts.isExpressionStatement(statement) && statement.parent === statementOf(construction)?.parent
  );
}

/**
 * The pool constructions that get no error listener before use, in the order of the files and
 * their lines.
 * @param {SourceFile[]} files
 * @returns {Finding[]}
 */
export function scan(files) {
  /** @type {Finding[]} */
  const findings = [];
  for (const { path, text } of files) {
    if (!mayConstructPool.test(text)) continue;
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
    const poolNames = importedPoolNames(source);
    /** @param {ts.Node} node */
    const visit = (node) => {
      if (isPoolConstruction(node, poolNames) && !isListened(node, source)) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
        findings.push({ path, line: line + 1 });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return findings;
}
