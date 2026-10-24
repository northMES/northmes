// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { root } from './docs.ts';

/** The part of skills-lock.json that the skills check reads: the pinned skills by name. */
interface SkillsLock {
  readonly skills: Readonly<Record<string, unknown>>;
}

/**
 * The project skills in .claude/skills. Each is NorthMES's own file, so it gets no skills-lock.json
 * entry and no section in THIRD_PARTY_LICENSE.md, which pin and license third-party skills only.
 */
const projectSkills: readonly string[] = ['db-test', 'vertical-slice', 'web-module', 'dst-test'];

/**
 * The skills check (ADR 0063): every folder in .claude/skills is a skill that skills-lock.json
 * pins or a project skill, and every pinned skill has a folder. Returns one problem per folder or
 * pinned skill that breaks the rule.
 */
function skillsCheck(folders: readonly string[], lock: SkillsLock): string[] {
  const pinned = Object.keys(lock.skills);
  const unlisted = folders
    .filter((folder) => !pinned.includes(folder) && !projectSkills.includes(folder))
    .map(
      (folder) => `.claude/skills/${folder} is not in skills-lock.json and is not a project skill`,
    );
  const missing = pinned
    .filter((skill) => !folders.includes(skill))
    .map((skill) => `skills-lock.json pins ${skill}, which has no folder in .claude/skills`);
  return [...unlisted, ...missing];
}

