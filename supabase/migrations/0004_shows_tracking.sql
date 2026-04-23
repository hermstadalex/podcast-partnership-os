-- Create shows table
create table public.shows (
  id uuid primary key default uuid_generate_v4(),
  captivate_show_id text unique not null,
  title text not null,
  author text,
  description text,
  cover_art text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.shows enable row level security;

-- Policies for shows
create policy "Allow public access to shows for MVP" on public.shows
  for all
  to public
  using (true)
  with check (true);
