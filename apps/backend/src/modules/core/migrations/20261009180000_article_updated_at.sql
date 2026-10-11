-- migration: expand
-- updated_at holds when the article last changed, its creation included: the articles list sorts
-- by it, newest first, by default (design ui-222, A5). Existing articles take the time of this
-- migration. Every update moves it on, also one that plain SQL makes, as the version trigger
-- does (ADR 0006); the audit trail skips the column (ADR 0013).
alter table core.article add column updated_at timestamptz not null default now();

create function core.article_touch_updated_at() returns trigger
  language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger touch_updated_at before update on core.article
  for each row execute function core.article_touch_updated_at();

-- The default order of the articles list, by the last change with id as the tie-breaker
-- (ADR 0016).
create index article_scope_updated_at_idx on core.article (scope_id, updated_at, id);
