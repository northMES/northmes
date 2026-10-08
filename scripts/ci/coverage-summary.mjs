// The coverage summary step of CI / test. pnpm test:coverage writes coverage/text-summary.txt in the
// checkout, and GitHub shows the Markdown in the file that GITHUB_STEP_SUMMARY names on the run page.

import { appendFileSync, readFileSync } from 'node:fs';

const summary = readFileSync('coverage/text-summary.txt', 'utf8').trim();

appendFileSync(
  process.env.GITHUB_STEP_SUMMARY,
  `## Coverage of the UTC leg\n\n\`\`\`text\n${summary}\n\`\`\`\n`,
);
