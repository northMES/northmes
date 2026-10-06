// Keeps customer data out of the repository (docs/plan/11-quality-and-testing.md, "Test data and
// fixtures"). The organisation number pattern (six digits, a hyphen, four digits) fails in any
// file.
//
// Findings name the file and line only, never the matched text, because CI logs are public.

const organisationNumberPattern = /\d{6}-\d{4}/;

/**
 * @typedef {{ path: string, content: string }} RepositoryFile
 * @typedef {{ path: string, line: number, kind: 'organisation-number' }} Finding
 */

/**
 * Scans in-memory files for customer data.
 * @param {readonly RepositoryFile[]} files
 * @param {Iterable<string> | undefined} _denyHashes
 * @returns {{ findings: Finding[] }}
 */
export function scan(files, _denyHashes) {
  const findings = [];
  for (const { path, content } of files) {
    content.split('\n').forEach((text, index) => {
      if (organisationNumberPattern.test(text)) {
        findings.push({ path, line: index + 1, kind: 'organisation-number' });
      }
    });
  }
  return { findings };
}
