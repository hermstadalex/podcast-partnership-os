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

-- Enable Row Level Security (RLS) on episode_shorts
ALTER TABLE public.episode_shorts ENABLE ROW LEVEL SECURITY;

-- Admins can manage episode_shorts
CREATE POLICY "Admins can manage episode_shorts"
ON public.episode_shorts
FOR ALL TO authenticated
USING (auth.jwt() ->> 'email' = 'podcastpartnership@gmail.com')
WITH CHECK (auth.jwt() ->> 'email' = 'podcastpartnership@gmail.com');
