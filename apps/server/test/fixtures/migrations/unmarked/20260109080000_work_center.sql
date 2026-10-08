-- migration: expand
create table planning.work_center (
  id uuid primary key default uuidv7()
);
