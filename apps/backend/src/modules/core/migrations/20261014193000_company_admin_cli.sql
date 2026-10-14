-- migration: expand
-- The CLI's company commands (ADR 0066, ADR 0072): northmes company create writes a company node
-- and its core.company row as nm_app, as the server makes every write, so the grants and the
-- policies apply to it as in the app; the trigger on core.company then writes the company's default
-- roles under the policies of core.role. Neither table carries policies (20261009091022_plant.sql).
-- No GraphQL field or HTTP path creates a company: only core's AdministrationService, which the
-- CLI calls, inserts into them.
grant insert on core.scope, core.company to nm_app;
