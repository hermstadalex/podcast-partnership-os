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
import { Search, Loader2, Wand2, ExternalLink, Scissors, Podcast, Video, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

type EpisodeFeedEntry = {
  id: string;
  title: string;
  created_at: string;
  status: string;
  show_id: string;
  show_title: string | null;
  client_name: string | null;
  youtube_video_url: string | null;
  captivate_show_id: string | null;
  destinations: { provider: string; status: string }[];
  shorts_count: number;
  has_shorts: boolean;
  is_video: boolean;
};

const statusStyles: Record<string, string> = {
  Published: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Dispatched: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Failed: 'bg-red-500/10 text-red-400 border-red-500/20',
  Draft: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  Scheduled: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

const providerIcon: Record<string, React.ReactNode> = {
  captivate: <Podcast className="w-3.5 h-3.5" />,
  zernio: <Globe className="w-3.5 h-3.5" />,
  youtube: <Globe className="w-3.5 h-3.5" />,
};

const providerLabel: Record<string, string> = {
  captivate: 'Captivate',
  zernio: 'YouTube',
  youtube: 'YouTube',
};

export default function DashboardPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShow, setSelectedShow] = useState<string | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const { data: feedData, isLoading } = useQuery({
    queryKey: ['episodes'],
    queryFn: () => getEpisodes(),
    refetchInterval: 5000,
  });

  const episodes = (feedData?.episodes || []) as EpisodeFeedEntry[];
  const filteredEpisodes = episodes.filter((ep) =>
    ep.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (ep.show_title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (ep.client_name || '').toLowerCase().includes(searchQuery.toLowerCase())
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
            placeholder="Search episodes, shows, or clients..." 
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
              <TableHead className="text-zinc-400 font-medium">Episode</TableHead>
              <TableHead className="text-zinc-400 font-medium">Show / Client</TableHead>
              <TableHead className="text-zinc-400 font-medium">Status</TableHead>
              <TableHead className="text-zinc-400 font-medium">Destinations</TableHead>
              <TableHead className="text-zinc-400 font-medium">Shorts</TableHead>
              <TableHead className="text-zinc-400 font-medium text-right">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow className="border-zinc-800">
                <TableCell colSpan={6} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-zinc-500" />
                </TableCell>
              </TableRow>
            ) : filteredEpisodes.length === 0 ? (
              <TableRow className="border-zinc-800">
                <TableCell colSpan={6} className="h-24 text-center text-zinc-500">
                  No episodes found.
                </TableCell>
              </TableRow>
            ) : (
              filteredEpisodes.map((ep) => (
                <TableRow key={ep.id} className="border-zinc-800 hover:bg-zinc-800/50 transition-colors cursor-pointer" onClick={() => setSelectedShow(ep.show_id)}>
                  {/* Episode Title */}
                  <TableCell className="font-medium text-zinc-200 max-w-[280px]">
                    <span className="line-clamp-1">{ep.title}</span>
                  </TableCell>

                  {/* Show / Client */}
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm text-zinc-300 font-medium line-clamp-1">{ep.show_title || '—'}</span>
                      {ep.client_name && (
                        <span className="text-xs text-zinc-500">{ep.client_name}</span>
                      )}
                    </div>
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border
                      ${statusStyles[ep.status] || 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                      {ep.status}
                    </div>
                  </TableCell>

                  {/* Destinations */}
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {ep.destinations.length === 0 ? (
                        <span className="text-xs text-zinc-600">—</span>
                      ) : (
                        ep.destinations.map((dest, i) => {
                          const isSuccess = dest.status === 'Dispatched' || dest.status === 'Published';
                          // Build link for YouTube if available
                          const href = dest.provider === 'zernio' && ep.youtube_video_url
                            ? ep.youtube_video_url
                            : null;

                          const badge = (
                            <span
                              key={i}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                isSuccess
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : dest.status === 'Failed'
                                    ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              }`}
                            >
                              {providerIcon[dest.provider] || <ExternalLink className="w-3 h-3" />}
                              {providerLabel[dest.provider] || dest.provider}
                            </span>
                          );

                          return href ? (
                            <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
                              {badge}
                            </a>
                          ) : badge;
                        })
                      )}
                    </div>
                  </TableCell>

                  {/* Shorts */}
                  <TableCell>
                    {ep.has_shorts ? (
                      <Link
                        href={`/taskbots/shorts-creator?episodeId=${ep.id}`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20 hover:bg-fuchsia-500/20 transition-colors"
                      >
                        <Scissors className="w-3 h-3" />
                        {ep.shorts_count} Short{ep.shorts_count !== 1 ? 's' : ''}
                      </Link>
                    ) : ep.is_video ? (
                      <Link
                        href={`/taskbots/shorts-creator?episodeId=${ep.id}`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
                      >
                        <Video className="w-3 h-3" />
                        Generate
                      </Link>
                    ) : (
                      <span className="text-xs text-zinc-600">—</span>
                    )}
                  </TableCell>

                  {/* Created */}
                  <TableCell className="text-right text-zinc-500 font-mono text-xs">
                    {new Date(ep.created_at).toLocaleDateString()}
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
