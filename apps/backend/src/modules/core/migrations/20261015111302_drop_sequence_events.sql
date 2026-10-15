-- migration: contract
-- core.publish_events replaces core.sequence_events, which returned only the last position.
drop function core.sequence_events(integer);
