// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// Every pg pool gets an error handler before use (docs/adr/0041-test-strategy-tdd-vitest-projects-
// testcontainers-and-playwright.md). When Postgres ends an idle connection, as it does when
// useTestDatabase drops a test database with (force), pg-pool emits error on the pool. Without a
// listener that error is thrown: it fails a Vitest run as an unhandled error, and Vitest prints the
// pg client that pg-pool puts on the error.
//
// A `new Pool(...)` or `new pg.Pool(...)` is a finding unless it is assigned to a variable or a
// property, and the first mention of that variable or property after the construction is a call
// of `.on('error', ...)` or `.once('error', ...)` on it. The scan parses each file with TypeScript,
// so a Pool in a comment or a string is not a finding.
//
// test/meta/pool-error-listener.test.ts scans every TypeScript and JavaScript file outside docs/, so
// pnpm check fails on a finding.

import ts from 'typescript';

/**
 * @typedef {{ path: string, text: string }} SourceFile
 * @typedef {{ path: string, line: number }} Finding
 */

/** A cheap filter, so only files that may construct a pool are parsed. */
const mayConstructPool = /\bnew\s+(?:[\w$]+\.)*Pool\b/;

/** @param {ts.Node} node */
function isPoolConstruction(node) {
  if (!ts.isNewExpression(node)) return false;
  const callee = node.expression;
  if (ts.isIdentifier(callee)) return callee.text === 'Pool';
  return ts.isPropertyAccessExpression(callee) && callee.name.text === 'Pool';
}

/**
 * The variable or property the construction is assigned to, as its text: `pool` or `this.pool`.
 * @param {ts.NewExpression} construction
 * @returns {string | undefined}
 */
function bindingOf(construction) {
  let node = /** @type {ts.Node} */ (construction);
  while (
    ts.isParenthesizedExpression(node.parent) ||
    ts.isAsExpression(node.parent) ||
    ts.isSatisfiesExpression(node.parent) ||
    ts.isNonNullExpression(node.parent)
  ) {
    node = node.parent;
  }
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
 * Whether `mention` is the object of `.on('error', ...)` or `.once('error', ...)`.
 * @param {ts.Node} mention
 */
function isErrorListener(mention) {
  let node = mention;
  while (ts.isNonNullExpression(node.parent) || ts.isParenthesizedExpression(node.parent)) {
    node = node.parent;
  }
  const access = node.parent;
  if (!ts.isPropertyAccessExpression(access) || access.expression !== node) return false;
  if (access.name.text !== 'on' && access.name.text !== 'once') return false;
  const call = access.parent;
  if (!ts.isCallExpression(call) || call.expression !== access) return false;
  const [event] = call.arguments;
  return event !== undefined && ts.isStringLiteralLike(event) && event.text === 'error';
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
    /** @param {ts.Node} node */
    const visit = (node) => {
      if (isPoolConstruction(node)) {
        const binding = bindingOf(/** @type {ts.NewExpression} */ (node));
        const mention = binding && firstMentionAfter(source, binding, node.end);
        if (!mention || !isErrorListener(mention)) {
          const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
          findings.push({ path, line: line + 1 });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return findings;
}
