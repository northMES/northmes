// SPDX-License-Identifier: AGPL-3.0-or-later
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { root } from './docs.ts';

/** The part of skills-lock.json that the skills check reads: the pinned skills by name. */
interface SkillsLock {
  readonly skills: Readonly<Record<string, unknown>>;
}

/**
 * The skills check (ADR 0063): every folder in .claude/skills is a skill that skills-lock.json
 * pins, and every pinned skill has a folder. Returns one problem per folder or pinned skill that
 * breaks the rule.
 */
function skillsCheck(folders: readonly string[], lock: SkillsLock): string[] {
  const pinned = Object.keys(lock.skills);
  const unlisted = folders
    .filter((folder) => !pinned.includes(folder))
    .map((folder) => `.claude/skills/${folder} is not in skills-lock.json`);
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
