-- Create social_posts table for the Zernio Publish Wizard
CREATE TABLE IF NOT EXISTS public.social_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    show_id UUID REFERENCES public.shows(id) ON DELETE SET NULL,
    episode_id UUID REFERENCES public.episodes(id) ON DELETE SET NULL,
    zernio_profile_id UUID REFERENCES public.zernio_profiles(id) ON DELETE SET NULL,
    zernio_post_id TEXT,
    
    title TEXT,
    caption TEXT,
    media_url TEXT,
    
    platforms JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'DRAFT',
    scheduled_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS policies for social_posts
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

-- Admins get full access
DROP POLICY IF EXISTS "Admins can manage social_posts" ON public.social_posts;
CREATE POLICY "Admins can manage social_posts"
ON public.social_posts
FOR ALL TO authenticated
USING (auth.jwt() ->> 'email' = 'podcastpartnership@gmail.com')
WITH CHECK (auth.jwt() ->> 'email' = 'podcastpartnership@gmail.com');

-- Clients can see their own social posts
DROP POLICY IF EXISTS "Clients can view their social_posts" ON public.social_posts;
CREATE POLICY "Clients can view their social_posts"
ON public.social_posts
FOR SELECT TO authenticated
USING (
  client_id IN (
    SELECT id FROM public.clients WHERE email = auth.jwt() ->> 'email'
  )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS social_posts_client_idx ON public.social_posts(client_id);
CREATE INDEX IF NOT EXISTS social_posts_status_idx ON public.social_posts(status);
