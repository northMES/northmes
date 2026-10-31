-- migration: expand
-- A register of any module points at its scope node and that node's span through a composite
-- foreign key with on update cascade (ADR 0009), which the register template writes. A module's
-- owner role uses the REFERENCES grants of nm_ext (ADR 0006). A scope node is never deleted while
-- a row sits at it, so a key into core.scope takes the default on delete no action.
grant references (id, company_id, span) on core.scope to nm_ext;
