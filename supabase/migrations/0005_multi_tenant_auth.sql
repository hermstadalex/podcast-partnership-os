-- Add email and zernio_profile_id to clients table
ALTER TABLE public.clients
ADD COLUMN email text unique;

ALTER TABLE public.clients
ADD COLUMN zernio_profile_id text;

-- Remove old policies
DROP POLICY IF EXISTS "Allow access to PodcastPartnership emails" ON public.clients;
DROP POLICY IF EXISTS "Allow access to PodcastPartnership emails" ON public.submission_history;
DROP POLICY IF EXISTS "Allow public access to episodes_feed for MVP" ON public.episodes_feed;
DROP POLICY IF EXISTS "Allow public access to shows for MVP" ON public.shows;

-- ==========================
-- SHOWS TABLE POLICIES
-- ==========================

-- Admin: Super user access to everything
CREATE POLICY "Admins have full access to shows" ON public.shows
FOR ALL TO authenticated
USING (auth.jwt() ->> 'email' = 'podcastpartnership@gmail.com')
WITH CHECK (auth.jwt() ->> 'email' = 'podcastpartnership@gmail.com');

-- Clients: Can read and update their own mapped show
CREATE POLICY "Clients can view their mapped show" ON public.shows
FOR SELECT TO authenticated
USING (
  captivate_show_id IN (
    SELECT captivate_show_id FROM public.clients WHERE email = auth.jwt() ->> 'email'
  )
);

CREATE POLICY "Clients can update their mapped show" ON public.shows
FOR UPDATE TO authenticated
USING (
  captivate_show_id IN (
    SELECT captivate_show_id FROM public.clients WHERE email = auth.jwt() ->> 'email'
  )
)
WITH CHECK (
  captivate_show_id IN (
    SELECT captivate_show_id FROM public.clients WHERE email = auth.jwt() ->> 'email'
  )
);

-- ==========================
-- CLIENTS TABLE POLICIES
-- ==========================

-- Admin: Super user access to everything
CREATE POLICY "Admins have full access to clients" ON public.clients
FOR ALL TO authenticated
USING (auth.jwt() ->> 'email' = 'podcastpartnership@gmail.com')
WITH CHECK (auth.jwt() ->> 'email' = 'podcastpartnership@gmail.com');

-- Clients: Can read their own record (but not update/delete)
CREATE POLICY "Clients can view their own record" ON public.clients
FOR SELECT TO authenticated
USING (email = auth.jwt() ->> 'email');

-- ==========================
-- EPISODES FEED POLICIES
-- ==========================

-- Admin: Super user access
CREATE POLICY "Admins have full access to episodes_feed" ON public.episodes_feed
FOR ALL TO authenticated
USING (auth.jwt() ->> 'email' = 'podcastpartnership@gmail.com')
WITH CHECK (auth.jwt() ->> 'email' = 'podcastpartnership@gmail.com');

-- Client: We don't have a direct 'show_id' or 'client_id' on episodes_feed yet!
-- WAIT: episodes_feed in 0002 has NO relationship back to a show or a client.
-- Let's amend the episodes_feed table to have a captivate_show_id!
ALTER TABLE public.episodes_feed
ADD COLUMN captivate_show_id text;

-- Clients can select their own episodes
CREATE POLICY "Clients can view their mapped episodes" ON public.episodes_feed
FOR SELECT TO authenticated
USING (
  captivate_show_id IN (
    SELECT captivate_show_id FROM public.clients WHERE email = auth.jwt() ->> 'email'
  )
);

-- Clients can insert episodes matching their show
CREATE POLICY "Clients can insert episodes for their show" ON public.episodes_feed
FOR INSERT TO authenticated
WITH CHECK (
  captivate_show_id IN (
    SELECT captivate_show_id FROM public.clients WHERE email = auth.jwt() ->> 'email'
  )
);
