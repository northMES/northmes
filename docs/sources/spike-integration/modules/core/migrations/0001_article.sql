create table core.article (
  id uuid primary key default uuidv7(),
  code text not null,
  name text not null
);
-- Entity tables other modules may reference by foreign key. Granting REFERENCES is the
-- owning module's explicit decision; nm_ext holds every module and plugin owner role.
grant references (id) on core.article to nm_ext;
