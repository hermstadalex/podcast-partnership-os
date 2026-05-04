-- 1. Fix episode_shorts
-- Replace hardcoded admin policy
DROP POLICY IF EXISTS "Admins can manage episode_shorts" ON public.episode_shorts;
CREATE POLICY "Admins can manage episode_shorts" ON public.episode_shorts
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Add client read policy for episode_shorts
CREATE POLICY "Clients can view their episode_shorts" ON public.episode_shorts
FOR SELECT TO authenticated
USING (
  episode_id IN (
    SELECT e.id FROM public.episodes e
    JOIN public.shows s ON e.show_id = s.id
    JOIN public.clients c ON s.client_id = c.id
    WHERE c.email = auth.jwt() ->> 'email'
  )
);

-- 2. Fix social_posts
-- Replace hardcoded admin policy
DROP POLICY IF EXISTS "Admins can manage social_posts" ON public.social_posts;
CREATE POLICY "Admins can manage social_posts" ON public.social_posts
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Add client insert policy
CREATE POLICY "Clients can insert social_posts" ON public.social_posts
FOR INSERT TO authenticated
WITH CHECK (
  client_id IN (
    SELECT id FROM public.clients WHERE email = auth.jwt() ->> 'email'
  )
);

-- Add client update policy
CREATE POLICY "Clients can update social_posts" ON public.social_posts
FOR UPDATE TO authenticated
USING (
  client_id IN (
    SELECT id FROM public.clients WHERE email = auth.jwt() ->> 'email'
  )
)
WITH CHECK (
  client_id IN (
    SELECT id FROM public.clients WHERE email = auth.jwt() ->> 'email'
  )
);

-- 3. Fix episode_publish_runs
-- Ensure episode_publish_runs has client read access
DROP POLICY IF EXISTS "Admins can manage episode_publish_runs" ON public.episode_publish_runs;
CREATE POLICY "Admins can manage episode_publish_runs" ON public.episode_publish_runs
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Clients can view their episode_publish_runs" ON public.episode_publish_runs
FOR SELECT TO authenticated
USING (
  episode_id IN (
    SELECT e.id FROM public.episodes e
    JOIN public.shows s ON e.show_id = s.id
    JOIN public.clients c ON s.client_id = c.id
    WHERE c.email = auth.jwt() ->> 'email'
  )
);
