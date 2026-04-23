create table if not exists public.assets (
  id uuid primary key default uuid_generate_v4(),
  show_id uuid not null references public.shows(id) on delete cascade,
  episode_id uuid references public.episodes(id) on delete set null,
  asset_type text not null,
  status text not null default 'draft' check (status in ('draft', 'awaiting_approval', 'approved', 'rejected', 'publish_queued', 'published', 'failed')),
  source_provider text not null default 'manual',
  source_url text not null,
  preview_url text,
  title text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.approval_requests (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete cascade,
  show_id uuid not null references public.shows(id) on delete cascade,
  episode_id uuid references public.episodes(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'partially_approved', 'approved', 'rejected')),
  requested_by_role text not null default 'admin' check (requested_by_role in ('admin', 'client', 'system')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.approval_items (
  id uuid primary key default uuid_generate_v4(),
  approval_request_id uuid not null references public.approval_requests(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  decision_status text not null default 'pending' check (decision_status in ('pending', 'approved', 'rejected')),
  decision_comment text,
  decided_by_email text,
  decided_at timestamp with time zone,
  sort_order integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (approval_request_id, asset_id)
);

create index if not exists assets_show_idx on public.assets(show_id);
create index if not exists assets_episode_idx on public.assets(episode_id);
create index if not exists assets_status_idx on public.assets(status);
create index if not exists approval_requests_client_idx on public.approval_requests(client_id);
create index if not exists approval_requests_show_idx on public.approval_requests(show_id);
create index if not exists approval_requests_status_idx on public.approval_requests(status);
create index if not exists approval_items_request_idx on public.approval_items(approval_request_id);
create index if not exists approval_items_asset_idx on public.approval_items(asset_id);
create index if not exists approval_items_status_idx on public.approval_items(decision_status);

alter table public.assets enable row level security;
alter table public.approval_requests enable row level security;
alter table public.approval_items enable row level security;

create policy "Admins have full access to assets" on public.assets
for all to authenticated
using (auth.jwt() ->> 'email' = 'podcastpartnership@gmail.com')
with check (auth.jwt() ->> 'email' = 'podcastpartnership@gmail.com');

create policy "Clients can view their assets" on public.assets
for select to authenticated
using (
  show_id in (
    select s.id
    from public.shows s
    join public.clients c on c.id = s.client_id
    where c.email = auth.jwt() ->> 'email'
  )
);

create policy "Clients can update their assets" on public.assets
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

create policy "Admins have full access to approval requests" on public.approval_requests
for all to authenticated
using (auth.jwt() ->> 'email' = 'podcastpartnership@gmail.com')
with check (auth.jwt() ->> 'email' = 'podcastpartnership@gmail.com');

create policy "Clients can view their approval requests" on public.approval_requests
for select to authenticated
using (
  client_id in (
    select id from public.clients where email = auth.jwt() ->> 'email'
  )
);

create policy "Clients can update their approval requests" on public.approval_requests
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

create policy "Admins have full access to approval items" on public.approval_items
for all to authenticated
using (auth.jwt() ->> 'email' = 'podcastpartnership@gmail.com')
with check (auth.jwt() ->> 'email' = 'podcastpartnership@gmail.com');

create policy "Clients can view their approval items" on public.approval_items
for select to authenticated
using (
  approval_request_id in (
    select ar.id
    from public.approval_requests ar
    join public.clients c on c.id = ar.client_id
    where c.email = auth.jwt() ->> 'email'
  )
);

create policy "Clients can update their approval items" on public.approval_items
for update to authenticated
using (
  approval_request_id in (
    select ar.id
    from public.approval_requests ar
    join public.clients c on c.id = ar.client_id
    where c.email = auth.jwt() ->> 'email'
  )
)
with check (
  approval_request_id in (
    select ar.id
    from public.approval_requests ar
    join public.clients c on c.id = ar.client_id
    where c.email = auth.jwt() ->> 'email'
  )
);
