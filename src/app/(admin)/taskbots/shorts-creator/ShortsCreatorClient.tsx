'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Video, CheckCircle2, XCircle, Share2, ArrowLeft, Play, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { 
  startShortsGeneration, 
  startStandaloneShortsGeneration,
  pollShortsTask, 
  getGeneratedShorts, 
  exportShort, 
  pollExportStatus, 
  saveApprovedShort, 
  publishShortToZernio 
} from '@/lib/actions/shorts-actions';

type Phase = 'INIT' | 'PROCESSING' | 'REVIEW' | 'EXPORTING' | 'PREVIEW' | 'PUBLISHING' | 'DONE';

export function ShortsCreatorClient({ episode, shows }: { episode?: any, shows?: any[] }) {
  const [phase, setPhase] = useState<Phase>('INIT');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(episode?.klap_folder_id || null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [shorts, setShorts] = useState<any[]>([]);
  const [activeShort, setActiveShort] = useState<any | null>(null);
  
  // Preview state
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string>('');
  const [previewTitle, setPreviewTitle] = useState<string>('');
  const [previewDescription, setPreviewDescription] = useState<string>('');
  const [savedShortRecord, setSavedShortRecord] = useState<any>(null);
  
  // Start flow on mount if we don't already have a folder ID
  useEffect(() => {
    if (folderId) {
      setPhase('REVIEW');
      loadShorts(folderId);
    }
  }, []);

  const initiateGeneration = async () => {
    if (!episode && !videoUrl) {
      toast.error('Please provide a Video URL for standalone generation.');
      return;
    }
    setPhase('PROCESSING');
    try {
      let id;
      if (episode) {
        id = await startShortsGeneration(episode.id);
      } else {
        id = await startStandaloneShortsGeneration(videoUrl);
      }
      setTaskId(id);
      pollForCompletion(id);
    } catch (e: any) {
      toast.error(`Failed to start generation: ${e.message}`);
      setPhase('INIT');
    }
  };

  const pollForCompletion = async (id: string) => {
    try {
      const res = await pollShortsTask(id, episode?.id || 'guest');
      if (res.status === 'ready' || res.status === 'completed' || res.status === 'done') {
        setFolderId(res.folderId!);
        loadShorts(res.folderId!);
        setPhase('REVIEW');
      } else if (res.status === 'error' || res.status === 'failed') {
        toast.error('Klap processing failed.');
        setPhase('INIT');
      } else {
        setTimeout(() => pollForCompletion(id), 15000);
      }
    } catch (e) {
      console.error(e);
      setTimeout(() => pollForCompletion(id), 15000);
    }
  };

  const loadShorts = async (fId: string) => {
    try {
      const projects = await getGeneratedShorts(fId, episode?.id || 'guest');
      const sorted = (Array.isArray(projects) ? projects : []).sort(
        (a: any, b: any) => (b.virality_score || 0) - (a.virality_score || 0)
      );
      setShorts(sorted);
    } catch (e: any) {
      toast.error(`Failed to load generated shorts: ${e.message}`);
    }
  };

  const handleExport = async (short: any) => {
    setActiveShort(short);
    setPhase('EXPORTING');
    try {
      const exportResult = await exportShort(folderId!, short.id);
      pollForExport(exportResult.id || exportResult, short);
    } catch (e: any) {
      toast.error(`Failed to start export: ${e.message}`);
      setPhase('REVIEW');
    }
  };

  const pollForExport = async (eId: string, short: any) => {
    let res: any;
    try {
      res = await pollExportStatus(folderId!, short.id, eId);
    } catch (e) {
      // Network/poll error — retry
      console.error('Export poll error:', e);
      setTimeout(() => pollForExport(eId, short), 10000);
      return;
    }

    if (res.status === 'ready' || res.status === 'completed' || res.status === 'done') {
      toast.success("Export complete! Generating AI metadata...");
      try {
        const { description, short: savedShort } = await saveApprovedShort(
          episode?.id || 'guest', short.id, res.src_url, short.name
        );
        setPreviewVideoUrl(res.src_url);
        setPreviewTitle(savedShort.title || short.name || '');
        setPreviewDescription(description || '');
        setSavedShortRecord(savedShort);
        setPhase('PREVIEW');
      } catch (metaErr: any) {
        console.error('Metadata generation failed:', metaErr);
        // Still show preview with basic info — don't loop
        setPreviewVideoUrl(res.src_url);
        setPreviewTitle(short.name || 'Untitled Short');
        setPreviewDescription('');
        setSavedShortRecord(null);
        toast.error(`AI metadata failed: ${metaErr.message}. You can edit manually.`);
        setPhase('PREVIEW');
      }
    } else if (res.status === 'error' || res.status === 'failed') {
      toast.error('Klap export failed.');
      setPhase('REVIEW');
    } else {
      setTimeout(() => pollForExport(eId, short), 10000);
    }
  };

  const handlePublish = async () => {
    if (!savedShortRecord?.id) {
      toast.error('No saved short record. Please try exporting again.');
      setPhase('REVIEW');
      return;
    }
    if (!episode) {
      toast.info('Publish routing will be connected in Phase 3. For now, use the download link.');
      return;
    }
    setPhase('PUBLISHING');
    try {
      await publishShortToZernio(
        episode.id,
        savedShortRecord.id,
        previewTitle,
        previewDescription,
        previewVideoUrl,
        ['youtube']
      );
      setPhase('DONE');
      toast.success("Short successfully published!");
    } catch (e: any) {
      toast.error(`Publishing failed: ${e.message}`);
      setPhase('PREVIEW');
    }
  };

  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      
      const fileExt = file.name.split('.').pop();
      const fileName = `guest-video-${Date.now()}.${fileExt}`;
      const filePath = `references/${fileName}`; 

      const { error: uploadError } = await supabase.storage
        .from('episodes_bucket')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('episodes_bucket')
        .getPublicUrl(filePath);

      if (!data.publicUrl) throw new Error('Failed to generate public URL');

      setVideoUrl(data.publicUrl);
      toast.success('Video uploaded successfully!');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to upload video: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {phase === 'INIT' && (
        <div className="flex flex-col items-center justify-center py-12">
          {!episode && (
            <div className="w-full max-w-md space-y-4 mb-8 p-6 border border-zinc-800 rounded-xl bg-zinc-900/50">
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center">
                <Video className="w-4 h-4 mr-2 text-fuchsia-400" />
                Standalone Mode
              </h3>
              <div className="space-y-2">
                <Label className="text-zinc-400 text-xs">Video Download URL or Upload (MP4)</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://..."
                    className="bg-zinc-950 border-zinc-800 focus-visible:ring-fuchsia-500 flex-1"
                  />
                  <div className="relative">
                    <input
                      type="file"
                      accept="video/mp4,video/x-m4v,video/*"
                      onChange={handleFileUpload}
                      disabled={isUploading}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="border-zinc-700 hover:bg-zinc-800"
                      disabled={isUploading}
                    >
                      {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Upload'}
                    </Button>
                  </div>
                </div>
                <p className="text-[10px] text-zinc-500">Provide a direct link to a video file, or upload one directly for Klap to process.</p>
              </div>
            </div>
          )}
          
          <Button onClick={initiateGeneration} disabled={!episode && !videoUrl} className="bg-fuchsia-600 hover:bg-fuchsia-500 py-6 px-8 font-semibold shadow-lg shadow-fuchsia-500/20">
            <Video className="w-5 h-5 mr-2" />
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
              {/* Visual Header */}
              <div className="bg-gradient-to-br from-fuchsia-950/60 to-zinc-900 p-6 flex flex-col items-center justify-center min-h-[180px] border-b border-zinc-800">
                <div className="w-16 h-16 rounded-full bg-fuchsia-500/20 border border-fuchsia-500/30 flex items-center justify-center mb-3">
                  <Video className="w-7 h-7 text-fuchsia-400" />
                </div>
                <h4 className="font-semibold text-zinc-100 text-center text-sm leading-snug px-2">{short.name || 'Generated Short'}</h4>
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-fuchsia-500/20 text-fuchsia-400 px-2 py-1 rounded border border-fuchsia-500/30 font-semibold">
                      Virality: {Math.round((short.virality_score || 0) * 100)}%
                    </span>
                  </div>
                  {short.virality_score_explanation && (
                    <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">
                      {short.virality_score_explanation}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    className="border-zinc-700 hover:bg-zinc-800 text-zinc-300"
                    onClick={() => setShorts(shorts.filter(s => s.id !== short.id))}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                  <Button 
                    className={short.is_exported ? "bg-zinc-800 text-emerald-400" : "bg-emerald-600 hover:bg-emerald-500 text-white"}
                    onClick={() => handleExport(short)}
                    disabled={short.is_exported}
                  >
                    {short.is_exported ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                    {short.is_exported ? 'Published' : 'Export'}
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

      {phase === 'EXPORTING' && (
        <div className="flex flex-col items-center justify-center space-y-4 py-20 border border-zinc-800 rounded-xl bg-zinc-900/30">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
          <h3 className="text-xl font-medium text-zinc-100">Rendering final video...</h3>
          <p className="text-zinc-400 text-center max-w-md">
            Klap is processing the high-quality export. This usually takes a minute or two.
          </p>
        </div>
      )}

      {/* PREVIEW PHASE: Video Player + Editable AI Metadata */}
      {phase === 'PREVIEW' && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300" onClick={() => setPhase('REVIEW')}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Shorts
            </Button>
            <h3 className="text-lg font-semibold text-zinc-100">Preview & Publish</h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Video Player */}
            <div className="border border-zinc-800 rounded-xl bg-zinc-900/50 overflow-hidden">
              <div className="aspect-[9/16] max-h-[500px] bg-black flex items-center justify-center">
                <video
                  src={previewVideoUrl}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            {/* Right: Editable Metadata + Publish Controls */}
            <div className="space-y-5">
              <div className="border border-zinc-800 rounded-xl bg-zinc-900/50 p-5 space-y-4">
                <h4 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-fuchsia-400" />
                  AI-Generated Metadata
                </h4>

                <div>
                  <Label className="text-xs text-zinc-400 mb-1.5 block">YouTube Short Title</Label>
                  <Input
                    value={previewTitle}
                    onChange={(e) => setPreviewTitle(e.target.value)}
                    className="bg-zinc-950 border-zinc-800 text-zinc-100 focus-visible:ring-fuchsia-500 font-semibold"
                  />
                </div>

                <div>
                  <Label className="text-xs text-zinc-400 mb-1.5 block">YouTube Short Description</Label>
                  <textarea
                    value={previewDescription}
                    onChange={(e) => setPreviewDescription(e.target.value)}
                    rows={6}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-3 text-sm text-zinc-300 resize-none focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                  />
                </div>
              </div>

              <div className={`grid ${episode ? 'grid-cols-2' : 'grid-cols-2'} gap-3`}>
                <Button
                  variant="outline"
                  className="border-zinc-700 hover:bg-zinc-800 text-zinc-300 py-5"
                  onClick={() => setPhase('REVIEW')}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Discard
                </Button>
                {episode ? (
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-500 text-white py-5 font-bold shadow-lg shadow-emerald-500/20"
                    onClick={handlePublish}
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Publish to Zernio
                  </Button>
                ) : (
                  <Button
                    className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white py-5 font-bold shadow-lg shadow-fuchsia-500/20"
                    onClick={() => {
                      const a = document.createElement('a');
                      a.href = previewVideoUrl;
                      a.target = '_blank';
                      a.download = `short-${Date.now()}.mp4`;
                      a.click();
                    }}
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Download Video
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {phase === 'PUBLISHING' && (
        <div className="flex flex-col items-center justify-center space-y-4 py-20 border border-zinc-800 rounded-xl bg-zinc-900/30">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
          <h3 className="text-xl font-medium text-zinc-100">Publishing to YouTube Shorts...</h3>
          <p className="text-zinc-400 text-center max-w-md">
            Syncing with your Zernio-connected YouTube account.
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
          <Button className="mt-4 bg-zinc-800 hover:bg-zinc-700" onClick={() => {
            setPhase('REVIEW');
            if (folderId) loadShorts(folderId);
          }}>
            Review More Shorts
          </Button>
        </div>
      )}
    </div>
  );
}
