'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSupabaseUpload } from '@/hooks/use-supabase-upload';
import { Dropzone, DropzoneEmptyState, DropzoneContent } from '@/components/dropzone';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Sparkles, Wand2, Code, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { EpisodeTracker } from './EpisodeTracker';
import { generateEpisodeAssets, saveEpisodeDraft, getShows } from '@/app/actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';

type WizardStep = 'UPLOAD' | 'GENERATING' | 'REVIEW' | 'PUBLISHING' | 'DONE';

export function EpisodeCreatorWizard({ isOpen, onClose, showId }: { isOpen: boolean, onClose: () => void, showId?: string }) {
  const [step, setStep] = useState<WizardStep>('UPLOAD');
  
  // State Payloads
  const [fileUrl, setFileUrl] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [previewMode, setPreviewMode] = useState<'source' | 'preview'>('preview');
  
  const router = useRouter();

  // Show Selection State
  const [shows, setShows] = useState<any[]>([]);
  const [effectiveShowId, setEffectiveShowId] = useState<string | undefined>(showId);

  useEffect(() => {
    if (isOpen) {
      setEffectiveShowId(showId);
      if (!showId) {
        getShows().then(data => {
          const sorted = [...data].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
          setShows(sorted);
        }).catch(console.error);
      }
    }
  }, [isOpen, showId]);

  const uploadProps = useSupabaseUpload({
    bucketName: 'episodes_bucket',
    maxFiles: 1,
    upsert: true,
    allowedMimeTypes: ['audio/*', 'video/*']
  });

  // Watch for successful upload internally from the Supabase UI block
  useEffect(() => {
    if (step === 'UPLOAD' && uploadProps.isSuccess && uploadProps.successes.length > 0) {
      const fileName = uploadProps.successes[0];
      const url = `https://ixyzyxhjcdqidsnlqwwj.supabase.co/storage/v1/object/public/episodes_bucket/${fileName}`;
      setFileUrl(url);
      triggerAI(url);
    }
  }, [uploadProps.isSuccess, step]);

  const triggerAI = async (url: string) => {
    setStep('GENERATING');
    toast('Generating magical show notes and imagery...', { icon: '✨' });
    try {
      const { aiTitle, aiDescription } = await generateEpisodeAssets(url);
      setTitle(aiTitle);
      setDescription(aiDescription);
      setStep('REVIEW');
    } catch (e) {
      toast.error('AI Generation failed. You can set them manually.');
      setTitle('');
      setDescription('');
      setStep('REVIEW');
    }
  };

  const handleSaveDraft = async () => {
    if (!effectiveShowId) {
      toast.error('Please select a target show first.');
      return;
    }
    setStep('PUBLISHING');
    try {
      const episodeId = await saveEpisodeDraft(fileUrl, title, description, effectiveShowId);
      toast.success('Metadata approved! Proceeding to Visuals...');
      onClose(); // Hide wizard dialog 
      router.push(`/taskbots/episode-art?episodeId=${episodeId}&autoRun=true`);
    } catch (e) {
      toast.error('Pipeline routing failed.');
      setStep('REVIEW');
    }
  };

  const reset = () => {
    setStep('UPLOAD');
    setFileUrl('');
    setTitle('');
    setDescription('');
    setPreviewMode('preview');
    uploadProps.setFiles([]);
    uploadProps.setErrors([]);
    setEffectiveShowId(showId);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && reset()}>
      <DialogContent className="sm:max-w-[800px] max-h-[85vh] overflow-y-auto bg-zinc-950 border-zinc-800 text-zinc-50">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            AI Episode Creator
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Automate processing, AI shownotes, and pipeline dispatching.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 min-h-[300px] flex flex-col justify-center">
          
          {step === 'UPLOAD' && (
            <div className="space-y-4">
              {!showId && (
                <div className="space-y-2 mb-4">
                  <label className="text-sm font-medium text-zinc-300">Target Show <span className="text-red-400">*</span></label>
                  <Select value={effectiveShowId} onValueChange={setEffectiveShowId}>
                    <SelectTrigger className="w-full bg-zinc-900 border-zinc-800 focus:ring-indigo-500">
                      <SelectValue placeholder="Select a show to publish to" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200 focus:bg-zinc-800">
                      {shows.map((show) => (
                        <SelectItem key={show.id} value={show.id} className="cursor-pointer">
                          {show.title || show.captivate_show_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Dropzone {...uploadProps} className="border-zinc-800 bg-zinc-900/50">
                <DropzoneEmptyState />
                <DropzoneContent />
              </Dropzone>
              
              
              {process.env.NODE_ENV === 'development' && (
                <div className="flex justify-center pt-4">
                  <Button 
                    onClick={() => triggerAI('http://localhost:3000/test_audio.m4a')}
                    className="bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30"
                  >
                    <Wand2 className="w-4 h-4 mr-2" />
                    Auto-Run Test Mode (Skip Upload)
                  </Button>
                </div>
              )}
            </div>
          )}

          {step === 'GENERATING' && (
            <div className="flex flex-col items-center justify-center space-y-4 py-8">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full" />
                <Loader2 className="w-12 h-12 text-indigo-400 animate-spin relative" />
              </div>
              <div className="text-center">
                <h3 className="font-medium text-zinc-200">AI Engine processing...</h3>
                <p className="text-sm text-zinc-500">Transcribing audio and compiling metadata.</p>
              </div>
            </div>
          )}

          {step === 'REVIEW' && (
            <div className="space-y-6 animate-in fade-in zoom-in duration-300">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-zinc-300">AI Suggested Title</label>
                </div>
                <Input 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-zinc-900 border-zinc-800 focus-visible:ring-indigo-500 text-lg font-semibold"
                />
              </div>

              {/* HTML Shownotes Editor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-zinc-300">AI Shownotes (HTML)</label>
                  <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
                    <button
                      onClick={() => setPreviewMode('source')}
                      className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                        previewMode === 'source' 
                          ? 'bg-indigo-600 text-white' 
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <Code className="w-3 h-3" />
                      Source
                    </button>
                    <button
                      onClick={() => setPreviewMode('preview')}
                      className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                        previewMode === 'preview' 
                          ? 'bg-indigo-600 text-white' 
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <Eye className="w-3 h-3" />
                      Preview
                    </button>
                  </div>
                </div>
                
                {previewMode === 'source' ? (
                  <textarea 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-md p-3 text-sm font-mono text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none min-h-[250px] overflow-y-auto"
                    spellCheck={false}
                  />
                ) : (
                  <div 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-md p-4 min-h-[250px] max-h-[400px] overflow-y-auto max-w-none text-sm text-zinc-300
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
                    dangerouslySetInnerHTML={{ __html: description || '<p class="text-zinc-500 italic">No shownotes generated yet.</p>' }}
                  />
                )}
                
                <p className="text-xs text-zinc-500">
                  {description.length}/4000 characters · HTML rendered for Captivate podcast feed
                </p>
              </div>

              <div className="flex items-center justify-between pt-4">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => triggerAI(fileUrl)} className="bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">
                    <Wand2 className="w-4 h-4 mr-2" />
                    Re-roll
                  </Button>
                  <Button variant="ghost" onClick={reset} className="text-red-400 hover:text-red-300 hover:bg-red-400/10">
                    Delete & Cancel
                  </Button>
                </div>
                <Button onClick={handleSaveDraft} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20">
                  Approve & Proceed to Phase 2
                </Button>
              </div>
            </div>
          )}

          {step === 'PUBLISHING' && (
            <div className="flex flex-col items-center justify-center space-y-8 py-8 animate-in fade-in">
              <EpisodeTracker status="zernio" />
              <p className="text-sm text-zinc-400 animate-pulse">Dispatching payloads to configured platforms...</p>
            </div>
          )}

          {step === 'DONE' && (
            <div className="flex flex-col items-center justify-center space-y-6 py-8 animate-in zoom-in">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-emerald-400" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-zinc-100">Pipeline Active!</h3>
                <p className="text-zinc-400 mt-2 max-w-sm">
                  Your episode has been handed off to your configured distribution platforms. You can track its live status in the Global Feed.
                </p>
              </div>
              <Button onClick={reset} className="bg-zinc-800 hover:bg-zinc-700 text-white w-full">
                Return to Dashboard
              </Button>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
