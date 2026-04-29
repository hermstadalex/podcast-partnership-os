'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClipboardCheck, Calendar, Podcast, Video, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { publishEpisodeToCaptivate, updateEpisodeDraft } from '@/app/actions';
import { useRouter } from 'next/navigation';

type PublishStatus = 'Draft' | 'Scheduled' | 'Published';

export function EpisodeReviewForm({ 
  episode, 
  publishMode, 
  artUrl 
}: { 
  episode: any; 
  publishMode: 'podcast-only' | 'full'; 
  artUrl?: string;
}) {
  const router = useRouter();
  
  const [title, setTitle] = useState(episode.title || '');
  const [description, setDescription] = useState(episode.description || '');
  const [episodeSeason, setEpisodeSeason] = useState<number | undefined>(episode.episode_season || undefined);
  const [episodeNumber, setEpisodeNumber] = useState<number | undefined>(episode.episode_number || undefined);
  const [status, setStatus] = useState<PublishStatus>('Draft');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const displayArt = artUrl || episode.episode_art;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Always save updated metadata before publishing
      await updateEpisodeDraft(episode.id, {
        title,
        description,
        ...(displayArt && displayArt !== episode.episode_art ? { episode_art: displayArt } : {}),
        episode_season: episodeSeason,
        episode_number: episodeNumber,
      });

      // Build the date string in Captivate's format: 'YYYY-MM-DD HH:mm:ss'
      let dateString: string | undefined;
      if (status === 'Scheduled' && scheduleDate && scheduleTime) {
        dateString = `${scheduleDate} ${scheduleTime}:00`;
      } else if (status === 'Published') {
        // Publish now = set date to now
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const h = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const s = String(now.getSeconds()).padStart(2, '0');
        dateString = `${y}-${m}-${d} ${h}:${min}:${s}`;
      }

      const result = await publishEpisodeToCaptivate(episode.id, {
        status,
        date: dateString,
        episodeSeason,
        episodeNumber,
      });

      if (result && !result.success) {
        throw new Error(result.error);
      }

      setIsComplete(true);
      toast.success(
        status === 'Draft' 
          ? 'Episode saved as draft in Captivate!' 
          : status === 'Scheduled' 
            ? 'Episode scheduled in Captivate!' 
            : 'Episode published to Captivate!'
      );
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isComplete) {
    return (
      <div className="flex flex-col items-center justify-center space-y-6 py-16 animate-in zoom-in">
        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
        </div>
        <div className="text-center">
          <h3 className="text-2xl font-bold text-zinc-100">
            {status === 'Draft' ? 'Draft Saved!' : status === 'Scheduled' ? 'Episode Scheduled!' : 'Episode Published!'}
          </h3>
          <p className="text-zinc-400 mt-2 max-w-md">
            Your episode has been dispatched to Captivate
            {publishMode === 'full' ? ' and will also be distributed via Zernio' : ''}.
            Track its status in the Global Feed.
          </p>
        </div>
        <div className="flex gap-4">
          <Button onClick={() => router.push('/')} className="bg-zinc-800 hover:bg-zinc-700 text-white px-8">
            Return to Dashboard
          </Button>
          {episode.media_url?.match(/\.(mp4|mov|webm|avi|mkv)$/i) && (
            <Button onClick={() => router.push(`/taskbots/shorts-creator?episodeId=${episode.id}`)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 font-semibold shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] transition-all">
              <Video className="w-4 h-4 mr-2" />
              Launch Shorts Creator
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      {/* LEFT: Episode Details */}
      <div className="lg:col-span-2 space-y-8">
        
        {/* Title */}
        <div className="border border-zinc-800 bg-zinc-900/50 rounded-xl p-6">
          <Label className="text-sm font-medium text-zinc-300 mb-2 block">Episode Title</Label>
          <Input 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-zinc-950 border-zinc-800 text-lg font-semibold text-zinc-100 focus-visible:ring-indigo-500"
          />
        </div>

        {/* Shownotes Dual-Pane Editor */}
        <div className="border border-zinc-800 bg-zinc-900/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <Label className="text-sm font-medium text-zinc-300">Shownotes Editor</Label>
            <span className={`text-xs ${description.length > 4000 ? 'text-red-400 font-semibold' : 'text-zinc-500'}`}>{description.length}/4000 chars</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: Raw HTML Editor */}
            <div>
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5 block font-semibold">Edit HTML</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                spellCheck={false}
                className="w-full h-[350px] bg-zinc-950 border border-zinc-800 rounded-md p-4 font-mono text-xs text-zinc-300 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            {/* Right: Live Preview */}
            <div>
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5 block font-semibold">Live Preview</span>
              <div 
                className="h-[350px] bg-zinc-950 border border-zinc-800 rounded-md p-4 overflow-y-auto max-w-none text-sm text-zinc-300
                  [&_h1]:text-zinc-100 [&_h1]:font-bold [&_h1]:text-xl [&_h1]:mt-6 [&_h1]:mb-3
                  [&_h2]:text-zinc-100 [&_h2]:font-semibold [&_h2]:text-lg [&_h2]:mt-5 [&_h2]:mb-2
                  [&_h3]:text-zinc-100 [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2
                  [&_p]:text-zinc-300 [&_p]:leading-relaxed [&_p]:mb-4
                  [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ul]:space-y-1
                  [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4 [&_ol]:space-y-1
                  [&_li]:text-zinc-300
                  [&_table]:w-full [&_table]:border-collapse [&_table]:border [&_table]:border-zinc-700 [&_table]:mb-4
                  [&_th]:bg-zinc-800 [&_th]:text-zinc-200 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:border [&_th]:border-zinc-700 [&_th]:font-medium
                  [&_td]:px-3 [&_td]:py-2 [&_td]:border [&_td]:border-zinc-700 [&_td]:text-zinc-300
                  [&_a]:text-indigo-400 [&_a]:underline
                  [&_strong]:text-zinc-100 [&_strong]:font-semibold
                  [&_b]:text-zinc-100 [&_b]:font-semibold"
                dangerouslySetInnerHTML={{ __html: description || '<p class="text-zinc-500 italic">No shownotes available.</p>' }}
              />
            </div>
          </div>
        </div>

        {/* Art Preview */}
        {displayArt && (
          <div className="border border-zinc-800 bg-zinc-900/50 rounded-xl p-6">
            <Label className="text-sm font-medium text-zinc-300 mb-4 block">Episode Art</Label>
            <div className="flex justify-center">
              <div className="aspect-square w-64 rounded-lg overflow-hidden border-2 border-zinc-700 shadow-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={displayArt} alt="Episode Art" className="object-cover w-full h-full" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT: Publishing Controls */}
      <div className="space-y-6">

        {/* Publish Mode Badge */}
        <div className={`border rounded-xl p-4 ${publishMode === 'podcast-only' ? 'border-indigo-500/30 bg-indigo-950/20' : 'border-red-500/30 bg-red-950/20'}`}>
          <div className="flex items-center gap-2 mb-1">
            {publishMode === 'podcast-only' ? (
              <Podcast className="h-4 w-4 text-indigo-400" />
            ) : (
              <Video className="h-4 w-4 text-red-400" />
            )}
            <span className="text-sm font-semibold text-zinc-200">
              {publishMode === 'podcast-only' ? 'Podcast Feed Only' : 'Full Pipeline'}
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            {publishMode === 'podcast-only' 
              ? 'Publishing to Captivate podcast feed only.' 
              : 'Publishing to Captivate + Zernio/YouTube.'}
          </p>
        </div>

        {/* Season & Episode Numbers */}
        <div className="border border-zinc-800 bg-zinc-900/50 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-indigo-400" />
            Episode Metadata
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-zinc-400 mb-1 block">Season #</Label>
              <Input 
                type="number" 
                min={1}
                value={episodeSeason ?? ''} 
                onChange={(e) => setEpisodeSeason(e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="1"
                className="bg-zinc-950 border-zinc-800 text-zinc-100 focus-visible:ring-indigo-500"
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-400 mb-1 block">Episode #</Label>
              <Input 
                type="number" 
                min={1}
                value={episodeNumber ?? ''} 
                onChange={(e) => setEpisodeNumber(e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="1"
                className="bg-zinc-950 border-zinc-800 text-zinc-100 focus-visible:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Publish Status */}
        <div className="border border-zinc-800 bg-zinc-900/50 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-indigo-400" />
            Publish Options
          </h3>
          <div className="space-y-3">
            {(['Draft', 'Scheduled', 'Published'] as PublishStatus[]).map((option) => (
              <label 
                key={option}
                className={`flex items-center space-x-3 border ${status === option ? 'border-indigo-500 bg-indigo-500/10' : 'border-zinc-800 bg-zinc-950'} rounded-md p-3 hover:bg-zinc-900 transition-colors cursor-pointer`}
              >
                <input
                  type="radio"
                  name="publishStatus"
                  value={option}
                  checked={status === option}
                  onChange={() => setStatus(option)}
                  className="h-4 w-4 text-indigo-600 border-zinc-700 bg-zinc-900 focus:ring-indigo-600"
                />
                <div>
                  <div className="font-medium text-zinc-200 text-sm">
                    {option === 'Published' ? 'Publish Now' : option}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {option === 'Draft' && 'Save to Captivate as a draft'}
                    {option === 'Scheduled' && 'Schedule for a future date & time'}
                    {option === 'Published' && 'Publish immediately to your podcast feed'}
                  </div>
                </div>
              </label>
            ))}
          </div>

          {/* Schedule Date/Time - only when Scheduled */}
          {status === 'Scheduled' && (
            <div className="space-y-3 pt-2 border-t border-zinc-800 mt-3">
              <div>
                <Label className="text-xs text-zinc-400 mb-1 block">Publish Date</Label>
                <Input 
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-zinc-100 focus-visible:ring-indigo-500"
                />
              </div>
              <div>
                <Label className="text-xs text-zinc-400 mb-1 block">Publish Time</Label>
                <Input 
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="bg-zinc-950 border-zinc-800 text-zinc-100 focus-visible:ring-indigo-500"
                />
              </div>
              {(!scheduleDate || !scheduleTime) && (
                <div className="flex items-center gap-1.5 text-amber-400 text-xs pt-1">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  <span>Please select both a date and time to enable scheduling.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <Button 
          onClick={handleSubmit} 
          disabled={isSubmitting || (status === 'Scheduled' && (!scheduleDate || !scheduleTime))}
          className={`w-full py-6 font-bold text-white shadow-lg ${
            status === 'Published' 
              ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' 
              : status === 'Scheduled'
                ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20'
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'
          }`}
        >
          {isSubmitting ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Dispatching to Captivate...</>
          ) : (
            <>
              {status === 'Draft' && 'Save as Draft'}
              {status === 'Scheduled' && 'Schedule Episode'}
              {status === 'Published' && 'Publish Now'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
