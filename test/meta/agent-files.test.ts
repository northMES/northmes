// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
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
