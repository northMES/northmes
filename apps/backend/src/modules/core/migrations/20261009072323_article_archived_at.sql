-- migration: expand
-- An article is archived, never deleted: archived_at holds when it was archived, and null means it
-- is active (ADR 0006). Lists hide archived articles unless includeArchived asks for them
-- (ADR 0016), and an archived article keeps its code (ADR 0009).
alter table core.article add column archived_at timestamptz;
