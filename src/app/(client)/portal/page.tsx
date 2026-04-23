import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { PortalClientDashboard } from './components/PortalClientDashboard';

export default async function ClientPortal() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { data: clientData } = await supabase
    .from('clients')
    .select('id, name')
    .eq('email', user.email)
    .single();

  if (!clientData) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center">
        <h1 className="text-2xl font-bold text-white mb-4">No Show Assigned</h1>
        <p className="text-zinc-400">Please contact Podcast Partnership to assign a show to your account.</p>
      </div>
    );
  }

  const { data: mappedShow } = await supabase
    .from('shows')
    .select('*')
    .eq('client_id', clientData.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!mappedShow) {
      return (
        <div className="flex flex-col items-center justify-center p-20 text-center">
            <h1 className="text-2xl font-bold text-red-500 mb-4">Show Data Missing</h1>
            <p className="text-zinc-400">Your assigned show could not be retrieved from the provider.</p>
        </div>
      );
  }

  return <PortalClientDashboard mappedShow={mappedShow} />;
}
