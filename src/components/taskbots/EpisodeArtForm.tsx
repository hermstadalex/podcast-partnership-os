'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { RefreshCw, Image as ImageIcon, Wand2, Download, Mic, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { updateShowMetadata } from '@/app/actions';

type Show = {
  id: string;
  title: string;
  cover_art?: string | null;
  youtube_reference_art?: string | null;
  podcast_reference_art?: string | null;
};

export function EpisodeArtForm({ shows }: { shows: Show[] }) {
  const [selectedShowId, setSelectedShowId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [format, setFormat] = useState('youtube-thumbnail');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  
  // Local state to track updates optimistically without full refresh
  const [localShows, setLocalShows] = useState<Show[]>(shows);

  const activeShow = localShows.find(s => s.id === selectedShowId);
  const activeReferenceUrl = format === 'youtube-thumbnail' 
      ? activeShow?.youtube_reference_art 
      : activeShow?.podcast_reference_art;

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

      // Persist to database
      await updateShowMetadata(activeShow.id, updatePayload);

      // Optimistic update
      setLocalShows(prev => prev.map(s => {
        if (s.id === activeShow.id) {
           return { ...s, ...updatePayload };
        }
        return s;
      }));

      toast.success('Reference image uploaded and saved successfully! You can now generate art.');
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
    try {
      const response = await fetch('/api/taskbots/episode-art', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          showId: selectedShowId,
          title,
          format
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate image');
      }

      setGeneratedImageUrl(data.imageUrl);
      toast.success('Episode art generated successfully!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'An error occurred during generation.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedImageUrl) return;
    const a = document.createElement('a');
    a.href = generatedImageUrl;
    a.download = `${title.replace(/\s+/g, '-').toLowerCase()}-${format}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
          </div>

          {!activeShow && (
             <div className="p-4 rounded-md border border-zinc-800 bg-zinc-950/50 text-sm text-zinc-400">
               Select a show to view reference configurations.
             </div>
          )}

          {activeShow && !activeReferenceUrl && (
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
          
          {activeShow && activeReferenceUrl && (
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
            disabled={isGenerating || !selectedShowId || !title || !activeReferenceUrl} 
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
          <p className="text-zinc-400 text-sm mt-1">Review the final generated asset.</p>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center min-h-[300px]">
          {isGenerating ? (
            <div className="animate-pulse flex flex-col items-center">
               <div className="h-48 w-64 bg-zinc-800 rounded-xl mb-4 border border-zinc-700 flex items-center justify-center">
                 <Mic className="h-8 w-8 text-zinc-600 animate-bounce" />
               </div>
               <div className="text-zinc-400 text-sm animate-pulse font-mono">calling Gemini Nano Banana API...</div>
            </div>
          ) : generatedImageUrl ? (
            <div className="w-full h-full flex flex-col items-center justify-center space-y-6">
              <div className={`relative ${format === 'youtube-thumbnail' ? 'aspect-video w-full' : 'aspect-square max-h-[300px]'} rounded-lg overflow-hidden border-2 border-zinc-700 shadow-2xl`}>
                 {/* eslint-disable-next-line @next/next/no-img-element */}
                 <img src={generatedImageUrl} alt="Generated Episode Art" className="object-cover w-full h-full" />
              </div>
              <div className="flex gap-4 w-full">
                 <Button onClick={handleGenerate} variant="outline" className="flex-1 border-zinc-700 bg-zinc-950 hover:bg-zinc-800 text-zinc-300">
                   <RefreshCw className="mr-2 h-4 w-4" /> Re-roll
                 </Button>
                 <Button onClick={handleDownload} className="flex-1 bg-white text-black hover:bg-zinc-200">
                   <Download className="mr-2 h-4 w-4" /> Download
                 </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-zinc-500 space-y-4">
              <ImageIcon className="h-16 w-16 opacity-20" />
              <p>Awaiting Phase 1 Input to run production model.</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
