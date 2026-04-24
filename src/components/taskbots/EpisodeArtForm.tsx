'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { RefreshCw, Image as ImageIcon, Wand2, Download, Mic, Upload, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { updateShowMetadata, dispatchEpisodePublish } from '@/app/actions';
import { useRouter } from 'next/navigation';

type Show = {
  id: string;
  title: string;
  cover_art?: string | null;
  youtube_reference_art?: string | null;
  podcast_reference_art?: string | null;
};

export function EpisodeArtForm({ shows, initialDraft, autoRun }: { shows: Show[], initialDraft?: any, autoRun?: boolean }) {
  const router = useRouter();
  const [selectedShowId, setSelectedShowId] = useState<string>(initialDraft?.show_id || '');
  const [title, setTitle] = useState(initialDraft?.title || '');
  const [format, setFormat] = useState('podcast-art');
  const [generateBoth, setGenerateBoth] = useState(!!initialDraft); 
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [generatedImages, setGeneratedImages] = useState<{ podcast?: string, youtube?: string }>({});
  
  // Ref to track if autorun has already fired to prevent strict mode double-firing
  const autoRunFired = useRef(false);

  // Local state to track updates optimistically without full refresh
  const [localShows, setLocalShows] = useState<Show[]>(shows);

  const activeShow = localShows.find(s => s.id === selectedShowId);
  const activeReferenceUrl = format === 'youtube-thumbnail' 
      ? activeShow?.youtube_reference_art 
      : activeShow?.podcast_reference_art;

  useEffect(() => {
    if (autoRun && title && selectedShowId && !autoRunFired.current) {
      autoRunFired.current = true;
      handleGenerate();
    }
  }, [autoRun, title, selectedShowId]);

  const handleUploadReference = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeShow) return;

    setIsUploading(true);
    try {
      const supabase = createClient();
      const fileExt = file.name.split('.').pop();
      const fileName = `${activeShow.id}-${format}-${Date.now()}.${fileExt}`;
      const filePath = `references/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('episodes_bucket')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('episodes_bucket')
        .getPublicUrl(filePath);

      if (!data.publicUrl) throw new Error('Failed to generate public URL');

      const updatePayload = format === 'youtube-thumbnail'
        ? { youtube_reference_art: data.publicUrl }
        : { podcast_reference_art: data.publicUrl };

      await updateShowMetadata(activeShow.id, updatePayload);

      setLocalShows(prev => prev.map(s => {
        if (s.id === activeShow.id) {
           return { ...s, ...updatePayload };
        }
        return s;
      }));

      toast.success('Reference image uploaded and saved successfully!');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to upload image: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedShowId || !title) {
        toast.error('Please select a show and enter a title.');
        return;
    }

    setIsGenerating(true);
    const formatsToRun = generateBoth ? ['podcast-art', 'youtube-thumbnail'] : [format];
    const newImages = { ...generatedImages };

    try {
      for (const targetFormat of formatsToRun) {
        // Only run if the show has a reference image for this format
        const targetRef = targetFormat === 'youtube-thumbnail' 
          ? activeShow?.youtube_reference_art 
          : activeShow?.podcast_reference_art;
        
        if (!targetRef) {
          toast.warning(`Skipping ${targetFormat}: No reference template configured.`);
          continue;
        }

        const response = await fetch('/api/taskbots/episode-art', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            showId: selectedShowId,
            title,
            format: targetFormat
          })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Failed to generate ${targetFormat}`);

        if (targetFormat === 'podcast-art') newImages.podcast = data.imageUrl;
        if (targetFormat === 'youtube-thumbnail') newImages.youtube = data.imageUrl;
      }
      
      setGeneratedImages(newImages);
      toast.success('Episode art generation sequence complete!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'An error occurred during generation.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = (url: string, suffix: string) => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '-').toLowerCase()}-${suffix}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePublishPipeline = async () => {
    if (!initialDraft?.id) return;
    setIsPublishing(true);
    try {
      await dispatchEpisodePublish(initialDraft.id);
      toast.success('Episode successfully dispatched to Captivate & Zernio!');
      router.push('/');
    } catch (err: any) {
      toast.error(`Publishing failed: ${err.message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      
      {/* PHASE 1: INPUT */}
      <div className="border border-zinc-800 bg-zinc-900/50 rounded-xl p-6">
        <div className="mb-6 border-b border-zinc-800 pb-4">
          <h2 className="text-lg font-bold text-zinc-100 flex items-center">
            <Wand2 className="h-5 w-5 mr-2 text-indigo-400" />
            Phase 1: Input Parameters
          </h2>
          <p className="text-zinc-400 text-sm mt-1">Configure your episode details below to generate specialized art.</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <Label>Target Show</Label>
            <select
              className="w-full h-10 px-3 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={selectedShowId}
              onChange={(e) => setSelectedShowId(e.target.value)}
              disabled={!!initialDraft} // Lock show if pipeline mapped
            >
              <option value="">-- Select a connected show --</option>
              {localShows.map((show) => (
                <option key={show.id} value={show.id}>
                  {show.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            <Label>Episode Title</Label>
            <Input 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The Future of AI in Podcasting" 
              className="bg-zinc-950 border-zinc-800 text-zinc-100 focus-visible:ring-indigo-500"
            />
          </div>

          <div className="space-y-3">
            <Label>Asset Format (Orientation)</Label>
            
            <div className="flex items-center space-x-2 py-2">
              <input 
                type="checkbox" 
                id="generateBoth" 
                checked={generateBoth}
                onChange={(e) => setGenerateBoth(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-900 text-indigo-600 focus:ring-indigo-600"
              />
              <label htmlFor="generateBoth" className="text-sm font-medium text-zinc-300">
                Generate Pipeline Sequence (Both 1:1 and 16:9 formats)
              </label>
            </div>

            {!generateBoth && (
              <div className="gap-4 flex flex-col">
                <label htmlFor="youtube" className={`flex items-center space-x-3 border ${format === 'youtube-thumbnail' ? 'border-indigo-500 bg-indigo-500/10' : 'border-zinc-800 bg-zinc-950'} rounded-md p-3 hover:bg-zinc-900 transition-colors cursor-pointer`}>
                  <input 
                    type="radio" 
                    id="youtube" 
                    name="format" 
                    value="youtube-thumbnail" 
                    checked={format === 'youtube-thumbnail'}
                    onChange={(e) => setFormat(e.target.value)}
                    className="h-4 w-4 text-indigo-600 border-zinc-700 bg-zinc-900 focus:ring-indigo-600 focus:ring-offset-zinc-950" 
                  />
                  <div className="flex-1">
                    <div className="font-medium text-zinc-200">YouTube Thumbnail</div>
                    <div className="text-xs text-zinc-500">16:9 Landscape</div>
                  </div>
                </label>
                
                <label htmlFor="podcast" className={`flex items-center space-x-3 border ${format === 'podcast-art' ? 'border-indigo-500 bg-indigo-500/10' : 'border-zinc-800 bg-zinc-950'} rounded-md p-3 hover:bg-zinc-900 transition-colors cursor-pointer`}>
                  <input 
                    type="radio" 
                    id="podcast" 
                    name="format" 
                    value="podcast-art" 
                    checked={format === 'podcast-art'}
                    onChange={(e) => setFormat(e.target.value)}
                    className="h-4 w-4 text-indigo-600 border-zinc-700 bg-zinc-900 focus:ring-indigo-600 focus:ring-offset-zinc-950" 
                  />
                  <div className="flex-1">
                    <div className="font-medium text-zinc-200">Podcast Square Art</div>
                    <div className="text-xs text-zinc-500">1:1 Square</div>
                  </div>
                </label>
              </div>
            )}
          </div>

          {!activeShow && (
             <div className="p-4 rounded-md border border-zinc-800 bg-zinc-950/50 text-sm text-zinc-400">
               Select a show to view reference configurations.
             </div>
          )}

          {activeShow && !activeReferenceUrl && !generateBoth && (
             <div className="p-5 rounded-md border-2 border-dashed border-zinc-700 bg-zinc-950 text-center">
                <Upload className="h-6 w-6 text-zinc-500 mx-auto mb-2" />
                <h3 className="text-sm font-medium text-zinc-200">Missing Template Reference</h3>
                <p className="text-xs text-zinc-500 mt-1 mb-4">You have not assigned a specific reference image for the {format === 'youtube-thumbnail' ? 'YouTube' : 'Podcast Square'} format. Upload one to proceed.</p>
                
                <Label htmlFor="upload-ref" className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 rounded-md cursor-pointer text-xs font-semibold inline-block transition-colors">
                  {isUploading ? 'Uploading...' : 'Upload Reference File'}
                </Label>
                <Input 
                   type="file" 
                   id="upload-ref" 
                   accept="image/*" 
                   className="hidden" 
                   onChange={handleUploadReference}
                   disabled={isUploading}
                />
             </div>
          )}
          
          {activeShow && activeReferenceUrl && !generateBoth && (
            <div className="flex items-center gap-3 p-3 rounded-md border border-zinc-800 bg-zinc-950/50">
               {/* eslint-disable-next-line @next/next/no-img-element */}
               <img src={activeReferenceUrl} alt="Base Art Preview" className={`h-12 border border-zinc-800 ${format === 'youtube-thumbnail' ? 'aspect-video object-cover' : 'aspect-square object-cover'} rounded-sm`} />
               <div className="flex-1">
                 <p className="text-sm font-medium text-zinc-200">Template Active</p>
                 <p className="text-xs text-zinc-500">Perfectly mapped configuration</p>
               </div>
            </div>
          )}

          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating || !selectedShowId || !title} 
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-6"
          >
            {isGenerating ? (
              <><RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Cooking in Phase 2...</>
            ) : (
              <><Wand2 className="mr-2 h-5 w-5" /> Generate Art</>
            )}
          </Button>
        </div>
      </div>

      {/* PHASE 3: OUTPUT */}
      <div className="border border-zinc-800 bg-zinc-900/50 rounded-xl p-6 flex flex-col">
        <div className="mb-6 border-b border-zinc-800 pb-4">
          <h2 className="text-lg font-bold text-zinc-100 flex items-center">
            <ImageIcon className="h-5 w-5 mr-2 text-indigo-400" />
            Phase 3: Output Render
          </h2>
          <p className="text-zinc-400 text-sm mt-1">Review the final generated assets before publishing.</p>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] space-y-6">
          {isGenerating && (
            <div className="animate-pulse flex flex-col items-center">
               <div className="h-48 w-64 bg-zinc-800 rounded-xl mb-4 border border-zinc-700 flex items-center justify-center">
                 <Mic className="h-8 w-8 text-zinc-600 animate-bounce" />
               </div>
               <div className="text-zinc-400 text-sm animate-pulse font-mono flex items-center">
                 calling Gemini Nano API...
               </div>
               {generateBoth && <span className="text-xs text-indigo-400 mt-2">(Running dual sequential pipeline)</span>}
            </div>
          )}

          {!isGenerating && (generatedImages.podcast || generatedImages.youtube) && (
            <div className="w-full flex justify-center gap-6 flex-wrap">
              {generatedImages.podcast && (
                <div className="flex-1 min-w-[200px] flex flex-col items-center space-y-4">
                  <div className="aspect-square w-full rounded-lg overflow-hidden border-2 border-zinc-700 shadow-2xl">
                    <img src={generatedImages.podcast} alt="Podcast Cover" className="object-cover w-full h-full" />
                  </div>
                  <Button onClick={() => handleDownload(generatedImages.podcast!, 'podcast')} className="w-full bg-white text-black hover:bg-zinc-200">
                    <Download className="mr-2 h-4 w-4" /> Download Square
                  </Button>
                </div>
              )}
              {generatedImages.youtube && (
                <div className="flex-1 min-w-[200px] flex flex-col items-center space-y-4">
                  <div className="aspect-video w-full rounded-lg overflow-hidden border-2 border-zinc-700 shadow-2xl">
                    <img src={generatedImages.youtube} alt="YouTube Thumb" className="object-cover w-full h-full" />
                  </div>
                  <Button onClick={() => handleDownload(generatedImages.youtube!, 'youtube')} className="w-full bg-white text-black hover:bg-zinc-200">
                    <Download className="mr-2 h-4 w-4" /> Download 16:9
                  </Button>
                </div>
              )}
            </div>
          )}

          {!isGenerating && !generatedImages.podcast && !generatedImages.youtube && (
            <div className="flex flex-col items-center justify-center text-zinc-500 space-y-4 h-full">
              <ImageIcon className="h-16 w-16 opacity-20" />
              <p>Awaiting Phase 1 Input to run production model.</p>
            </div>
          )}
        </div>

        {/* PIPELINE DISPATCH COMMAND */}
        {initialDraft && (generatedImages.podcast || generatedImages.youtube) && !isGenerating && (
          <div className="mt-8 pt-6 border-t border-zinc-800">
            <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-indigo-300 text-sm flex items-center">
                <ExternalLink className="h-4 w-4 mr-2" /> Pipeline Action Required
              </h3>
              <p className="text-zinc-400 text-xs mt-1">You have an unpublished Episode Draft loaded from the Publisher Wizard. After approving your visual assets above, finalize to dispatch to Captivate & Zernio.</p>
            </div>
            <Button 
              onClick={handlePublishPipeline} 
              disabled={isPublishing} 
              className="w-full bg-emerald-600 hover:bg-emerald-700 py-6 text-white font-bold"
            >
              {isPublishing ? 'Dispatching...' : 'Complete Publishing Pipeline'}
            </Button>
          </div>
        )}
      </div>

    </div>
  );
}
