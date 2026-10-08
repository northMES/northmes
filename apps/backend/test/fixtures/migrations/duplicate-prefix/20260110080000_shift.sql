-- migration: expand
create table planning.shift (
  id uuid primary key default uuidv7()
);
