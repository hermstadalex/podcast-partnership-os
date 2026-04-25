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
  abbreviation?: string | null;
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
                <div className="overflow-x-auto round-lg border border-white/10">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-black/40 text-zinc-400 border-b border-white/5">
                      <tr>
                        <th className="px-6 py-4 font-semibold text-white">Client</th>
                        <th className="px-6 py-4 font-semibold text-white">Abbreviation</th>
                        <th className="px-6 py-4 font-semibold text-white">Show Property</th>
                        <th className="px-6 py-4 font-semibold text-white">Pipeline Sync</th>
                        <th className="px-6 py-4 font-semibold text-white">Primary Account</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {typedClients.sort((a, b) => {
                         const showA = typedShows.find(s => s.client_id === a.id);
                         const showB = typedShows.find(s => s.client_id === b.id);
                         const abbrA = showA?.abbreviation || 'ZZZ';
                         const abbrB = showB?.abbreviation || 'ZZZ';
                         return abbrA.localeCompare(abbrB);
                      }).map((c) => {
                         const linkedShows = typedShows.filter((s) => s.client_id === c.id);
                         const primaryShow = linkedShows[0];
                         const profile = typedProfiles.find((p) => p.client_id === c.id);
                         const linkedAccounts = typedAccounts.filter((a) => a.zernio_profile_id === profile?.id);
                         
                         const hasCaptivate = !!primaryShow?.captivate_show_id && !primaryShow.captivate_show_id.includes('pending');
                         const hasZernio = !!profile?.external_profile_id;
                         
                         return (
                          <tr key={c.id} className="bg-white/5 hover:bg-white/10 transition-colors group">
                             <td className="px-6 py-4">
                                <div className="font-bold text-white text-base">{c.name}</div>
                                <div className="text-zinc-500 font-mono text-xs mt-1">{c.email}</div>
                             </td>
                             <td className="px-6 py-4">
                                <div className="inline-flex items-center justify-center px-2.5 py-1 text-xs font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded">
                                  {primaryShow?.abbreviation || 'N/A'}
                                </div>
                             </td>
                             <td className="px-6 py-4">
                                <div className="text-zinc-100 font-medium">{primaryShow ? primaryShow.title : 'Unresolved Link'}</div>
                                <div className="text-zinc-500 font-mono text-[10px] mt-1">{primaryShow?.captivate_show_id || c.captivate_show_id}</div>
                             </td>
                             <td className="px-6 py-4">
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${hasCaptivate ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-red-500'}`}></div>
                                        <span className="text-xs text-zinc-400">Captivate Active</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${hasZernio ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-red-500'}`}></div>
                                        <span className="text-xs text-zinc-400">Zernio Active</span>
                                    </div>
                                </div>
                             </td>
                             <td className="px-6 py-4">
                                <div className="text-xs font-mono text-zinc-300">
                                   {linkedAccounts[0]?.external_account_id || c.zernio_account_id || 'Pending Auth'}
                                </div>
                             </td>
                          </tr>
                         )
                      })}
                    </tbody>
                  </table>
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
