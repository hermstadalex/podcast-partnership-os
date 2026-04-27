import { getEpisodeDraft } from '@/app/actions';
import { EpisodeReviewForm } from '@/components/taskbots/EpisodeReviewForm';
import { ClipboardCheck, Bot } from 'lucide-react';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Episode Review | Taskbots | Podcast Partnership OS',
};

export default async function EpisodeReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ episodeId?: string; publishMode?: string; artUrl?: string }>;
}) {
  const resolvedParams = await searchParams;
  
  if (!resolvedParams?.episodeId) {
    redirect('/');
  }

  const episode = await getEpisodeDraft(resolvedParams.episodeId);
  
  if (!episode) {
    redirect('/');
  }

  const publishMode = (resolvedParams.publishMode === 'full' ? 'full' : 'podcast-only') as 'full' | 'podcast-only';
  const artUrl = resolvedParams.artUrl ? decodeURIComponent(resolvedParams.artUrl) : undefined;

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      <header className="flex h-auto sm:h-16 shrink-0 items-center justify-between border-b border-zinc-800 px-4 sm:px-6 py-4 sm:py-0">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
            <Bot className="h-4 w-4 text-emerald-400" />
          </div>
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-zinc-100 flex flex-wrap items-center gap-2">
            Episode Review
            <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-[10px] text-zinc-400 font-mono tracking-widest outline border border-zinc-700 truncate max-w-full">FINAL-PHASE</span>
          </h1>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-10">
        <div className="mx-auto max-w-6xl space-y-8">
          
          <div className="mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3 flex items-center gap-2 sm:gap-3">
              <ClipboardCheck className="h-6 w-6 sm:h-8 sm:w-8 text-emerald-400 shrink-0" />
              Final Review & Schedule
            </h2>
            <p className="text-zinc-400 max-w-3xl text-lg">
              Review your episode metadata, set season and episode numbers, and choose when to publish to Captivate.
            </p>
          </div>

          <EpisodeReviewForm 
            episode={episode} 
            publishMode={publishMode}
            artUrl={artUrl}
          />

        </div>
      </div>
    </div>
  );
}
