create table example_validator.rejection (
  id uuid primary key default uuidv7(),
  production_order_id uuid not null references planning.production_order (id),
  reason text not null,
  created_at timestamptz not null default now()
);
