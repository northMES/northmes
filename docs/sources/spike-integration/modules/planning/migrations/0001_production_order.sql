create table planning.production_order (
  id uuid primary key default uuidv7(),
  number text not null,
  article_id uuid not null references core.article (id),
  quantity numeric(18, 6) not null,
  status text not null default 'PLANNED' check (status in ('PLANNED', 'RELEASED')),
  version integer not null default 1
);
grant references (id) on planning.production_order to nm_ext;
