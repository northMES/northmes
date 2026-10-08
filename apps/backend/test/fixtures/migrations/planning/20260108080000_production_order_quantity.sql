-- migration: expand
alter table planning.production_order add column quantity numeric(18, 6);
