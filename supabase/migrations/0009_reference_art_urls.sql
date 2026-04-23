-- Add specifically purposed reference templates for the EpisodeArtBot workflow
ALTER TABLE public.shows 
ADD COLUMN IF NOT EXISTS youtube_reference_art text,
ADD COLUMN IF NOT EXISTS podcast_reference_art text;

-- Seed "Your Next Million"
INSERT INTO public.shows (captivate_show_id, title, youtube_reference_art, podcast_reference_art)
VALUES (
    uuid_generate_v4()::text, 
    'Your Next Million', 
    'https://raw.githubusercontent.com/hermstadalex/n8nassets/refs/heads/main/AFK_yt_art.png', 
    'https://raw.githubusercontent.com/hermstadalex/n8nassets/refs/heads/main/image-20.jpg'
)
ON CONFLICT (captivate_show_id) DO UPDATE 
SET 
  youtube_reference_art = EXCLUDED.youtube_reference_art,
  podcast_reference_art = EXCLUDED.podcast_reference_art;
