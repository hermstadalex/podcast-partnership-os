-- Add Zernio job tracking column
ALTER TABLE public.episodes_feed
ADD COLUMN zernio_post_id text;
