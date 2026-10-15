-- migration: expand
-- The outbox and the event log (ADR 0014). A command writes its events here in its own
-- transaction, so an event exists exactly when its command commits. position stays null until
-- core.sequence_events publishes the event; it is the cursor every reader pages by, since seq and
-- the uuidv7 id follow insertion order, not commit order.
create table core.event (
  seq bigint generated always as identity,
  id uuid primary key,
  event text not null,
  schema_version integer not null default 1,
  entity_type text not null,
  entity_id uuid not null,
  -- The entity's version after the change, which the command reads under its row lock.
  entity_version bigint not null,
  -- The company or plant node the entity sits at, which readers filter by.
  scope_id uuid not null,
  data jsonb not null,
  -- Who and what wrote the event: the acting user and the command's name.
  context jsonb not null,
  created_at timestamptz not null default now(),
  position bigint
);
create unique index event_position_uq on core.event (position) where position is not null;
create index event_outbox_idx on core.event (seq) where position is null;

-- The last position the sequencer gave out. One row.
create table core.event_sequencer (
  id boolean primary key default true check (id),
  last_position bigint not null
);
insert into core.event_sequencer (last_position) values (0);

-- A command writes events in its write scopes and a reader reads those of its read scopes
-- (ADR 0008). nm_app never sets a position: only core.sequence_events does.
alter table core.event enable row level security;
create policy scope_select on core.event for select to nm_app
  using (scope_id = any ((select nullif(current_setting('northmes.read_scopes', true), ''))::uuid[]));
create policy scope_insert on core.event for insert to nm_app
  with check (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));
grant select on core.event to nm_app;
grant insert (id, event, schema_version, entity_type, entity_id, entity_version, scope_id, data,
  context) on core.event to nm_app;

-- Only the sequencer reads and changes this table, so it has no policy and no grant.
alter table core.event_sequencer enable row level security;

-- Publishes up to p_limit events that have no position yet, in insertion order, and returns the
-- last position given out. An event whose transaction commits after a later one has published
-- gets a higher position in a later batch, so a reader paging by position never skips it. One
-- sequencer runs at a time: a second call while one holds the transaction-level advisory lock
-- returns null and changes nothing. It runs as core's owner role, which the policies do not bind,
-- so it publishes the events of every scope; it is on the definer allowlist.
create function core.sequence_events(p_limit integer)
  returns bigint
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
as $$
declare
  v_last bigint;
  v_published bigint;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('core.sequence_events', 0)) then
    return null;
  end if;
  select last_position into v_last from core.event_sequencer for update;
  with batch as (
    select seq, v_last + row_number() over (order by seq) as next_position
      from (select seq from core.event where position is null order by seq limit p_limit) waiting
  )
  update core.event e set position = b.next_position from batch b where e.seq = b.seq;
  get diagnostics v_published = row_count;
  if v_published > 0 then
    v_last := v_last + v_published;
    update core.event_sequencer set last_position = v_last;
  end if;
  return v_last;
end;
$$;

revoke all on function core.sequence_events(integer) from public;
grant execute on function core.sequence_events(integer) to nm_app;
