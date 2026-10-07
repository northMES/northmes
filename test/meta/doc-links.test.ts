import { describe, expect, it } from 'vitest';

interface MarkdownFile {
  path: string;
  content: string;
}

function doc(path: string, ...lines: string[]): MarkdownFile {
  return { path, content: `${lines.join('\n')}\n` };
}

describe('doc links', () => {
  // The tracked files that the invented documents below may link to.
  const tracked = new Set([
    'GLOSSARY.md',
    'docs/adr/0001-record-decisions.md',
    'docs/plan/README.md',
    'docs/plan/14-roadmap.md',
    'docs/agents/handoff/README.md',
  ]);

  it('every relative link in docs/plan, docs/adr, docs/agents and GLOSSARY.md resolves', () => {
    const resolving = doc(
      'docs/plan/README.md',
      'Terms follow [the glossary](../../GLOSSARY.md) and [ADR 1][adr-1].',
      'The [roadmap](14-roadmap.md#milestones "Milestones") and [its query](14-roadmap.md?x=1).',
      'The [handoff folder](../agents/handoff/) and [the same without a slash](../agents/handoff).',
      'An image: ![diagram](../agents/handoff/README.md).',
      'Skipped: [site](https://example.com/missing), [mail](mailto:a@example.com), [here](#top).',
      'Skipped: `[in code](missing.md)` and the fence below.',
      '',
      '```markdown',
      '[in a fence](missing.md)',
      '```',
      '',
      '[adr-1]: ../adr/0001-record-decisions.md',
    );

    expect(linkProblems([resolving], tracked)).toEqual([]);

    const dead = doc(
      'docs/plan/README.md',
      'A dead [inline link](missing.md), a [folder with no tracked file](../design/),',
      'a [link out of the repository](../../../outside.md) and [a dead reference][gone].',
      '',
      '[gone]: ../adr/0099-gone.md',
    );

    expect(linkProblems([dead], tracked)).toEqual([
      'docs/plan/README.md: "missing.md" does not resolve to a tracked file',
      'docs/plan/README.md: "../design/" does not resolve to a tracked file',
      'docs/plan/README.md: "../../../outside.md" does not resolve to a tracked file',
      'docs/plan/README.md: "../adr/0099-gone.md" does not resolve to a tracked file',
    ]);

    // A link is relative to the file that holds it, and GLOSSARY.md sits in the root.
    const fromRoot = doc('GLOSSARY.md', '[an ADR](docs/adr/0001-record-decisions.md)');
    const fromAdr = doc('docs/adr/0001-record-decisions.md', '[the plan](../plan/README.md)');
    const wrongBase = doc('docs/adr/0001-record-decisions.md', '[the plan](docs/plan/README.md)');

    expect(linkProblems([fromRoot, fromAdr], tracked)).toEqual([]);
    expect(linkProblems([wrongBase], tracked)).toEqual([
      'docs/adr/0001-record-decisions.md: "docs/plan/README.md" does not resolve to a tracked file',
    ]);

    const files = readDocFiles(trackedFiles());
    expect(files.map((file) => file.path)).toEqual(
      expect.arrayContaining(['GLOSSARY.md', 'docs/plan/README.md', 'docs/agents/domain.md']),
    );
    expect(linkProblems(files, trackedFiles())).toEqual([]);
  });
});
