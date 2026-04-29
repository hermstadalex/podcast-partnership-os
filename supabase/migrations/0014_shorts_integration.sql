-- Add klap_folder_id to the episodes table
ALTER TABLE public.episodes ADD COLUMN IF NOT EXISTS klap_folder_id TEXT;

-- Create the episode_shorts table to track the individual generated clips
CREATE TABLE IF NOT EXISTS public.episode_shorts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    episode_id UUID NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
    klap_project_id TEXT NOT NULL,
    virality_score NUMERIC,
    title TEXT,
    export_status TEXT DEFAULT 'pending',
    video_url TEXT,
    approval_status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.episode_shorts
    ADD COLUMN IF NOT EXISTS episode_id UUID REFERENCES public.episodes(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS klap_project_id TEXT,
    ADD COLUMN IF NOT EXISTS virality_score NUMERIC,
    ADD COLUMN IF NOT EXISTS title TEXT,
    ADD COLUMN IF NOT EXISTS export_status TEXT DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS video_url TEXT,
    ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Enable Row Level Security (RLS) on episode_shorts
ALTER TABLE public.episode_shorts ENABLE ROW LEVEL SECURITY;

-- Admins can manage episode_shorts
DROP POLICY IF EXISTS "Admins can manage episode_shorts" ON public.episode_shorts;
CREATE POLICY "Admins can manage episode_shorts"
ON public.episode_shorts
FOR ALL TO authenticated
USING (auth.jwt() ->> 'email' = 'podcastpartnership@gmail.com')
WITH CHECK (auth.jwt() ->> 'email' = 'podcastpartnership@gmail.com');

CREATE INDEX IF NOT EXISTS episode_shorts_episode_idx ON public.episode_shorts(episode_id);
CREATE INDEX IF NOT EXISTS episode_shorts_status_idx ON public.episode_shorts(export_status, approval_status);
