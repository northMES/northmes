-- migration: contract
-- /shared/ serves the files that plugin screens import through the web's import map (ADR 0075),
-- so shared joins the first path segments a plant slug may not be. not valid first, so the check
-- holds for new rows at once and validate reads the existing rows without blocking writes.
alter table core.plant drop constraint plant_slug_check;
alter table core.plant add constraint plant_slug_check
  check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and length(slug) <= 40
    and slug not in (
      'api', 'graphql', 'mcp', 'health', 'modules', 'assets', 'shared', 'station', 'settings',
      'admin', 'sign-in'
    )
  ) not valid;
alter table core.plant validate constraint plant_slug_check;
