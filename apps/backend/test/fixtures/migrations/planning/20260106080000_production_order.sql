-- migration: expand
create table planning.production_order (
  id uuid primary key default uuidv7(),
  number text not null
);
