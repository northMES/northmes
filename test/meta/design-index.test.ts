// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { root, trackedFiles } from './docs.ts';

// ADR 0079: an approved design artifact is recorded by its URL and the version id of the approved
// publish. Its row in the design project's README names both, its page source is in the area's
// folder, and the approval record in docs/design/<area>/ names the same URL and version id.

const index = 'docs/design/project/README.md';

/** A row of the README's Pages table. */
interface PageRow {
  readonly folder: string;
  readonly page: string;
  readonly version: string;
  readonly url: string;
}

function pageRows(): PageRow[] {
  return readFileSync(`${root}${index}`, 'utf8')
    .split('\n')
    .filter((line) => line.startsWith('| ') && !line.startsWith('| Folder |'))
    .map((line) => line.replace(/^\| /, '').replace(/ \|$/, '').split(' | '))
    .map(([folder = '', page = '', , , version = '', url = '']) => ({
      folder: folder.trim(),
      page: page.trim(),
      version: version.trim(),
      url: url.trim(),
    }));
}

/** The version id of an artifact publish; a Claude Design etag is digits only. */
const artifactVersion = /^\d+-[0-9a-f]{4}$/;

// A row is an artifact row when it names an artifact URL or an artifact version id, so a row that
// lost either one still fails the checks below.
const artifactRows = pageRows().filter(
  ({ version, url }) => url !== '' || artifactVersion.test(version),
);

describe('design index', () => {
  it('ADR0079 every artifact row names a claude.ai artifact URL and the version id of the approved publish', () => {
    expect(artifactRows.length).toBeGreaterThan(0);
    for (const { page, version, url } of artifactRows) {
      expect(url, page).toMatch(/^https:\/\/claude\.ai\/artifact\/[A-Za-z0-9]+$/);
      expect(version, page).toMatch(artifactVersion);
    }
  });

  it("ADR0079 every artifact row's page file is in its folder", () => {
    const tracked = trackedFiles();
    const missing = artifactRows
      .map(({ folder, page }) => `docs/design/project/${folder}${page}`)
      .filter((path) => !tracked.has(path));

    expect(missing).toEqual([]);
  });

  it('ADR0079 the approval record that links an artifact page names the same URL and version id', () => {
    const records = [...trackedFiles()].filter((path) =>
      /^docs\/design\/[a-z-]+\/[^/]+\.md$/.test(path),
    );
    for (const { folder, page, version, url } of artifactRows) {
      const link = `(../project/${folder}${page})`;
      const linking = records.filter((record) =>
        readFileSync(`${root}${record}`, 'utf8').includes(link),
      );
      expect(linking, `a record in docs/design/ links ${folder}${page}`).not.toEqual([]);
      for (const record of linking) {
        const text = readFileSync(`${root}${record}`, 'utf8');
        expect(text, `${record} names the URL of ${page}`).toContain(url);
        expect(text, `${record} names the version id of ${page}`).toContain(version);
      }
    }
  });
});
