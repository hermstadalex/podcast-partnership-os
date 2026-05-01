'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Wand2, Copy, CheckCircle2, ExternalLink, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export function ShownotesCreatorClient({ shows, initialEpisodeId }: { shows: any[], initialEpisodeId?: string }) {
  const router = useRouter();
  const [selectedShowId, setSelectedShowId] = useState<string>('guest');
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [context, setContext] = useState<string>('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [generatedShownotes, setGeneratedShownotes] = useState('');
  const [generatedHashtags, setGeneratedHashtags] = useState('');
  
  const [copied, setCopied] = useState<'title' | 'shownotes' | 'hashtags' | null>(null);

  const [isUploading, setIsUploading] = useState(false);

  const handleGenerate = async () => {
    if (!mediaUrl && !context) {
      toast.error('Please provide a media URL or some context to generate shownotes.');
      return;
    }

    setIsGenerating(true);
    try {
      // In a real implementation, this would call our API route to process the media/context via Gemini
      // For Phase 1, we will simulate the API call to establish the UI structure
      const response = await fetch('/api/taskbots/shownotes-creator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          showId: selectedShowId,
          mediaUrl,
          context
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate shownotes');
      }

      setGeneratedTitle(data.title || 'Generated Episode Title');
      setGeneratedShownotes(data.shownotes || '<p>Generated shownotes HTML goes here.</p>');
      setGeneratedHashtags(data.hashtags || '#podcast #generated #viral');
      
      toast.success('Shownotes generated successfully!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'An error occurred during generation.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      
      const fileExt = file.name.split('.').pop();
      const fileName = `guest-media-${Date.now()}.${fileExt}`;
      const filePath = `references/${fileName}`; // Using references folder since it's temporary guest media

      const { error: uploadError } = await supabase.storage
        .from('episodes_bucket')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('episodes_bucket')
        .getPublicUrl(filePath);

      if (!data.publicUrl) throw new Error('Failed to generate public URL');

      setMediaUrl(data.publicUrl);
      toast.success('Media uploaded successfully!');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to upload media: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCopy = (type: 'title' | 'shownotes' | 'hashtags', text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} copied to clipboard!`);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      
      {/* INPUT */}
      <div className="border border-zinc-800 bg-zinc-900/50 rounded-xl p-6">
        <div className="mb-6 border-b border-zinc-800 pb-4">
          <h2 className="text-lg font-bold text-zinc-100 flex items-center">
            <Wand2 className="h-5 w-5 mr-2 text-cyan-400" />
            Input Context
          </h2>
          <p className="text-zinc-400 text-sm mt-1">Provide the raw material for Gemini to analyze.</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <Label>Target Show (Optional)</Label>
            <select
              className="w-full h-10 px-3 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              value={selectedShowId}
              onChange={(e) => setSelectedShowId(e.target.value)}
            >
              <option value="guest">Guest Mode (Standalone)</option>
              {shows.map((show) => (
                <option key={show.id} value={show.id}>
                  {show.title}
                </option>
              ))}
            </select>
            <p className="text-xs text-zinc-500">Selecting a show helps tailor the branding and tone.</p>
          </div>

          <div className="space-y-3">
            <Label>Media URL or Upload</Label>
            <div className="flex items-center gap-2">
              <Input 
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="e.g. https://storage.googleapis.com/.../audio.mp3" 
                className="bg-zinc-950 border-zinc-800 text-zinc-100 focus-visible:ring-cyan-500 flex-1"
              />
              <div className="relative">
                <input
                  type="file"
                  accept="audio/*,video/*"
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
          </div>

          <div className="space-y-3">
            <Label>Additional Context / Rough Notes</Label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Any specific talking points, guest names, or ideas you want included?"
              className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-md p-3 text-sm text-zinc-100 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating || (!mediaUrl && !context)} 
            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-6"
          >
            {isGenerating ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Analyzing with Gemini...</>
            ) : (
              <><Wand2 className="mr-2 h-5 w-5" /> Generate Metadata</>
            )}
          </Button>
        </div>
      </div>

      {/* OUTPUT */}
      <div className="border border-zinc-800 bg-zinc-900/50 rounded-xl p-6 flex flex-col h-full min-h-[600px]">
        <div className="mb-6 border-b border-zinc-800 pb-4">
          <h2 className="text-lg font-bold text-zinc-100 flex items-center">
            <FileText className="h-5 w-5 mr-2 text-cyan-400" />
            Generated Output
          </h2>
          <p className="text-zinc-400 text-sm mt-1">Review, copy, or proceed to publish.</p>
        </div>

        {isGenerating ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-12 h-12 text-cyan-500 animate-spin" />
            <p className="text-zinc-400 font-mono text-sm">Processing audio and drafting content...</p>
          </div>
        ) : generatedTitle ? (
          <div className="flex-1 space-y-6 overflow-y-auto pr-2">
            
            {/* Title Output */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-zinc-300">Viral Title</Label>
                <Button variant="ghost" size="sm" className="h-6 text-xs text-zinc-400 hover:text-zinc-100" onClick={() => handleCopy('title', generatedTitle)}>
                  {copied === 'title' ? <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-400" /> : <Copy className="w-3 h-3 mr-1" />}
                  Copy
                </Button>
              </div>
              <Input 
                value={generatedTitle}
                onChange={(e) => setGeneratedTitle(e.target.value)}
                className="bg-zinc-950 border-zinc-800 font-semibold text-lg text-zinc-100 focus-visible:ring-cyan-500"
              />
            </div>

            {/* HTML Shownotes Output */}
            <div className="space-y-2 flex-1 flex flex-col min-h-[300px]">
              <div className="flex items-center justify-between">
                <Label className="text-zinc-300">HTML Shownotes</Label>
                <Button variant="ghost" size="sm" className="h-6 text-xs text-zinc-400 hover:text-zinc-100" onClick={() => handleCopy('shownotes', generatedShownotes)}>
                  {copied === 'shownotes' ? <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-400" /> : <Copy className="w-3 h-3 mr-1" />}
                  Copy HTML
                </Button>
              </div>
              <textarea
                value={generatedShownotes}
                onChange={(e) => setGeneratedShownotes(e.target.value)}
                className="flex-1 w-full bg-zinc-950 border border-zinc-800 rounded-md p-4 font-mono text-xs text-zinc-300 resize-none focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            {/* Hashtags Output */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-zinc-300">Viral Hashtags</Label>
                <Button variant="ghost" size="sm" className="h-6 text-xs text-zinc-400 hover:text-zinc-100" onClick={() => handleCopy('hashtags', generatedHashtags)}>
                  {copied === 'hashtags' ? <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-400" /> : <Copy className="w-3 h-3 mr-1" />}
                  Copy
                </Button>
              </div>
              <Input 
                value={generatedHashtags}
                onChange={(e) => setGeneratedHashtags(e.target.value)}
                className="bg-zinc-950 border-zinc-800 text-zinc-100 focus-visible:ring-cyan-500"
              />
            </div>
            
            {/* Proceed Action */}
            <div className="pt-6 border-t border-zinc-800 mt-6">
               <div className="bg-cyan-950/30 border border-cyan-500/20 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold text-cyan-300 text-sm flex items-center">
                    <ExternalLink className="h-4 w-4 mr-2" /> Next Step
                  </h3>
                  <p className="text-zinc-400 text-xs mt-1">
                    You can copy these outputs directly, or assign them to an episode for full publishing.
                  </p>
                </div>
                <Button 
                  onClick={() => toast.info('Publish routing will be connected in Phase 3.')}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 py-6 text-white font-bold"
                >
                  Publish via Zernio Wrapper
                </Button>
            </div>

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
            <FileText className="h-16 w-16 opacity-20 mb-4" />
            <p>Awaiting input to generate metadata.</p>
          </div>
        )}
      </div>

    </div>
  );
}
