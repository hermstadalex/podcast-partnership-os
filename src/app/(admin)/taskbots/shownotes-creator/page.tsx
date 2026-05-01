import { getShows } from '@/app/actions';
import { ShownotesCreatorClient } from './ShownotesCreatorClient';
import { FileText } from 'lucide-react';

export const metadata = {
  title: 'Shownotes Creator | Taskbots | Podcast Partnership OS',
};

export default async function ShownotesCreatorPage({
  searchParams,
}: {
  searchParams: Promise<{ episodeId?: string }>;
}) {
  const showsResponse = await getShows();
  const resolvedParams = await searchParams;

  // Map show data safely
  const formattedShows = showsResponse.map((show: any) => ({
    id: show.id,
    title: show.title,
  }));

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      <header className="flex h-auto sm:h-16 shrink-0 items-center justify-between border-b border-zinc-800 px-4 sm:px-6 py-4 sm:py-0">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
            <FileText className="h-4 w-4 text-cyan-400" />
          </div>
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-zinc-100 flex flex-wrap items-center gap-2">
            Shownotes Creator
            <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-[10px] text-zinc-400 font-mono tracking-widest outline border border-zinc-700 truncate max-w-full">TASKBOT</span>
          </h1>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-10">
        <div className="mx-auto max-w-6xl space-y-8">
          
          <div className="mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3 flex items-center gap-2 sm:gap-3">
              <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-cyan-400 shrink-0" />
              Generate SEO-Optimized Metadata
            </h2>
            <p className="text-zinc-400 max-w-3xl text-lg">
              Automatically generate compelling titles, HTML shownotes, and viral hashtags for your episode using Gemini. Provide an audio/video URL or select an existing show.
            </p>
          </div>

          <ShownotesCreatorClient shows={formattedShows} initialEpisodeId={resolvedParams?.episodeId} />

        </div>
      </div>
    </div>
  );
}
