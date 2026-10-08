import { describe, expect, it } from 'vitest';
import { render } from './gen-migration.mjs';

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
});