/** The folders of .claude/skills, without THIRD_PARTY_LICENSE.md and other files. */
function skillFolders(): string[] {
  return readdirSync(join(root, '.claude/skills'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function skillsLock(): SkillsLock {
  return JSON.parse(readFileSync(join(root, 'skills-lock.json'), 'utf8')) as SkillsLock;
}

describe('agent skills', () => {
  it('E02-S02 .claude/skills holds the skills that skills-lock.json pins and the project skills', () => {
    expect(skillsCheck(skillFolders(), skillsLock())).toEqual([]);
  });

  it('E02-S02 a .claude/skills folder that skills-lock.json does not list fails unless it is a project skill', () => {
    const lock = { skills: { tdd: {}, vitest: {} } };

    const problems = skillsCheck(['db-test', 'stray-skill', 'tdd', 'vitest'], lock);

    expect(problems).toEqual([
      '.claude/skills/stray-skill is not in skills-lock.json and is not a project skill',
    ]);
  });
});

describe('operating session run checklist', () => {
  it("ADR0079 step 7 compares the design artifact's current version with the approved version id", () => {
    const readme = readFileSync(join(root, 'docs/agents/handoff/README.md'), 'utf8');
    const step = readme.split('\n').find((line) => line.startsWith('7. ')) ?? '';

    expect(step).toContain('design artifact');
    expect(step).toContain('compares its current version with the approved version id');
  });
});

/** The frontmatter of a Claude Code agent file: the part between the first two --- lines. */
interface AgentFrontmatter {
  readonly name?: string;
  readonly tools?: string | readonly string[];
  readonly mcpServers?: readonly (string | Record<string, { readonly url?: string }>)[];
  readonly hooks?: {
    readonly PreToolUse?: readonly {
      readonly matcher?: string;
      readonly hooks?: readonly {
        readonly type?: string;
        readonly command?: string;
        readonly onFailure?: string;
      }[];
    }[];
  };
}

function agentFrontmatter(path: string): AgentFrontmatter {
  const [, frontmatter = ''] = readFileSync(join(root, path), 'utf8').split(/^---$/m);
  return parse(frontmatter) as AgentFrontmatter;
}

function toolList(tools: AgentFrontmatter['tools']): string[] {
  if (tools === undefined) return [];
  return typeof tools === 'string' ? tools.split(',').map((tool) => tool.trim()) : [...tools];
}

// The review before the pull request (CLAUDE.md, ADR 0065) runs as a project subagent, so every
// session starts the same reviewer. It checks library behaviour against current docs through
// Context7, declared in the agent file so it works without a user-level Context7 setup, and it
// reports findings without editing the branch.
describe('code-reviewer agent', () => {
  const path = '.claude/agents/code-reviewer.md';

  it('ADR0065 the code-reviewer agent has Context7 and no file-edit tools', () => {
    const agent = agentFrontmatter(path);
    const tools = toolList(agent.tools);

    expect(agent.name).toBe('code-reviewer');
    expect(tools).toEqual(
      expect.arrayContaining(['mcp__context7__resolve-library-id', 'mcp__context7__query-docs']),
    );
    for (const editTool of ['Edit', 'Write', 'NotebookEdit']) {
      expect(tools).not.toContain(editTool);
    }
    expect(agent.mcpServers).toContainEqual({
      context7: expect.objectContaining({ url: 'https://mcp.context7.com/mcp' }),
    });
  });

  // Bash can write, so a hook refuses every Bash command that is not a read (ADR 0065).
  it('ADR0065 the code-reviewer agent runs its Bash commands through the read-only guard', () => {
    const agent = agentFrontmatter(path);

    expect(agent.hooks?.PreToolUse).toContainEqual({
      matcher: 'Bash',
      hooks: [
        {
          type: 'command',
          command: 'node "$CLAUDE_PROJECT_DIR"/scripts/agents/review-bash-guard.mjs',
          onFailure: 'block',
        },
      ],
    });
  });

  it('ADR0065 CLAUDE.md sends the review before the pull request to the code-reviewer agent', () => {
    const claude = readFileSync(join(root, 'CLAUDE.md'), 'utf8');

    expect(claude).toContain('`code-reviewer` subagent');
  });

  // CodeRabbit's path instructions are the one source of the rules both reviews apply, so the
  // agent reads them from .coderabbit.yaml and a rule changes in one place.
  it('ADR0065 the code-reviewer agent applies the path instructions of .coderabbit.yaml and copies none of them', () => {
    const body = agentBody(path);
    const config = parse(readFileSync(join(root, '.coderabbit.yaml'), 'utf8')) as CodeRabbitConfig;
    const instructions = config.reviews.path_instructions.map((entry) => entry.instructions);

    expect(body).toContain('`reviews.path_instructions` in `.coderabbit.yaml`');
    expect(instructions.length).toBeGreaterThan(0);
    expect(sharedWordRuns(body, instructions)).toEqual([]);
  });

  // A branch that changes .coderabbit.yaml would otherwise choose the rules its own review applies.
  it('ADR0065 the code-reviewer agent reads the path instructions from main when the branch changes them', () => {
    expect(agentBody(path)).toContain('`git show origin/main:.coderabbit.yaml`');
  });

  it('ADR0065 the copy check finds an instruction pasted into the agent with other spacing and backticks', () => {
    const instruction = 'Flag sql.raw, sql.lit, and sql.ref or sql.id with non-literal input.';
    const body = 'Steps.\n\n- Flag `sql.raw`, `sql.lit`, and `sql.ref` or `sql.id`\n  with non-literal input.';

    expect(sharedWordRuns(body, [instruction])).toEqual([
      'flag sql.raw, sql.lit, and sql.ref or sql.id with',
    ]);
  });

  // At level high the code-review skill keeps 10 findings and cuts the minor ones first.
  it('ADR0065 the code-reviewer agent keeps every finding of the code-review skill', () => {
    expect(agentBody(path)).toContain('code-review skill at level high with `--max-findings all`');
  });
});

/** The part of .coderabbit.yaml that the code-reviewer agent reads. */
interface CodeRabbitConfig {
  readonly reviews: {
    readonly path_instructions: readonly { readonly path: string; readonly instructions: string }[];
  };
}

/** Words in lower case with backticks and list markers dropped, so formatting hides no copy. */
function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .replaceAll('`', '')
    .split(/\s+/)
    .filter((word) => word !== '' && word !== '-');
}

/**
 * Each run of eight words that the agent's body shares with one of the instructions, the first
 * run of each instruction only.
 */
function sharedWordRuns(body: string, instructions: readonly string[]): string[] {
  const length = 8;
  const bodyWords = ` ${wordsOf(body).join(' ')} `;
  return instructions.flatMap((instruction) => {
    const words = wordsOf(instruction);
    const runs = words
      .slice(0, Math.max(0, words.length - length + 1))
      .map((_, start) => words.slice(start, start + length).join(' '));
    const shared = runs.find((run) => bodyWords.includes(` ${run} `));
    return shared === undefined ? [] : [shared];
  });
}

/** The instructions of a Claude Code agent file: everything after its frontmatter. */
function agentBody(path: string): string {
  return readFileSync(join(root, path), 'utf8').split(/^---$/m).slice(2).join('---');
}

// The blast-radius review before the pull request (ADR 0086) runs as a project subagent in a fresh
// context, like the code review. It judges how much harm a wrong merge would do and ends with the
// Tier line that CI / risk gate reads, and it edits nothing.
describe('blast-radius agent', () => {
  const path = '.claude/agents/blast-radius.md';

  it('ADR0086 the blast-radius agent has no file-edit tools and runs its Bash commands through the read-only guard', () => {
    const agent = agentFrontmatter(path);
    const tools = toolList(agent.tools);

    expect(agent.name).toBe('blast-radius');
    for (const editTool of ['Edit', 'Write', 'NotebookEdit']) {
      expect(tools).not.toContain(editTool);
    }
    expect(agent.hooks?.PreToolUse).toContainEqual({
      matcher: 'Bash',
      hooks: [
        {
          type: 'command',
          command: 'node "$CLAUDE_PROJECT_DIR"/scripts/agents/review-bash-guard.mjs',
          onFailure: 'block',
        },
      ],
    });
  });

  it('ADR0086 the blast-radius agent ends its section with the Tier line that the risk gate reads', () => {
    const text = readFileSync(join(root, path), 'utf8');

    expect(text).toContain('`Tier: low`');
    expect(text).toContain('`Tier: high`');
  });

  it('ADR0086 CLAUDE.md sends the blast-radius review before the pull request to the blast-radius agent', () => {
    const claude = readFileSync(join(root, 'CLAUDE.md'), 'utf8');

    expect(claude).toContain('`blast-radius` subagent');
  });
});
