-- StoryForge cloud schema. Run once in the Supabase SQL editor.
-- Every table mirrors a local IndexedDB table as a JSON document owned by one user.

create table if not exists public.works      (id text primary key, user_id uuid not null references auth.users(id) on delete cascade, data jsonb not null, updated_at bigint not null);
create table if not exists public.docs       (id text primary key, user_id uuid not null references auth.users(id) on delete cascade, data jsonb not null, updated_at bigint not null);
create table if not exists public.entities   (id text primary key, user_id uuid not null references auth.users(id) on delete cascade, data jsonb not null, updated_at bigint not null);
create table if not exists public.snapshots  (id text primary key, user_id uuid not null references auth.users(id) on delete cascade, data jsonb not null, updated_at bigint not null);
create table if not exists public.sprints    (id text primary key, user_id uuid not null references auth.users(id) on delete cascade, data jsonb not null, updated_at bigint not null);
create table if not exists public.tombstones (id text primary key, user_id uuid not null references auth.users(id) on delete cascade, data jsonb not null, updated_at bigint not null);
create table if not exists public.profiles   (user_id uuid primary key references auth.users(id) on delete cascade, data jsonb not null, updated_at bigint not null);

create index if not exists works_user_updated      on public.works      (user_id, updated_at);
create index if not exists docs_user_updated       on public.docs       (user_id, updated_at);
create index if not exists entities_user_updated   on public.entities   (user_id, updated_at);
create index if not exists snapshots_user_updated  on public.snapshots  (user_id, updated_at);
create index if not exists sprints_user_updated    on public.sprints    (user_id, updated_at);
create index if not exists tombstones_user_updated on public.tombstones (user_id, updated_at);

alter table public.works      enable row level security;
alter table public.docs       enable row level security;
alter table public.entities   enable row level security;
alter table public.snapshots  enable row level security;
alter table public.sprints    enable row level security;
alter table public.tombstones enable row level security;
alter table public.profiles   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['works','docs','entities','snapshots','sprints','tombstones','profiles'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
