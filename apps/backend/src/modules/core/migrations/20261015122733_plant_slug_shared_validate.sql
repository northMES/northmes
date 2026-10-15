-- migration: contract
-- Validates the plant slug check that the previous file added as not valid, in its own transaction,
-- so the scan holds only the lock that validate takes and reads and writes go on.
alter table core.plant validate constraint plant_slug_check;
