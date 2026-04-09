-- Enable uuid-ossp for UUID generation
create extension if not exists "uuid-ossp";

-- Create clients table
create table public.clients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  captivate_show_id text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create submission_history table
create table public.submission_history (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references public.clients(id) on delete cascade not null,
  youtube_status text not null default 'pending', -- 'pending', 'processing', 'published'
  zernio_job_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.clients enable row level security;
alter table public.submission_history enable row level security;

-- Policies for clients
create policy "Allow access to PodcastPartnership emails" on public.clients
  for all
  to authenticated
  using (
    auth.jwt() ->> 'email' like '%@podcastpartnership.com'
  );

-- Policies for submission_history
create policy "Allow access to PodcastPartnership emails" on public.submission_history
  for all
  to authenticated
  using (
    auth.jwt() ->> 'email' like '%@podcastpartnership.com'
  );
