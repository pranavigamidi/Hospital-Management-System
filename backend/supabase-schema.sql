create table if not exists public.hospital_demo_state (
  id text primary key check (id = 'default'),
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.hospital_demo_state enable row level security;
