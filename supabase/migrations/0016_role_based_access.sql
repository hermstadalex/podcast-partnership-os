-- Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role text NOT NULL CHECK (role IN ('admin', 'client')),
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
SET search_path = public
AS $$
BEGIN
  -- Check user_roles table
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admins can read all roles, users can read their own
CREATE POLICY "Admins can read all roles" ON public.user_roles
FOR SELECT TO authenticated
USING (public.is_admin());

CREATE POLICY "Users can read their own role" ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Update existing policies to use is_admin()

-- SHOWS
DROP POLICY IF EXISTS "Admins have full access to shows" ON public.shows;
CREATE POLICY "Admins have full access to shows" ON public.shows
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- CLIENTS
DROP POLICY IF EXISTS "Admins have full access to clients" ON public.clients;
CREATE POLICY "Admins have full access to clients" ON public.clients
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- EPISODES_FEED
DROP POLICY IF EXISTS "Admins have full access to episodes_feed" ON public.episodes_feed;
CREATE POLICY "Admins have full access to episodes_feed" ON public.episodes_feed
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- APPROVALS
DROP POLICY IF EXISTS "Admins have full access to approvals" ON public.approvals;
CREATE POLICY "Admins have full access to approvals" ON public.approvals
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ASSETS
DROP POLICY IF EXISTS "Admins have full access to assets" ON public.assets;
CREATE POLICY "Admins have full access to assets" ON public.assets
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
