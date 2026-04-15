-- Create episodes_feed table
create table public.episodes_feed (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  media_url text,
  status text not null default 'Processing', -- 'Processing', 'Published', 'Failed'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.episodes_feed enable row level security;

-- Policies for episodes_feed
create policy "Allow public access to episodes_feed for MVP" on public.episodes_feed
  for all
  to public
  using (true)
  with check (true);
