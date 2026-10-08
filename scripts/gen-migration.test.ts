import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { main, render } from './gen-migration.mjs';

// 21:04:05 at UTC+2 is 19:04:05 UTC.
const now = new Date('2026-10-08T21:04:05+02:00');

describe('gen:migration', () => {
  it('E02-S02 the generated file has FOR SELECT, FOR INSERT, FOR UPDATE and FOR DELETE policies and no FOR ALL', () => {
    const { sql } = render({ module: 'production-start', slug: 'work_note', now });

    expect(sql).toMatch(
      /create policy scope_select on production_start\.work_note for select to nm_app\s+using \(scope_id = any \(\(select nullif\(current_setting\('northmes\.read_scopes', true\), ''\)\)::uuid\[\]\)\);/,
    );
    expect(sql).toMatch(
      /create policy scope_insert on production_start\.work_note for insert to nm_app\s+with check \(scope_id = any \(\(select nullif\(current_setting\('northmes\.write_scopes', true\), ''\)\)::uuid\[\]\)\);/,
    );
    expect(sql).toMatch(
      /create policy scope_update on production_start\.work_note for update to nm_app\s+using\s+\(scope_id = any \(\(select nullif\(current_setting\('northmes\.write_scopes', true\), ''\)\)::uuid\[\]\)\)\s+with check \(scope_id = any \(\(select nullif\(current_setting\('northmes\.write_scopes', true\), ''\)\)::uuid\[\]\)\);/,
    );
    expect(sql).toMatch(
      /create policy scope_delete on production_start\.work_note for delete to nm_app\s+using \(scope_id = any \(\(select nullif\(current_setting\('northmes\.write_scopes', true\), ''\)\)::uuid\[\]\)\);/,
    );
    expect(sql).not.toMatch(/\bfor\s+all\b/i);
  });

  it("E02-S02 the file is named with the UTC timestamp and the slug in the module's migrations folder", () => {
    const { path } = render({ module: 'production-start', slug: 'work_note', now });

    expect(path).toBe('modules/production-start/migrations/20261008190405_work_note.sql');
  });
});

describe('pnpm gen:migration', () => {
  let root: string;
  const lines: string[] = [];
  const errors: string[] = [];
  const io = () => ({
    log: (line: string) => lines.push(line),
    error: (line: string) => errors.push(line),
    root,
    now: () => now,
  });

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gen-migration-'));
    mkdirSync(join(root, 'modules/production-start'), { recursive: true });
    lines.length = 0;
    errors.length = 0;
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("E02-S02 pnpm gen:migration writes the rendered file into the module's migrations folder", async () => {
    const exitCode = await main(['production-start', 'work_note'], io());

    const path = 'modules/production-start/migrations/20261008190405_work_note.sql';
    expect(exitCode).toBe(0);
    expect(readFileSync(join(root, path), 'utf8')).toBe(
      render({ module: 'production-start', slug: 'work_note', now }).sql,
    );
    expect(lines).toEqual([`Wrote ${path}`]);
    expect(errors).toEqual([]);
  });

  it("E02-S02 pnpm gen:migration without both arguments or without the module's folder exits 1 and writes nothing", async () => {
    const exitCodes = [
      await main(['production-start'], io()),
      await main(['production-stat', 'work_note'], io()),
    ];

    expect(exitCodes).toEqual([1, 1]);
    expect(errors).toEqual([
      'Usage: pnpm gen:migration <module> <slug>',
      'No module folder modules/production-stat',
    ]);
    expect(readdirSync(join(root, 'modules'))).toEqual(['production-start']);
    expect(readdirSync(join(root, 'modules/production-start'))).toEqual([]);
    expect(lines).toEqual([]);
  });
});
