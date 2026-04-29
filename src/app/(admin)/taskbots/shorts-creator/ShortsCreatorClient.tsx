'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Video, CheckCircle2, XCircle, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { 
  startShortsGeneration, 
  pollShortsTask, 
  getGeneratedShorts, 
  exportShort, 
  pollExportStatus, 
  saveApprovedShort, 
  publishShortToZernio 
} from '@/lib/actions/shorts-actions';

type Phase = 'INIT' | 'PROCESSING' | 'REVIEW' | 'EXPORTING' | 'PUBLISHING' | 'DONE';

export function ShortsCreatorClient({ episode }: { episode: any }) {
  const [phase, setPhase] = useState<Phase>('INIT');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(episode.klap_folder_id || null);
  const [shorts, setShorts] = useState<any[]>([]);
  const [activeShort, setActiveShort] = useState<any | null>(null);
  
  // Start flow on mount if we don't already have a folder ID
  useEffect(() => {
    if (folderId) {
      setPhase('REVIEW');
      loadShorts(folderId);
    } else {
      initiateGeneration();
    }
  }, [folderId]);

  const initiateGeneration = async () => {
    setPhase('PROCESSING');
    try {
      const id = await startShortsGeneration(episode.id);
      setTaskId(id);
      pollForCompletion(id);
    } catch (e: any) {
      toast.error(`Failed to start generation: ${e.message}`);
      setPhase('INIT');
    }
  };

  const pollForCompletion = async (id: string) => {
    try {
      const res = await pollShortsTask(id, episode.id);
      if (res.status === 'completed' || res.status === 'done') {
        setFolderId(res.folderId!);
        loadShorts(res.folderId!);
        setPhase('REVIEW');
      } else if (res.status === 'error' || res.status === 'failed') {
        toast.error('Klap processing failed.');
        setPhase('INIT');
      } else {
        // Continue polling every 15 seconds
        setTimeout(() => pollForCompletion(id), 15000);
      }
    } catch (e) {
      console.error(e);
      setTimeout(() => pollForCompletion(id), 15000);
    }
  };

  const loadShorts = async (fId: string) => {
    try {
      const projects = await getGeneratedShorts(fId);
      // Sort by virality score descending
      const sorted = projects.sort((a: any, b: any) => (b.virality_score || 0) - (a.virality_score || 0));
      setShorts(sorted);
    } catch (e: any) {
      toast.error(`Failed to load generated shorts: ${e.message}`);
    }
  };

  const handleApprove = async (short: any) => {
    setActiveShort(short);
    setPhase('EXPORTING');
    try {
      const exportId = await exportShort(folderId!, short.id);
      pollForExport(exportId, short);
    } catch (e: any) {
      toast.error(`Failed to start export: ${e.message}`);
      setPhase('REVIEW');
    }
  };

  const pollForExport = async (eId: string, short: any) => {
    try {
      const res = await pollExportStatus(folderId!, short.id, eId);
      if (res.status === 'completed' || res.status === 'done') {
        setPhase('PUBLISHING');
        toast.success("Export complete! Publishing to platforms...");
        await doPublish(short.id, res.src_url, short.name);
      } else if (res.status === 'error' || res.status === 'failed') {
        toast.error('Klap export failed.');
        setPhase('REVIEW');
      } else {
        setTimeout(() => pollForExport(eId, short), 10000);
      }
    } catch (e) {
      console.error(e);
      setTimeout(() => pollForExport(eId, short), 10000);
    }
  };

  const doPublish = async (projectId: string, videoUrl: string, klapName: string) => {
    try {
      // Save the short and get AI metadata
      const { description, short } = await saveApprovedShort(episode.id, projectId, videoUrl, klapName);
      
      // Publish to Zernio
      await publishShortToZernio(episode.id, short.id, short.title, description, videoUrl, ['youtube']);
      
      setPhase('DONE');
      toast.success("Short successfully published!");
    } catch (e: any) {
      toast.error(`Publishing failed: ${e.message}`);
      setPhase('REVIEW');
    }
  };

  return (
    <div className="space-y-6">
      {phase === 'INIT' && (
        <div className="text-center py-12">
          <Button onClick={initiateGeneration} className="bg-fuchsia-600 hover:bg-fuchsia-500">
            <Video className="w-4 h-4 mr-2" />
            Start AI Generation
          </Button>
        </div>
      )}

      {phase === 'PROCESSING' && (
        <div className="flex flex-col items-center justify-center space-y-4 py-20 border border-zinc-800 rounded-xl bg-zinc-900/30">
          <Loader2 className="w-12 h-12 text-fuchsia-500 animate-spin" />
          <h3 className="text-xl font-medium text-zinc-100">Klap AI is analyzing your video...</h3>
          <p className="text-zinc-400">This can take up to 10 minutes depending on video length. You can safely leave this page and come back later.</p>
        </div>
      )}

      {phase === 'REVIEW' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shorts.map((short) => (
            <div key={short.id} className="border border-zinc-800 rounded-xl bg-zinc-900/50 overflow-hidden flex flex-col">
              <div className="aspect-[9/16] w-full bg-black relative">
                <iframe 
                  src={`https://klap.app/player/${short.id}`}
                  className="absolute inset-0 w-full h-full border-0"
                  allowFullScreen
                />
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <h4 className="font-medium text-zinc-100">{short.name || 'Generated Short'}</h4>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs bg-fuchsia-500/20 text-fuchsia-400 px-2 py-1 rounded border border-fuchsia-500/30">
                      Score: {short.virality_score}/100
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline" 
                    className="border-zinc-700 hover:bg-zinc-800 text-zinc-300"
                    onClick={() => setShorts(shorts.filter(s => s.id !== short.id))}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                  <Button 
                    className="bg-emerald-600 hover:bg-emerald-500 text-white"
                    onClick={() => handleApprove(short)}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {shorts.length === 0 && (
            <div className="col-span-full py-12 text-center text-zinc-400 border border-zinc-800 border-dashed rounded-xl">
              No shorts found. Try generating again or check your Klap dashboard.
            </div>
          )}
        </div>
      )}

      {(phase === 'EXPORTING' || phase === 'PUBLISHING') && (
        <div className="flex flex-col items-center justify-center space-y-4 py-20 border border-zinc-800 rounded-xl bg-zinc-900/30">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
          <h3 className="text-xl font-medium text-zinc-100">
            {phase === 'EXPORTING' ? 'Rendering final video without watermarks...' : 'Generating AI metadata and publishing to Zernio...'}
          </h3>
          <p className="text-zinc-400 text-center max-w-md">
            {phase === 'EXPORTING' 
              ? 'Klap is processing the high-quality export. This usually takes a minute.'
              : 'Our AI is writing viral descriptions and syncing with your YouTube Shorts integration.'}
          </p>
        </div>
      )}

      {phase === 'DONE' && (
        <div className="flex flex-col items-center justify-center space-y-4 py-20 border border-emerald-900/30 rounded-xl bg-emerald-900/10">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-2">
            <Share2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h3 className="text-2xl font-medium text-zinc-100">Short Successfully Published!</h3>
          <p className="text-zinc-400">The short has been exported and dispatched to your connected channels.</p>
          <Button className="mt-4 bg-zinc-800 hover:bg-zinc-700" onClick={() => setPhase('REVIEW')}>
            Review More Shorts
          </Button>
        </div>
      )}
    </div>
  );
}
