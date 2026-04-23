-- Introduce canonical ownership, integration, and publish workflow tables.
create extension if not exists "uuid-ossp";

alter table public.shows
add column if not exists client_id uuid references public.clients(id) on delete set null,
add column if not exists youtube_channel_id text,
add column if not exists youtube_podcast_playlist_id text,
add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now()) not null;

update public.shows s
set client_id = c.id
from public.clients c
where s.captivate_show_id = c.captivate_show_id
  and s.client_id is null;

create index if not exists shows_client_id_idx on public.shows(client_id);

create table if not exists public.zernio_profiles (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete cascade,
  external_profile_id text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (client_id)
);

create table if not exists public.zernio_accounts (
  id uuid primary key default uuid_generate_v4(),
  zernio_profile_id uuid not null references public.zernio_profiles(id) on delete cascade,
  external_account_id text not null unique,
  platform text not null default 'youtube',
  account_name text,
  handle text,
  channel_title text,
  is_active boolean not null default true,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists zernio_accounts_profile_idx on public.zernio_accounts(zernio_profile_id);

create table if not exists public.show_publish_destinations (
  id uuid primary key default uuid_generate_v4(),
  show_id uuid not null references public.shows(id) on delete cascade,
  zernio_account_id uuid not null references public.zernio_accounts(id) on delete cascade,
  is_default boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (show_id, zernio_account_id)
);

create index if not exists show_publish_destinations_show_idx on public.show_publish_destinations(show_id);

create table if not exists public.episodes (
  id uuid primary key default uuid_generate_v4(),
  show_id uuid not null references public.shows(id) on delete cascade,
  captivate_episode_id text unique,
  title text not null,
  description text,
  media_url text,
  image_url text,
  youtube_video_id text,
  youtube_video_url text,
  published_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists episodes_show_idx on public.episodes(show_id);

create table if not exists public.episode_publish_runs (
  id uuid primary key default uuid_generate_v4(),
  episode_id uuid not null references public.episodes(id) on delete cascade,
  provider text not null check (provider in ('captivate', 'zernio', 'youtube')),
  external_entity_id text,
  status text not null default 'Processing',
  error_message text,
  request_payload jsonb,
  webhook_payload jsonb,
  requested_at timestamp with time zone default timezone('utc'::text, now()) not null,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists episode_publish_runs_episode_idx on public.episode_publish_runs(episode_id);
create index if not exists episode_publish_runs_provider_external_idx on public.episode_publish_runs(provider, external_entity_id);

insert into public.zernio_profiles (client_id, external_profile_id, metadata)
select c.id, null, jsonb_build_object('legacy_zernio_account_id', c.zernio_account_id)
from public.clients c
where c.zernio_account_id is not null
  and not exists (
    select 1
    from public.zernio_profiles zp
    where zp.client_id = c.id
  );

insert into public.zernio_accounts (
  zernio_profile_id,
  external_account_id,
  platform,
  account_name,
  channel_title,
  raw_payload
)
select
  zp.id,
  c.zernio_account_id,
  'youtube',
  c.name,
  c.name,
  jsonb_build_object('source', 'clients.zernio_account_id')
from public.clients c
join public.zernio_profiles zp on zp.client_id = c.id
where c.zernio_account_id is not null
on conflict (external_account_id) do nothing;

insert into public.show_publish_destinations (show_id, zernio_account_id, is_default, config)
select
  s.id,
  za.id,
  true,
  '{}'::jsonb
from public.clients c
join public.shows s on s.captivate_show_id = c.captivate_show_id
join public.zernio_profiles zp on zp.client_id = c.id
join public.zernio_accounts za on za.zernio_profile_id = zp.id
where c.zernio_account_id is not null
on conflict (show_id, zernio_account_id) do nothing;

insert into public.episodes (
  id,
  show_id,
  title,
  description,
  media_url,
  created_at,
  updated_at
)
select
  ef.id,
  s.id,
  ef.title,
  ef.description,
  ef.media_url,
  ef.created_at,
  ef.created_at
from public.episodes_feed ef
join public.shows s on s.captivate_show_id = ef.captivate_show_id
on conflict (id) do nothing;

insert into public.episode_publish_runs (
  episode_id,
  provider,
  external_entity_id,
  status,
  requested_at,
  completed_at,
  created_at,
  updated_at
)
select
  e.id,
  'zernio',
  ef.zernio_post_id,
  coalesce(ef.status, 'Processing'),
  ef.created_at,
  case
    when ef.status in ('Published', 'Failed', 'Partial') then ef.created_at
    else null
  end,
  ef.created_at,
  ef.created_at
from public.episodes_feed ef
join public.episodes e on e.id = ef.id
where not exists (
  select 1
  from public.episode_publish_runs epr
  where epr.episode_id = e.id
    and epr.provider = 'zernio'
);

alter table public.zernio_profiles enable row level security;
alter table public.zernio_accounts enable row level security;
alter table public.show_publish_destinations enable row level security;
alter table public.episodes enable row level security;
alter table public.episode_publish_runs enable row level security;

drop policy if exists "Clients can view their mapped show" on public.shows;
drop policy if exists "Clients can update their mapped show" on public.shows;

create policy "Clients can view their assigned shows" on public.shows
for select to authenticated
using (
  client_id in (
    select id from public.clients where email = auth.jwt() ->> 'email'
  )
);

create policy "Clients can update their assigned shows" on public.shows
for update to authenticated
using (
  client_id in (
    select id from public.clients where email = auth.jwt() ->> 'email'
  )
)
with check (
  client_id in (
    select id from public.clients where email = auth.jwt() ->> 'email'
  )
);

create policy "Admins have full access to zernio_profiles" on public.zernio_profiles
for all to authenticated
using (auth.jwt() ->> 'email' = 'podcastpartnership@gmail.com')
with check (auth.jwt() ->> 'email' = 'podcastpartnership@gmail.com');

create policy "Clients can view their zernio profile" on public.zernio_profiles
for select to authenticated
using (
  client_id in (
    select id from public.clients where email = auth.jwt() ->> 'email'
  )
);

create policy "Admins have full access to zernio_accounts" on public.zernio_accounts
for all to authenticated
using (auth.jwt() ->> 'email' = 'podcastpartnership@gmail.com')
with check (auth.jwt() ->> 'email' = 'podcastpartnership@gmail.com');

create policy "Clients can view their zernio accounts" on public.zernio_accounts
for select to authenticated
using (
  zernio_profile_id in (
    select zp.id
    from public.zernio_profiles zp
    join public.clients c on c.id = zp.client_id
    where c.email = auth.jwt() ->> 'email'
  )
);

create policy "Admins have full access to show_publish_destinations" on public.show_publish_destinations
for all to authenticated
using (auth.jwt() ->> 'email' = 'podcastpartnership@gmail.com')
with check (auth.jwt() ->> 'email' = 'podcastpartnership@gmail.com');

create policy "Clients can view their show destinations" on public.show_publish_destinations
for select to authenticated
using (
  show_id in (
    select s.id
    from public.shows s
    join public.clients c on c.id = s.client_id
    where c.email = auth.jwt() ->> 'email'
  )
);

create policy "Admins have full access to episodes" on public.episodes
for all to authenticated
using (auth.jwt() ->> 'email' = 'podcastpartnership@gmail.com')
with check (auth.jwt() ->> 'email' = 'podcastpartnership@gmail.com');

create policy "Clients can view their episodes" on public.episodes
for select to authenticated
using (
  show_id in (
    select s.id
    from public.shows s
    join public.clients c on c.id = s.client_id
    where c.email = auth.jwt() ->> 'email'
  )
);

create policy "Clients can insert their episodes" on public.episodes
for insert to authenticated
with check (
  show_id in (
    select s.id
    from public.shows s
    join public.clients c on c.id = s.client_id
    where c.email = auth.jwt() ->> 'email'
  )
);

create policy "Clients can update their episodes" on public.episodes
for update to authenticated
using (
  show_id in (
    select s.id
    from public.shows s
    join public.clients c on c.id = s.client_id
    where c.email = auth.jwt() ->> 'email'
  )
)
with check (
  show_id in (
    select s.id
    from public.shows s
    join public.clients c on c.id = s.client_id
    where c.email = auth.jwt() ->> 'email'
  )
);

create policy "Admins have full access to episode_publish_runs" on public.episode_publish_runs
for all to authenticated
using (auth.jwt() ->> 'email' = 'podcastpartnership@gmail.com')
with check (auth.jwt() ->> 'email' = 'podcastpartnership@gmail.com');

create policy "Clients can view their publish runs" on public.episode_publish_runs
for select to authenticated
using (
  episode_id in (
    select e.id
    from public.episodes e
    join public.shows s on s.id = e.show_id
    join public.clients c on c.id = s.client_id
    where c.email = auth.jwt() ->> 'email'
  )
);

create policy "Clients can insert their publish runs" on public.episode_publish_runs
for insert to authenticated
with check (
  episode_id in (
    select e.id
    from public.episodes e
    join public.shows s on s.id = e.show_id
    join public.clients c on c.id = s.client_id
    where c.email = auth.jwt() ->> 'email'
  )
);

create policy "Clients can update their publish runs" on public.episode_publish_runs
for update to authenticated
using (
  episode_id in (
    select e.id
    from public.episodes e
    join public.shows s on s.id = e.show_id
    join public.clients c on c.id = s.client_id
    where c.email = auth.jwt() ->> 'email'
  )
)
with check (
  episode_id in (
    select e.id
    from public.episodes e
    join public.shows s on s.id = e.show_id
    join public.clients c on c.id = s.client_id
    where c.email = auth.jwt() ->> 'email'
  )
);
