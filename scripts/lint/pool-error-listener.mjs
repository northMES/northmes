// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// Every pg pool gets an error handler before use
// (docs/adr/0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md). When
// Postgres ends an idle connection, as it does for each one when useTestDatabase drops a test
// database with (force), pg-pool emits error on the pool. Without a listener that error is thrown:
// it fails a Vitest run as an unhandled error, and Vitest prints the pg client that pg-pool puts on
// the error.
//
// A pg Client in test code gets the same handler: a client that a test holds open while
// useTestDatabase drops its database emits error, and without a listener Vitest reports it as an
// unhandled error. Test code is a *.test.* file, a file under a test/ or e2e/ directory, the
// testing package (packages/testing/) and a testing module such as apps/backend/src/testing.ts.
//
// A pool construction is `new Pool(...)`, `new <anything>.Pool(...)`, or `new X(...)` where X is
// imported as Pool from pg or as the default export of pg-pool. A client construction is
// `new X(...)` where X is imported as Client from pg, or `new <pg>.Client(...)` where <pg> is the
// default or namespace import of pg. A construction is a finding unless one of these holds:
// - `.on('error', ...)` is chained on the construction itself.
// - The construction is assigned to a variable or a property, the first mention of that variable
//   or property afterwards is `.on('error', ...)` on it, and that call is a statement of the block
//   that holds the construction. So a listener inside an if, or in a later hook, does not count.
// `.once` does not count, because pg-pool emits one error for each idle connection that ends, and a
// client follows the same rule. The scan parses each file with TypeScript, so a Pool in a comment or
// a string is not a finding.
//
// test/meta/pool-error-listener.test.ts scans every TypeScript and JavaScript file that git tracks
// outside docs/, so pnpm check fails on a finding.

import ts from 'typescript';

/**
 * @typedef {{ path: string, text: string }} SourceFile
 * @typedef {{ path: string, line: number }} Finding
 */

/** A cheap filter, so only files that may construct a pool or a client are parsed. */
const mayConstruct = /\bPool\b|['"]pg-pool['"]|\bClient\b/;

/** The paths of test code, where a pg Client is checked too. */
const testCode = [
  /\.test\.[cm]?[jt]sx?$/,
  /(^|\/)(test|e2e)\//,
  /^packages\/testing\//,
  /(^|\/)testing\.[cm]?[jt]s$/,
];

/** @param {string} path */
function isTestCode(path) {
  return testCode.some((pattern) => pattern.test(path));
}

/**
 * @typedef {{ pool: Set<string>, client: Set<string>, pg: Set<string> }} PgNames
 */

/**
 * The local names that a file imports pg under: Pool as in `import { Pool as PgPool } from 'pg'`
 * and `import BarePool from 'pg-pool'`, Client as in `import { Client } from 'pg'`, and the module
 * itself as in `import pg from 'pg'` and `import * as postgres from 'pg'`.
 * @param {ts.SourceFile} source
 * @returns {PgNames}
 */
function importedPgNames(source) {
  /** @type {PgNames} */
  const names = { pool: new Set(['Pool']), client: new Set(), pg: new Set() };
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }
    const from = statement.moduleSpecifier.text;
    const clause = statement.importClause;
    if (from === 'pg-pool' && clause?.name) names.pool.add(clause.name.text);
    if (from === 'pg' && clause?.name) names.pg.add(clause.name.text);
    const bindings = clause?.namedBindings;
    if (from === 'pg' && bindings && ts.isNamespaceImport(bindings)) {
      names.pg.add(bindings.name.text);
    }
    if ((from === 'pg' || from === 'pg-pool') && bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        const imported = (element.propertyName ?? element.name).text;
        if (imported === 'Pool') names.pool.add(element.name.text);
        if (imported === 'Client' && from === 'pg') names.client.add(element.name.text);
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
 * Whether `node` is `new Client(...)` with Client from pg, or `new pg.Client(...)` and
 * `new pg.default.Client(...)` with pg the module.
 * @param {ts.Node} node
 * @param {PgNames} names
 * @returns {node is ts.NewExpression}
 */
function isClientConstruction(node, names) {
  if (!ts.isNewExpression(node)) return false;
  const callee = ts.skipParentheses(node.expression);
  if (ts.isIdentifier(callee)) return names.client.has(callee.text);
  if (!ts.isPropertyAccessExpression(callee) || callee.name.text !== 'Client') return false;
  let root = callee.expression;
  while (ts.isPropertyAccessExpression(root)) root = root.expression;
  return ts.isIdentifier(root) && names.pg.has(root.text);
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
 * The pool constructions, and the client constructions in test code, that get no error listener
 * before use, in the order of the files and their lines.
 * @param {SourceFile[]} files
 * @returns {Finding[]}
 */
export function scan(files) {
  /** @type {Finding[]} */
  const findings = [];
  for (const { path, text } of files) {
    if (!mayConstruct.test(text)) continue;
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
    const names = importedPgNames(source);
    const checksClients = isTestCode(path);
    /** @param {ts.Node} node */
    const visit = (node) => {
      const constructs =
        isPoolConstruction(node, names.pool) ||
        (checksClients && isClientConstruction(node, names));
      if (constructs && !isListened(node, source)) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
        findings.push({ path, line: line + 1 });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return findings;
}
