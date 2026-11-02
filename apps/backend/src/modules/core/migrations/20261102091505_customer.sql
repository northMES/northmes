-- migration: expand
-- A customer is a register of the company: every plant of the company reads it (story E06-S07). It
-- holds the customer number and name only, and no organisation number, address or phone number.
create table core.customer (
  id uuid primary key default uuidv7(),
  -- The company's node, where every customer of the company sits, as an article group does.
  scope_id uuid not null,
  company_id uuid not null,
  version integer not null default 1,
  code text not null
    constraint customer_code_check check (code = btrim(code) and length(code) between 1 and 32),
  code_key text generated always as (lower(code)) stored,
  name text not null
    constraint customer_name_check check (name = btrim(name) and length(name) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The row sits at its company's node: scope_id is the company's id, and core.company holds
  -- company nodes only, so a plant's node is refused.
  constraint customer_company_check check (scope_id = company_id),
  constraint customer_company_fkey foreign key (company_id) references core.company (id)
);

-- A customer number is unique within the company and compares without case. A register that sits
-- only at the company has no plant rows to clash with, so a unique index per company holds the
-- rule that ADR 0009's exclusion constraint holds for a register at the company and its plants.
-- toDomainError maps a violation of an index whose name ends in _code_key to core.code_taken.
create unique index customer_code_key on core.customer (company_id, code_key);
-- The default order of coreCustomers, by number with id as the tie-breaker (ADR 0016).
create index customer_scope_code_idx on core.customer (scope_id, code, id);

-- Every update bumps version and moves updated_at on, also one that plain SQL makes (ADR 0006).
create function core.customer_touch() returns trigger
  language plpgsql
as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;
create trigger touch before update on core.customer
  for each row execute function core.customer_touch();

alter table core.customer enable row level security;
create policy scope_select on core.customer for select to nm_app
  using (scope_id = any ((select nullif(current_setting('northmes.read_scopes', true), ''))::uuid[]));
create policy scope_insert on core.customer for insert to nm_app
  with check (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));
create policy scope_update on core.customer for update to nm_app
  using      (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]))
  with check (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));
create policy scope_delete on core.customer for delete to nm_app
  using (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));

grant select, insert, update, delete on core.customer to nm_app;
