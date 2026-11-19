-- Rode no Supabase: SQL Editor → New query → Run.
create table if not exists public.entries (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  home         jsonb not null,
  work         jsonb,
  semester     int  not null check (semester between 1 and 10),
  mode         text not null check (mode in ('pe','bike','onibus','integrado','carro','app')),
  intern_hours int  not null check (intern_hours in (0,20,25,30)),
  real_min     int  check (real_min between 1 and 360),
  dist_km      numeric not null check (dist_km > 0 and dist_km < 200),
  legs         jsonb not null,
  check (jsonb_typeof(home) = 'array' and jsonb_array_length(home) = 2),
  check (work is null or (jsonb_typeof(work) = 'array' and jsonb_array_length(work) = 2)),
  check (jsonb_typeof(legs) = 'array' and jsonb_array_length(legs) between 1 and 2),
  check (work is not null or intern_hours = 0),
  check (pg_column_size(legs) < 200000)
);

alter table public.entries enable row level security;

-- Qualquer visitante pode ler e inserir; ninguém pode alterar ou apagar pelo site.
create policy "leitura publica" on public.entries for select to anon using (true);
create policy "insercao publica" on public.entries for insert to anon with check (true);

grant usage on schema public to anon;
grant select, insert on public.entries to anon;
