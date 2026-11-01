// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The check behind PR / pr docs. A pull request documents the surface it changes in the same pull
// request (ADR 0088): its body has a Docs section that names the pages under apps/docs it changes,
// or says none with a reason, and when the change touches a surface that .github/docs-paths maps,
// the reason names that surface. The check judges the body and the list of changed files, not the
// pages: whether a named page is right is for the review before the pull request.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { errorAnnotation } from './annotation.mjs';
import { entryLines, pathMatcher } from './path-patterns.mjs';
import {
  changedPaths,
  escapeRegExp,
  givesNoReason,
  isBotPullRequest,
  parseNameStatus,
  section,
} from './pull-request.mjs';

export const docsPathsFile = '.github/docs-paths';

// The pages of the docs site (ADR 0048). A change under docs/ (an ADR, a plan file) describes a
// decision, not the product, so it is no docs change.
const docsSite = 'apps/docs/';

// What an entry says while its surface has no page.
const noneYet = 'none yet';

/**
 * The entries of .github/docs-paths: a pattern in the syntax of .github/risk-paths, then the pages
 * under apps/docs that describe the surface, separated by spaces, or `none yet`. # starts a comment.
 * The surface is the pattern without its leading slash, as a Docs section names it.
 * @param {string} text
 * @param {string} file the file the text comes from, named in an error
 * @returns {{ pattern: string, surface: string, pages: string[], matcher: RegExp }[]}
 */
export function parseDocsPaths(text, file = docsPathsFile) {
  return entryLines(text).map((line) => {
    const [pattern = '', ...pages] = line.split(/\s+/);
    if (pages.length === 0) {
      throw new Error(
        `${file} has the entry "${line}" without its pages: name the pages under ${docsSite} that describe the surface, or "${noneYet}".`,
      );
    }
    const none = pages.join(' ') === noneYet;
    const outside = pages.find((page) => !page.startsWith(docsSite));
    if (!none && outside !== undefined) {
      throw new Error(
        `${file} names ${outside} for "${pattern}", which is no page: a page lives under ${docsSite}, and a file under docs/ describes a decision, not the product.`,
      );
    }
    return {
      pattern,
      surface: pattern.replace(/^\//, ''),
      pages: none ? [] : pages,
      matcher: pathMatcher(pattern, file),
    };
  });
}

// A section that says none, with or without a reason: "None: ...", "none yet for ...", "N/A", also
// in emphasis or code marks. A section that declines in other words ("No page changes: ...") is
// read as naming pages, and the message for that case says both ways out.
const saysNone = /^[-*_`\s]*(?:none|n\/a|na)(?![a-z0-9])/i;

// Whether the section names the surface: its path, with or without the trailing slash and followed
// by nothing that extends it (packages/sdk-extras does not name packages/sdk), or one of the changed
// files under it, without regard to case. A nested surface's path names the surface it lies in too
// (modules/core/contracts/ names modules/core/), which is the reading a nested change calls for.
function namesSurface(docs, surface, files) {
  const text = docs.toLowerCase();
  const path = surface.replace(/\/$/, '').toLowerCase();
  const named = new RegExp(`${escapeRegExp(path)}(?![\\w.-])`);
  return named.test(text) || files.some((file) => text.includes(file.toLowerCase()));
}

/**
 * @param {{ body: string, author: string, headRef: string, fromFork: boolean, changes: readonly { status: string, path: string }[], docsPaths: string }} pull
 *   the pull request, its changed files as parseNameStatus returns them, and the text of
 *   .github/docs-paths
 * @returns {{ ok: boolean, message: string }}
 */
export function checkPrDocs({ body, author, headRef, fromFork, changes, docsPaths }) {
  if (isBotPullRequest({ author, headRef, fromFork })) return { ok: true, message: '' };
  const docs = section(body, 'Docs');
  if (docs === undefined) {
    return {
      ok: false,
      message: `The pull request body has no ## Docs section. Name the pages under ${docsSite} this change updates, or "None" with a reason that names the surface the change touches when ${docsPathsFile} maps it (ADR 0088).`,
    };
  }
  if (givesNoReason(docs)) {
    return {
      ok: false,
      message: `The ## Docs section of the pull request body is empty or says none without a reason. Name the pages under ${docsSite} this change updates, or "None" with a reason that names the surface the change touches when ${docsPathsFile} maps it (ADR 0088).`,
    };
  }
  // A file moved out of a surface changes that surface too, so a rename counts under both paths.
  const paths = changedPaths(changes);
  if (saysNone.test(docs)) {
    // Every mapped surface the change touches, deleted and renamed files included, that the reason
    // does not name.
    const unnamed = parseDocsPaths(docsPaths)
      .map(({ surface, matcher }) => ({
        surface,
        files: paths.filter((path) => matcher.test(path)),
      }))
      .filter(({ surface, files }) => files.length > 0 && !namesSurface(docs, surface, files))
      .map(({ surface }) => surface);
    if (unnamed.length > 0) {
      return {
        ok: false,
        message: `The ## Docs section says none, and the pull request changes ${unnamed.join(', ')}, which ${docsPathsFile} maps. Name each of these surfaces in the reason and say why its pages need no change, or name the pages this change updates (ADR 0088).`,
      };
    }
    return { ok: true, message: '' };
  }
  if (!paths.some((path) => path.startsWith(docsSite))) {
    return {
      ok: false,
      message: `The ## Docs section does not start with "None", so it names changed pages, and the pull request changes no file under ${docsSite}; a change under docs/ is no docs change. Change the page, or start the section with "None" and give the reason (ADR 0088).`,
    };
  }
  return { ok: true, message: '' };
}

// CI checks out the pull request's merge commit, whose first parent is the base branch, so HEAD^1
// to HEAD is the pull request's change, and .github/docs-paths is the pull request's copy: the file
// is a risk path, so a change to it waits for the maintainer (ADR 0086). The job passes the pull
// request through the environment, never inside the run script, so a body cannot inject shell code.
// A missing PR_FROM_FORK counts as a fork, which grants no exemption.
if (import.meta.main) {
  const changes = parseNameStatus(
    execFileSync('git', ['diff', '-z', '--name-status', '-M', 'HEAD^1', 'HEAD'], {
      encoding: 'utf8',
    }),
  );
  const { ok, message } = checkPrDocs({
    body: process.env.PR_BODY ?? '',
    author: process.env.PR_AUTHOR ?? '',
    headRef: process.env.PR_HEAD_REF ?? '',
    fromFork: process.env.PR_FROM_FORK !== 'false',
    changes,
    docsPaths: readFileSync(docsPathsFile, 'utf8'),
  });
  if (!ok) {
    console.log(errorAnnotation(message));
    process.exitCode = 1;
  }
}
