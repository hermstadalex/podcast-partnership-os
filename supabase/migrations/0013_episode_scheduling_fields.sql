-- Add scheduling and Captivate-specific fields to episodes table
alter table public.episodes
  add column if not exists episode_art text,
  add column if not exists episode_season integer,
  add column if not exists episode_number integer,
  add column if not exists scheduled_at timestamp with time zone;
