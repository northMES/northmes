create table core.article (
  id uuid primary key default uuidv7(),
  code text not null
);
