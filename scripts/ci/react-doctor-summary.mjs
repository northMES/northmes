// The summary step of CI / react doctor. pnpm react-doctor runs react-doctor with --json, which
// writes the report to the file named by --json-out and prints nothing else. This script reads that
// report, the path in its first argument, and writes the findings as Markdown to the file that
// GITHUB_STEP_SUMMARY names, which GitHub shows on the run page, and to the job log.

import { appendFileSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const report = JSON.parse(readFileSync(process.argv[2], 'utf8'));

function count(number, noun) {
  return `${number} ${noun}${number === 1 ? '' : 's'}`;
}

// A table cell keeps its text on one line and shows a | instead of ending the cell.
function cell(text) {
  return text.replaceAll('|', '\\|').replace(/\s*\n\s*/g, ' ');
}

function body() {
  if (report.error !== null) {
    return [`The scan did not finish: ${report.error.message}`];
  }
  const { errorCount, warningCount, affectedFileCount } = report.summary;
  if (errorCount + warningCount === 0) {
    return ['No findings.'];
  }
  // A finding's path is relative to its project's package root.
  const rows = report.projects.flatMap(({ packageRoot, diagnostics }) =>
    diagnostics.map((finding) => {
      const path = relative(
        report.directory,
        resolve(report.directory, packageRoot, finding.normalizedFilePath),
      );
      const where = `${path}:${finding.line}:${finding.column}`;
      const rule = `${finding.plugin}/${finding.rule}`;
      return `| ${finding.severity} | ${rule} | ${where} | ${cell(finding.message)} |`;
    }),
  );
  return [
    `${count(errorCount, 'error')} and ${count(warningCount, 'warning')} in ${count(affectedFileCount, 'file')}.`,
    '',
    '| Severity | Rule | Where | Message |',
    '|---|---|---|---|',
    ...rows,
  ];
}

const markdown = `${['## React Doctor', '', ...body()].join('\n')}\n`;

appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
process.stdout.write(markdown);
