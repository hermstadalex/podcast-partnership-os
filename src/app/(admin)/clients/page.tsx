import { createClient } from '@/lib/supabase/server';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { CreateClientForm } from '@/components/CreateClientForm';
import { redirect } from 'next/navigation';

type ClientRow = {
  id: string;
  name: string;
  email: string;
  captivate_show_id?: string | null;
  zernio_account_id?: string | null;
};

type ShowRow = {
  id: string;
  client_id?: string | null;
  title: string;
  captivate_show_id: string;
};

type ZernioProfileRow = {
  id: string;
  client_id: string;
  external_profile_id?: string | null;
};

type ZernioAccountRow = {
  id: string;
  zernio_profile_id: string;
  external_account_id: string;
};

export default async function ClientsConfigurationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Root guard: Only allow the explicit admin
  if (user?.email !== 'podcastpartnership@gmail.com') {
    redirect('/portal');
  }

  // Fetch all existing clients
  const { data: clients } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
  const { data: shows } = await supabase.from('shows').select('*').order('title', { ascending: true });
  const { data: profiles } = await supabase.from('zernio_profiles').select('id, client_id, external_profile_id');
  const { data: accounts } = await supabase.from('zernio_accounts').select('id, zernio_profile_id, external_account_id');

  const typedClients = (clients || []) as ClientRow[];
  const typedShows = (shows || []) as ShowRow[];
  const typedProfiles = (profiles || []) as ZernioProfileRow[];
  const typedAccounts = (accounts || []) as ZernioAccountRow[];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 p-8">
      <div>
        <h1 className="text-4xl font-black bg-gradient-to-br from-white to-zinc-500 bg-clip-text text-transparent">
          Client Multi-Tenant Control
        </h1>
        <p className="text-zinc-400 mt-2 max-w-2xl">
          Provision client portals, map Supabase auth identities, and link Captivate shows. 
          When invited, clients securely manage their exact pipeline without broader ecosystem access.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-1">
          <Card className="bg-black/40 border-white/10 backdrop-blur-xl">
            <CardHeader>
              <CardTitle>Provision New Client</CardTitle>
              <CardDescription>Generates an auth token and maps the Zernio pipeline ID.</CardDescription>
            </CardHeader>
            <CardContent>
              <CreateClientForm availableShows={shows || []} />
            </CardContent>
          </Card>
        </div>

        <div className="xl:col-span-2">
           <Card className="bg-black/40 border-white/10 backdrop-blur-xl h-full">
            <CardHeader>
              <CardTitle>Active Client Routing Directives</CardTitle>
            </CardHeader>
            <CardContent>
              {typedClients.length > 0 ? (
                <div className="space-y-4">
                  {typedClients.map((c) => {
                     const linkedShows = typedShows.filter((s) => s.client_id === c.id);
                     const primaryShow = linkedShows[0];
                     const profile = typedProfiles.find((p) => p.client_id === c.id);
                     const linkedAccounts = typedAccounts.filter((a) => a.zernio_profile_id === profile?.id);
                     return (
                      <div key={c.id} className="flex flex-col md:flex-row gap-4 justify-between bg-white/5 p-4 rounded-xl border border-white/10 relative overflow-hidden group">
                         <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                         <div>
                            <h3 className="font-bold text-white text-lg">{c.name}</h3>
                            <p className="text-zinc-400 text-sm">{c.email}</p>
                         </div>
                         <div className="flex flex-col text-sm text-zinc-500">
                            <span className="text-zinc-300 font-medium">Primary Show: {primaryShow ? primaryShow.title : 'Unresolved Link'}</span>
                            <span>Show Count: <span className="font-mono text-xs">{linkedShows.length}</span></span>
                            <span>Captivate ID: <span className="font-mono text-xs">{primaryShow?.captivate_show_id || c.captivate_show_id}</span></span>
                            <span>Zernio Profile ID: <span className="font-mono text-xs">{profile?.external_profile_id || 'Pending'}</span></span>
                            <span>Default Publish Account: <span className="font-mono text-xs">{linkedAccounts[0]?.external_account_id || c.zernio_account_id || 'Pending'}</span></span>
                         </div>
                      </div>
                     )
                  })}
                </div>
              ) : (
                <div className="text-center p-8 text-zinc-500 bg-white/5 rounded-xl border border-white/10 border-dashed">
                  No clients have been provisioned yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
