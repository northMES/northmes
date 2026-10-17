-- migration: expand
-- The counters of the public API's rate limits (ADR 0064, ADR 0073 section 6): the Postgres
-- ThrottlerStorage, so that every backend process of an installation counts the same requests.
-- One row per key and throttler, where the key is a credential's core.credential id and the
-- throttler is reads or writes. A row counts the hits of a fixed window, and blocked_until is set
-- once the hits pass the limit. Rows hold no scope: the credential guard counts a request before
-- any transaction of the request's company runs.
create table core.rate_limit (
  key text not null,
  throttler text not null,
  hits integer not null constraint rate_limit_hits_check check (hits > 0),
  window_ends_at timestamptz not null,
  blocked_until timestamptz,
  primary key (key, throttler)
);
create index rate_limit_window_ends_at_idx on core.rate_limit (window_ends_at);

-- Row-level security is on with no policy and no grant, as for core.event_sequencer: nm_app
-- reaches the rows only through the two functions below, which run as core's owner role, which
-- the policies do not bind (ADR 0008), with a pinned search_path. They are on the definer
-- allowlist.
alter table core.rate_limit enable row level security;

-- Counts one hit of the key for the throttler and returns the row: the hits of the window, its
-- end, and the end of the block, or null while the key is not blocked. A hit after the window's
-- end starts a new window of p_ttl_ms, and a hit past p_limit blocks the key for p_block_ms. The
-- insert takes the row's lock, so hits from several processes count once each.
create function core.rate_limit_hit(
  p_key text,
  p_throttler text,
  p_ttl_ms integer,
  p_limit integer,
  p_block_ms integer
)
  returns table (total_hits integer, window_ends_at timestamptz, blocked_until timestamptz)
  language plpgsql volatile security definer
  set search_path = pg_catalog, pg_temp
as $$
#variable_conflict use_column
declare
  v_now timestamptz := clock_timestamp();
  v_hits integer;
  v_window_ends_at timestamptz;
  v_blocked_until timestamptz;
begin
  insert into core.rate_limit as r (key, throttler, hits, window_ends_at)
  values (p_key, p_throttler, 1, v_now + p_ttl_ms * interval '1 millisecond')
  on conflict (key, throttler) do update
    set hits = case when r.window_ends_at <= v_now then 1 else r.hits + 1 end,
        window_ends_at = case when r.window_ends_at <= v_now then excluded.window_ends_at
                              else r.window_ends_at end,
        blocked_until = case when r.blocked_until > v_now then r.blocked_until end
  returning r.hits, r.window_ends_at, r.blocked_until
    into v_hits, v_window_ends_at, v_blocked_until;
  if v_hits > p_limit and v_blocked_until is null then
    v_blocked_until := v_now + p_block_ms * interval '1 millisecond';
    update core.rate_limit r set blocked_until = v_blocked_until
     where r.key = p_key and r.throttler = p_throttler;
  end if;
  return query select v_hits, v_window_ends_at, v_blocked_until;
end;
$$;

-- Deletes the rows whose window and block have both ended, and returns how many it deleted. Each
-- backend process calls it at most once a minute.
create function core.rate_limit_prune()
  returns integer
  language sql volatile security definer
  set search_path = pg_catalog, pg_temp
as $$
  with pruned as (
    delete from core.rate_limit r
     where r.window_ends_at <= clock_timestamp()
       and (r.blocked_until is null or r.blocked_until <= clock_timestamp())
    returning 1
  )
  select count(*)::integer from pruned
$$;

revoke all on function core.rate_limit_hit(text, text, integer, integer, integer),
  core.rate_limit_prune() from public;
grant execute on function core.rate_limit_hit(text, text, integer, integer, integer),
  core.rate_limit_prune() to nm_app;
