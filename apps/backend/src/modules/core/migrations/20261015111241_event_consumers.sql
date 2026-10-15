-- migration: expand
-- Event consumers (ADR 0014). core.publish_events gives the waiting events their positions, as
-- core.sequence_events did, and returns them, so the sequencer queues one job per consumer of each
-- event in the same transaction. core.inbox records each event a consumer has handled, in the
-- consumer's transaction, so a job delivered twice changes nothing the second time.
create table core.inbox (
  consumer text not null,
  event_id uuid not null,
  -- The event's scope, where the consumer's transaction reads and writes.
  scope_id uuid not null,
  processed_at timestamptz not null default now(),
  primary key (consumer, event_id)
);

-- A consumer's transaction runs at its event's scope (ADR 0008).
alter table core.inbox enable row level security;
create policy scope_select on core.inbox for select to nm_app
  using (scope_id = any ((select nullif(current_setting('northmes.read_scopes', true), ''))::uuid[]));
create policy scope_insert on core.inbox for insert to nm_app
  with check (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));
grant select, insert on core.inbox to nm_app;

-- Publishes up to p_limit events that have no position yet, in insertion order, and returns them
-- with their positions. An event whose transaction commits after a later one has published gets a
-- higher position in a later batch, so a reader paging by position never skips it. One sequencer
-- runs at a time: a second call while one holds the transaction-level advisory lock returns no
-- rows and changes nothing. It runs as core's owner role, which the policies do not bind, so it
-- publishes the events of every scope; it is on the definer allowlist.
create function core.publish_events(p_limit integer)
  returns table (
    id uuid,
    event text,
    schema_version integer,
    entity_type text,
    entity_id uuid,
    entity_version bigint,
    scope_id uuid,
    data jsonb,
    "position" bigint
  )
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
as $$
declare
  v_last bigint;
  v_published bigint;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('core.publish_events', 0)) then
    return;
  end if;
  select s.last_position into v_last from core.event_sequencer s for update;
  return query
    with batch as (
      select w.seq, v_last + row_number() over (order by w.seq) as next_position
        from (select e.seq from core.event e where e.position is null order by e.seq limit p_limit) w
    )
    update core.event e set position = b.next_position from batch b where e.seq = b.seq
    returning e.id, e.event, e.schema_version, e.entity_type, e.entity_id, e.entity_version,
              e.scope_id, e.data, e.position;
  get diagnostics v_published = row_count;
  if v_published > 0 then
    update core.event_sequencer set last_position = v_last + v_published;
  end if;
end;
$$;

revoke all on function core.publish_events(integer) from public;
grant execute on function core.publish_events(integer) to nm_app;
