-- migration: contract
-- Every article belongs to its company and is assigned to plants (ADR 0073): core.article moves
-- to the company's node, core.article_plant lists the plants an article is assigned to, and
-- all_plants assigns it to every plant of the company, those created later included. An
-- article's edit scope is the one plant it is assigned to, or the company otherwise; a writer at
-- that scope may change it.

-- Each article moves to its company's node and keeps the plant it lived at as its one plant. Its
-- code becomes unique within the company, so the move stops while two plants of one company use
-- the same code, or while an article lives at a scope that is not a plant.
do $$
declare
  stray bigint;
  clashes text;
begin
  select count(*) into stray
    from core.article a
   where not exists (select 1 from core.scope s where s.id = a.scope_id and s.kind = 'plant');
  if stray > 0 then
    raise exception 'core.article holds % article(s) at a scope that is not a plant, so they cannot move to a company. Remove them or move them to a plant, then run northmes migrate again.', stray;
  end if;

  select string_agg(format('%s (company %s)', code_key, company_id), ', ' order by code_key)
    into clashes
    from (
      select a.code_key, s.company_id
        from core.article a
        join core.scope s on s.id = a.scope_id
       group by a.code_key, s.company_id
      having count(*) > 1
    ) as clash;
  if clashes is not null then
    raise exception 'Two or more plants of one company use the article codes %. An article code becomes unique within the company, so rename all but one article of each code, then run northmes migrate again.', clashes;
  end if;
end;
$$;

alter table core.article
  add column company_id uuid,
  add column scope_span int8range,
  add column all_plants boolean not null default false,
  add column edit_scope_id uuid;

-- The move is no change to an article, so it keeps its version and its last change.
alter table core.article disable trigger bump_version, disable trigger touch_updated_at;
update core.article a
   set company_id = s.company_id,
       edit_scope_id = a.scope_id,
       scope_id = s.company_id,
       scope_span = c.span
  from core.scope s
  join core.scope c on c.id = s.company_id
 where s.id = a.scope_id;
alter table core.article enable trigger bump_version, enable trigger touch_updated_at;

-- An article sits at its company's node with the company's span, so ADR 0009's rule makes its
-- code unique within the company. Every article has the same unbounded span, so a unique index on
-- (company_id, code_key) gives that rule until btree_gist arrives for the exclusion constraint.
-- toDomainError maps a violation of an index whose name ends in _code_key to core.code_taken.
alter table core.article
  alter column company_id set not null,
  alter column scope_span set not null,
  alter column edit_scope_id set not null,
  add constraint article_company_check check (scope_id = company_id),
  add constraint article_scope_fkey foreign key (scope_id, company_id, scope_span)
    references core.scope (id, company_id, span) on update cascade,
  add constraint article_edit_scope_fkey foreign key (edit_scope_id, company_id)
    references core.scope (id, company_id),
  add constraint article_id_scope_key unique (id, scope_id, edit_scope_id);
drop index core.article_code_key;
create unique index article_code_key on core.article (company_id, code_key);
create index article_edit_scope_id_idx on core.article (edit_scope_id);

-- A writer at the company writes every article of it, and a writer at a plant the articles whose
-- edit scope is that plant (ADR 0073, changes to ADR 0008). Reads stay on scope_id, the company,
-- which every request of the company reads.
drop policy scope_insert on core.article;
drop policy scope_update on core.article;
drop policy scope_delete on core.article;
create policy scope_insert on core.article for insert to nm_app
  with check (
    scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[])
    or edit_scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[])
  );
create policy scope_update on core.article for update to nm_app
  using (
    scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[])
    or edit_scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[])
  )
  with check (
    scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[])
    or edit_scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[])
  );
create policy scope_delete on core.article for delete to nm_app
  using (
    scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[])
    or edit_scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[])
  );

-- A plant an article is assigned to. The article's scope and edit scope ride along, kept in step
-- by the composite foreign key, so the policies judge an assignment as they judge its article
-- (ADR 0008). The plant is of the article's company.
alter table core.plant add constraint plant_id_company_id_key unique (id, company_id);

create table core.article_plant (
  article_id uuid not null,
  plant_id uuid not null,
  scope_id uuid not null,
  edit_scope_id uuid not null,
  primary key (article_id, plant_id),
  foreign key (article_id, scope_id, edit_scope_id)
    references core.article (id, scope_id, edit_scope_id) on update cascade on delete cascade,
  foreign key (plant_id, scope_id) references core.plant (id, company_id) on delete restrict
);
create index article_plant_plant_id_idx on core.article_plant (plant_id);

insert into core.article_plant (article_id, plant_id, scope_id, edit_scope_id)
  select id, edit_scope_id, scope_id, edit_scope_id from core.article;

-- Assignments are replaced, never changed, so nm_app gets no UPDATE and the table no update
-- policy.
alter table core.article_plant enable row level security;
create policy scope_select on core.article_plant for select to nm_app
  using (scope_id = any ((select nullif(current_setting('northmes.read_scopes', true), ''))::uuid[]));
create policy scope_insert on core.article_plant for insert to nm_app
  with check (
    scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[])
    or edit_scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[])
  );
create policy scope_delete on core.article_plant for delete to nm_app
  using (
    scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[])
    or edit_scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[])
  );

grant select, insert, delete on core.article_plant to nm_app;
