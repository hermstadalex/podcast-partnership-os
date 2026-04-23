'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getEpisodes } from '@/app/actions';
import { PodcastProfileEditor } from '@/components/PodcastProfileEditor';
import { EpisodeCreatorWizard } from '@/components/EpisodeCreatorWizard';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Loader2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type EpisodeFeedEntry = {
  id: string;
  title: string;
  created_at: string;
  status: string;
  show_id: string;
};

export default function DashboardPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShow, setSelectedShow] = useState<string | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const { data: feedData, isLoading } = useQuery({
    queryKey: ['episodes'],
    queryFn: () => getEpisodes(),
    refetchInterval: 5000, // Poll every 5s for live pipeline updates
  });

  const episodes = (feedData?.episodes || []) as EpisodeFeedEntry[];
  const filteredEpisodes = episodes.filter((ep) =>
    ep.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Global Status Feed</h1>
          <p className="text-zinc-400 mt-2">Manage all client shows passing through Captivate & Zernio.</p>
        </div>
        <Button onClick={() => setIsWizardOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20">
          <Wand2 className="w-4 h-4 mr-2" />
          New AI Episode
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input 
            placeholder="Search podcasts..." 
            className="pl-9 bg-zinc-900/50 border-zinc-800 focus-visible:ring-indigo-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-md border border-zinc-800 bg-zinc-900/20 overflow-hidden">
        <Table>
          <TableHeader className="bg-zinc-900/50">
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="text-zinc-400 font-medium">Episode Title</TableHead>
              <TableHead className="text-zinc-400 font-medium">Created</TableHead>
              <TableHead className="text-zinc-400 font-medium">Pipeline Status</TableHead>
              <TableHead className="text-right text-zinc-400 font-medium">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow className="border-zinc-800">
                <TableCell colSpan={4} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-zinc-500" />
                </TableCell>
              </TableRow>
            ) : filteredEpisodes.length === 0 ? (
              <TableRow className="border-zinc-800">
                <TableCell colSpan={4} className="h-24 text-center text-zinc-500">
                  No episodes found.
                </TableCell>
              </TableRow>
            ) : (
              filteredEpisodes.map((ep) => (
                <TableRow key={ep.id} className="border-zinc-800 hover:bg-zinc-800/50 transition-colors cursor-pointer" onClick={() => setSelectedShow(ep.show_id)}>
                  <TableCell className="font-medium text-zinc-200">
                    {ep.title}
                  </TableCell>
                  <TableCell className="text-zinc-500 font-mono text-xs">{new Date(ep.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium 
                      ${ep.status === 'Published' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                        ep.status === 'Failed' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
                        'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                      {ep.status}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-100">
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PodcastProfileEditor 
        showId={selectedShow} 
        onClose={() => setSelectedShow(null)} 
      />

      <EpisodeCreatorWizard 
        isOpen={isWizardOpen} 
        onClose={() => setIsWizardOpen(false)} 
      />
    </div>
  );
}
