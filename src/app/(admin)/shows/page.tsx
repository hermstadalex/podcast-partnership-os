'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getShows, syncShowsFromCaptivate } from '@/app/actions';
import { PodcastProfileEditor } from '@/components/PodcastProfileEditor';
import { Button } from '@/components/ui/button';
import { RefreshCw, Mic, Settings } from 'lucide-react';
import { toast } from 'sonner';

type ShowCard = {
  id: string;
  title: string;
  description?: string | null;
  cover_art?: string | null;
  captivate_show_id: string;
};

export default function ShowsPage() {
  const [selectedShowId, setSelectedShowId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch local Supabase shows
  const { data: shows = [], isLoading } = useQuery({
    queryKey: ['localShows'],
    queryFn: () => getShows(),
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: () => syncShowsFromCaptivate(),
    onSuccess: () => {
      toast.success('Successfully synchronized shows from Captivate API!');
      queryClient.invalidateQueries({ queryKey: ['localShows'] });
    },
    onError: () => {
      toast.error('Failed to sync shows from Captivate API.');
    }
  });

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-16 shrink-0 items-center gap-4 border-b border-zinc-800 px-6">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-100">Shows & Networks</h1>
        <div className="ml-auto">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => syncMutation.mutate()} 
            disabled={syncMutation.isPending}
            className="border-zinc-800 bg-zinc-950 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            Sync from Provider
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-6xl space-y-8">
          
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight mb-2">Connected Podcasts</h2>
            <p className="text-zinc-400">
              Manage your global podcast settings natively. These settings act as a passthrough to your RSS hosting provider.
            </p>
          </div>

          {isLoading ? (
            <div className="animate-pulse flex gap-6 mt-8">
               <div className="h-64 w-64 bg-zinc-900 rounded-xl"></div>
               <div className="h-64 w-64 bg-zinc-900 rounded-xl"></div>
            </div>
          ) : shows.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-zinc-800 bg-zinc-900/30">
              <div className="h-16 w-16 bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                <Mic className="h-8 w-8 text-zinc-400" />
              </div>
              <h3 className="text-xl font-bold text-zinc-100 mb-2">No shows configured</h3>
              <p className="text-zinc-400 max-w-md mx-auto mb-6">
                Your local database is currently empty. Initiate a one-way synchronization from Captivate to seed your internal CRM.
              </p>
              <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
                <RefreshCw className={`mr-2 h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                Import Shows
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {(shows as ShowCard[]).map((show) => (
                <div 
                  key={show.id} 
                  className="group relative flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-800/50 hover:shadow-xl"
                >
                  <div className="aspect-square w-full relative mb-4 rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800 flex items-center justify-center">
                    {show.cover_art ? (
                       // eslint-disable-next-line @next/next/no-img-element
                       <img src={show.cover_art} alt={show.title} className="object-cover w-full h-full" />
                    ) : (
                       <Mic className="h-12 w-12 text-zinc-800" />
                    )}
                    
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                      <Button onClick={() => setSelectedShowId(show.id)} className="bg-white/10 hover:bg-white/20 text-white border border-white/20">
                        <Settings className="mr-2 h-4 w-4" /> Edit Profile
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex flex-col flex-1">
                    <h3 className="font-semibold text-zinc-100 line-clamp-1">{show.title}</h3>
                    <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{show.description || 'No description available.'}</p>
                    
                    <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
                      <span>Source: Captivate</span>
                      <span className="font-mono">{show.captivate_show_id.substring(0, 8)}...</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <PodcastProfileEditor 
        showId={selectedShowId} 
        onClose={() => {
          setSelectedShowId(null);
          // Auto-invalidate to fetch new metadata if edits occurred
          queryClient.invalidateQueries({ queryKey: ['localShows'] });
          queryClient.invalidateQueries({ queryKey: ['show', selectedShowId] });
        }} 
      />
    </div>
  );
}
