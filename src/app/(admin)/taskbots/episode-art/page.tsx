import { getShows, getEpisodeDraft } from '@/app/actions';
import { EpisodeArtForm } from '@/components/taskbots/EpisodeArtForm';
import { Bot, Paintbrush } from 'lucide-react';

export const metadata = {
  title: 'EpisodeArtBot | Taskbots | Podcast Partnership OS',
};

export default async function EpisodeArtBotPage({
  searchParams,
}: {
  searchParams: { episodeId?: string; autoRun?: string };
}) {
  const showsResponse = await getShows();
  let draft = null;
  
  if (searchParams?.episodeId) {
    draft = await getEpisodeDraft(searchParams.episodeId);
  }

  // Ensure we safely map the show data
  const formattedShows = showsResponse.map((show: any) => ({
    id: show.id,
    title: show.title,
    cover_art: show.cover_art,
    youtube_reference_art: show.youtube_reference_art,
    podcast_reference_art: show.podcast_reference_art,
  }));

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      <header className="flex h-auto sm:h-16 shrink-0 items-center justify-between border-b border-zinc-800 px-4 sm:px-6 py-4 sm:py-0">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
            <Bot className="h-4 w-4 text-indigo-400" />
          </div>
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-zinc-100 flex flex-wrap items-center gap-2">
            EpisodeArtBot
            <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-[10px] text-zinc-400 font-mono tracking-widest outline border border-zinc-700 truncate max-w-full">OIL-PHASE-ARCHITECTURE</span>
          </h1>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-10">
        <div className="mx-auto max-w-6xl space-y-8">
          
          <div className="mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3 flex items-center gap-2 sm:gap-3">
              <Paintbrush className="h-6 w-6 sm:h-8 sm:w-8 text-indigo-400 shrink-0" />
              Dynamic Show Art Generator
            </h2>
            <p className="text-zinc-400 max-w-3xl text-lg">
              This taskbot automatically re-generates template artwork based on a provided base image. It utilizes the independent <strong>Phase 2 Production API</strong> (Gemini Nano Banana Model) to process image variants while maintaining typography styling.
            </p>
          </div>

          <EpisodeArtForm shows={formattedShows} initialDraft={draft} autoRun={searchParams?.autoRun === 'true'} />

        </div>
      </div>
    </div>
  );
}
