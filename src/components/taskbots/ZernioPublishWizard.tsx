'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createClient } from '@/lib/supabase/client';
import { Dropzone, DropzoneContent, DropzoneEmptyState } from '@/components/dropzone';
import { useSupabaseUpload } from '@/hooks/use-supabase-upload';
import { generateViralAssetsAction } from '@/lib/actions/viral-actions';
import { createZernioPostAction, type ZernioPublishRequest } from '@/lib/actions/publish-wizard-actions';
import { toast } from 'sonner';
import { Wand2, Upload, CalendarClock, Share2, Video, Camera, Music, Loader2, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function ZernioPublishWizard({ shows }: { shows: any[] }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [selectedShowId, setSelectedShowId] = useState('');
  const [topicSummary, setTopicSummary] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'video' | 'image'>('video');

  // Platform selection & DB records
  const [zernioProfile, setZernioProfile] = useState<any>(null);
  const [zernioAccounts, setZernioAccounts] = useState<any[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  // AI Generated Content State
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [generatedData, setGeneratedData] = useState<any>(null);

  // Editable Form Data (populated by AI)
  const [globalCaption, setGlobalCaption] = useState('');
  const [ytTitle, setYtTitle] = useState('');
  const [ytDescription, setYtDescription] = useState('');
  const [ytTags, setYtTags] = useState('');
  const [ttCaption, setTtCaption] = useState('');
  const [igCaption, setIgCaption] = useState('');

  // Scheduling State
  const [scheduleMode, setScheduleMode] = useState<'now' | 'schedule' | 'queue'>('now');
  const [scheduledAt, setScheduledAt] = useState('');

  // Upload Hook
  const upload = useSupabaseUpload({
    bucketName: 'episodes_bucket',
    path: 'shorts',
    maxFiles: 1,
    allowedMimeTypes: ['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png', 'image/webp'],
  });

  const supabase = createClient();

  // Load Zernio Accounts when Show changes
  useEffect(() => {
    async function loadAccounts() {
      if (!selectedShowId) {
        setZernioProfile(null);
        setZernioAccounts([]);
        return;
      }
      // Get the Client ID from the Show
      const show = shows.find((s) => s.id === selectedShowId);
      if (!show) return;

      const { data: profile } = await supabase
        .from('zernio_profiles')
        .select('*, client:clients(*)')
        .eq('client_id', show.client_id || (show as any).client_id) // We might need to ensure client_id is passed
        .single();
      
      if (profile) {
        setZernioProfile(profile);
        const { data: accounts } = await supabase
          .from('zernio_accounts')
          .select('*')
          .eq('zernio_profile_id', profile.id)
          .eq('is_active', true);
        
        setZernioAccounts(accounts || []);
        // Auto-select all available by default
        setSelectedPlatforms((accounts || []).map(a => a.platform));
      } else {
        // Fallback query if client_id wasn't in shows prop directly
        const { data: realShow } = await supabase.from('shows').select('client_id').eq('id', selectedShowId).single();
        if (realShow?.client_id) {
            const { data: profile2 } = await supabase.from('zernio_profiles').select('*').eq('client_id', realShow.client_id).single();
            if (profile2) {
                setZernioProfile(profile2);
                const { data: accounts } = await supabase.from('zernio_accounts').select('*').eq('zernio_profile_id', profile2.id).eq('is_active', true);
                setZernioAccounts(accounts || []);
                setSelectedPlatforms((accounts || []).map(a => a.platform));
            }
        }
      }
    }
    loadAccounts();
  }, [selectedShowId, shows, supabase]);

  // Handle successful upload to set URL
  useEffect(() => {
    if (upload.isSuccess && upload.files.length > 0 && !mediaUrl) {
      const file = upload.files[0];
      const { data } = supabase.storage.from('episodes_bucket').getPublicUrl(`shorts/${file.name}`);
      setMediaUrl(data.publicUrl);
      setMediaType(file.type.startsWith('image/') ? 'image' : 'video');
    }
  }, [upload.isSuccess, upload.files, supabase, mediaUrl]);

  // Auto-upload when a file is selected
  useEffect(() => {
    if (
      upload.files.length > 0 && 
      !upload.loading && 
      !upload.isSuccess && 
      upload.files.every(f => f.errors.length === 0) &&
      upload.errors.length === 0
    ) {
      upload.onUpload();
    }
  }, [upload.files, upload.loading, upload.isSuccess, upload.errors, upload.onUpload]);

  const handleGenerate = async () => {
    if (!mediaUrl) return toast.error("Please wait for the media to finish uploading.");
    if (!topicSummary) return toast.error("Please provide a topic summary.");
    if (!selectedShowId) return toast.error("Please select a target show/profile.");
    if (selectedPlatforms.length === 0) return toast.error("Please select at least one destination platform.");

    setIsGenerating(true);
    setStep(2);

    try {
      const res = await generateViralAssetsAction(mediaUrl, topicSummary);
      if (!res.success || !res.data) throw new Error(res.error || 'Failed to generate');

      setGeneratedData(res.data);
      setGlobalCaption(res.data.youtube?.description || res.data.tiktok?.caption || '');
      setYtTitle(res.data.youtube?.title || '');
      setYtDescription(res.data.youtube?.description || '');
      setYtTags(res.data.youtube?.tags?.join(', ') || '');
      setTtCaption(res.data.tiktok?.caption || '');
      setIgCaption(res.data.instagram?.caption || '');
      
      setStep(3);
    } catch (err: any) {
      toast.error(err.message);
      setStep(1); // Go back if failed
    } finally {
      setIsGenerating(false);
    }
  };

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platform) ? prev.filter(p => p !== platform) : [...prev, platform]
    );
  };

  const handlePublish = async () => {
    if (!zernioProfile) return toast.error("No Zernio profile connected to this show.");
    setIsPublishing(true);

    try {
      const platformsData = [];

      for (const platform of selectedPlatforms) {
        const account = zernioAccounts.find(a => a.platform === platform);
        if (!account) continue;

        let specificData: any = {};
        if (platform === 'youtube') {
          specificData = {
            title: ytTitle,
            description: ytDescription,
            tags: ytTags.split(',').map(t => t.trim()),
            visibility: 'public',
            type: 'short'
          };
        } else if (platform === 'tiktok') {
          specificData = { description: ttCaption };
        } else if (platform === 'instagram') {
          specificData = { description: igCaption };
        }

        platformsData.push({
          platform,
          accountId: account.external_account_id,
          platformSpecificData: specificData
        });
      }

      const req: ZernioPublishRequest = {
        showId: selectedShowId,
        profileId: zernioProfile.external_profile_id,
        title: ytTitle || topicSummary,
        caption: globalCaption,
        mediaUrl: mediaUrl!,
        mediaType,
        platforms: platformsData,
        scheduleMode,
        scheduledAt: scheduleMode === 'schedule' ? scheduledAt : undefined
      };

      const res = await createZernioPostAction(req);
      if (!res.success) throw new Error(res.error);

      toast.success("Successfully pushed to Zernio!");
      router.push('/shows'); // Or to a posts dashboard if you have one
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="border border-zinc-800 bg-zinc-900/50 rounded-xl overflow-hidden">
      {/* Wizard Header / Steps */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900">
        <div className="flex items-center gap-2">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-500'}`}>1</div>
          <span className={`text-sm font-medium ${step >= 1 ? 'text-zinc-100' : 'text-zinc-500'}`}>Upload & Context</span>
        </div>
        <div className={`h-px w-8 sm:w-16 ${step >= 2 ? 'bg-blue-600' : 'bg-zinc-800'}`} />
        <div className="flex items-center gap-2">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-500'}`}>2</div>
          <span className={`text-sm font-medium ${step >= 2 ? 'text-zinc-100' : 'text-zinc-500'}`}>AI Generation</span>
        </div>
        <div className={`h-px w-8 sm:w-16 ${step >= 3 ? 'bg-blue-600' : 'bg-zinc-800'}`} />
        <div className="flex items-center gap-2">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-500'}`}>3</div>
          <span className={`text-sm font-medium ${step >= 3 ? 'text-zinc-100' : 'text-zinc-500'}`}>Review & Edit</span>
        </div>
        <div className={`h-px w-8 sm:w-16 ${step >= 4 ? 'bg-blue-600' : 'bg-zinc-800'}`} />
        <div className="flex items-center gap-2">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 4 ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-500'}`}>4</div>
          <span className={`text-sm font-medium ${step >= 4 ? 'text-zinc-100' : 'text-zinc-500'}`}>Publish</span>
        </div>
      </div>

      <div className="p-6 sm:p-8">
        
        {/* STEP 1: UPLOAD & CONTEXT */}
        {step === 1 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <Label>1. Upload Media (Video or Image)</Label>
                <Dropzone {...upload}>
                  <DropzoneEmptyState />
                  <DropzoneContent />
                </Dropzone>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>2. Select Target Show</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                    value={selectedShowId}
                    onChange={(e) => setSelectedShowId(e.target.value)}
                  >
                    <option value="">-- Select a Show --</option>
                    {shows.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
                </div>

                {zernioAccounts.length > 0 && (
                  <div className="space-y-2 border border-blue-900/30 bg-blue-900/10 p-4 rounded-lg">
                    <Label className="text-blue-400">Connected Platforms Found</Label>
                    <div className="flex flex-wrap gap-4 mt-2">
                      {zernioAccounts.map(acc => (
                        <div key={acc.id} className="flex items-center gap-2">
                          <input 
                            type="checkbox"
                            className="h-4 w-4 rounded border-zinc-800 bg-zinc-950 text-blue-600 focus:ring-blue-500"
                            checked={selectedPlatforms.includes(acc.platform)} 
                            onChange={() => togglePlatform(acc.platform)}
                            id={`plat-${acc.id}`}
                          />
                          <Label htmlFor={`plat-${acc.id}`} className="capitalize flex items-center gap-1 cursor-pointer">
                            {acc.platform === 'youtube' && <Video className="w-3 h-3 text-red-500"/>}
                            {acc.platform === 'instagram' && <Camera className="w-3 h-3 text-pink-500"/>}
                            {acc.platform === 'tiktok' && <Music className="w-3 h-3 text-teal-400"/>}
                            {acc.platform}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>3. Provide Context for AI</Label>
                  <Textarea 
                    placeholder="Briefly describe what this media is about to help the AI generate the perfect viral hook and description..."
                    value={topicSummary}
                    onChange={(e) => setTopicSummary(e.target.value)}
                    className="h-24 bg-zinc-950 border-zinc-800"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end pt-4 border-t border-zinc-800">
              {upload.loading && (
                <div className="text-sm text-blue-400 mb-3 font-medium flex items-center">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading media... Please wait.
                </div>
              )}
              <Button 
                onClick={handleGenerate} 
                disabled={!mediaUrl || !topicSummary || !selectedShowId || selectedPlatforms.length === 0 || upload.loading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Wand2 className="w-4 h-4 mr-2" />
                {upload.loading ? 'Uploading...' : (!mediaUrl && upload.files.length > 0) ? 'Waiting for media upload...' : 'Generate Viral Assets'}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: GENERATING (LOADING) */}
        {step === 2 && (
          <div className="flex flex-col items-center justify-center py-20 space-y-6 animate-in fade-in zoom-in-95 duration-500">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            <div className="text-center">
              <h3 className="text-xl font-bold text-zinc-100">AI is analyzing your media...</h3>
              <p className="text-zinc-400 mt-2">Generating viral titles, descriptions, and tags across your selected platforms.</p>
            </div>
          </div>
        )}

        {/* STEP 3: REVIEW & EDIT */}
        {step === 3 && generatedData && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Video Preview */}
              <div className="lg:col-span-1 space-y-4">
                <Label>Media Preview</Label>
                <div className="aspect-[9/16] bg-black rounded-lg overflow-hidden border border-zinc-800 relative">
                  {mediaType === 'image' ? (
                    <img src={mediaUrl!} alt="Preview" className="w-full h-full object-contain" />
                  ) : (
                    <video src={mediaUrl!} controls className="w-full h-full object-cover" />
                  )}
                </div>
              </div>

              {/* Editor Tabs */}
              <div className="lg:col-span-2 space-y-6">
                
                {selectedPlatforms.includes('youtube') && (
                  <div className="space-y-4 p-5 rounded-lg border border-red-900/30 bg-red-900/5">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-red-400">
                      <Video className="w-5 h-5" /> YouTube Shorts Optimization
                    </h3>
                    <div className="space-y-2">
                      <Label>Viral Title</Label>
                      <Input value={ytTitle} onChange={e => setYtTitle(e.target.value)} className="bg-zinc-950 font-medium" />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea value={ytDescription} onChange={e => setYtDescription(e.target.value)} className="h-24 bg-zinc-950" />
                    </div>
                    <div className="space-y-2">
                      <Label>Tags (Comma separated)</Label>
                      <Input value={ytTags} onChange={e => setYtTags(e.target.value)} className="bg-zinc-950" />
                    </div>
                  </div>
                )}

                {selectedPlatforms.includes('tiktok') && (
                  <div className="space-y-4 p-5 rounded-lg border border-teal-900/30 bg-teal-900/5">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-teal-400">
                      <Music className="w-5 h-5" /> TikTok Optimization
                    </h3>
                    <div className="space-y-2">
                      <Label>Caption & Hashtags</Label>
                      <Textarea value={ttCaption} onChange={e => setTtCaption(e.target.value)} className="h-24 bg-zinc-950" />
                    </div>
                  </div>
                )}

                {selectedPlatforms.includes('instagram') && (
                  <div className="space-y-4 p-5 rounded-lg border border-pink-900/30 bg-pink-900/5">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-pink-400">
                      <Camera className="w-5 h-5" /> Instagram Reels Optimization
                    </h3>
                    <div className="space-y-2">
                      <Label>Caption & Hashtags</Label>
                      <Textarea value={igCaption} onChange={e => setIgCaption(e.target.value)} className="h-24 bg-zinc-950" />
                    </div>
                  </div>
                )}

              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-zinc-800">
              <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(4)} className="bg-blue-600 hover:bg-blue-700 text-white">
                Continue to Scheduling <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: PUBLISH & SCHEDULE */}
        {step === 4 && (
          <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-zinc-100">Ready for Liftoff 🚀</h2>
              <p className="text-zinc-400">Choose how you want to dispatch this content to Zernio.</p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div 
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${scheduleMode === 'now' ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'}`}
                onClick={() => setScheduleMode('now')}
              >
                <div className="flex items-center gap-3">
                  <Share2 className={`w-6 h-6 ${scheduleMode === 'now' ? 'text-blue-400' : 'text-zinc-500'}`} />
                  <div>
                    <h4 className="font-bold text-zinc-100">Publish Immediately</h4>
                    <p className="text-sm text-zinc-400">Push to all selected platforms right now.</p>
                  </div>
                </div>
              </div>

              <div 
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${scheduleMode === 'schedule' ? 'border-purple-500 bg-purple-500/10' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'}`}
                onClick={() => setScheduleMode('schedule')}
              >
                <div className="flex items-center gap-3">
                  <CalendarClock className={`w-6 h-6 ${scheduleMode === 'schedule' ? 'text-purple-400' : 'text-zinc-500'}`} />
                  <div>
                    <h4 className="font-bold text-zinc-100">Schedule for Later</h4>
                    <p className="text-sm text-zinc-400">Pick a specific date and time for publishing.</p>
                  </div>
                </div>
                {scheduleMode === 'schedule' && (
                  <div className="mt-4 pl-9">
                    <Input 
                      type="datetime-local" 
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="bg-zinc-950 max-w-[250px]" 
                    />
                  </div>
                )}
              </div>

              <div 
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${scheduleMode === 'queue' ? 'border-green-500 bg-green-500/10' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'}`}
                onClick={() => setScheduleMode('queue')}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 flex items-center justify-center font-bold ${scheduleMode === 'queue' ? 'text-green-400' : 'text-zinc-500'}`}>
                    Q
                  </div>
                  <div>
                    <h4 className="font-bold text-zinc-100">Add to Queue</h4>
                    <p className="text-sm text-zinc-400">Place in the next available slot in your Zernio posting queue.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-8 border-t border-zinc-800">
              <Button variant="ghost" onClick={() => setStep(3)}>Back</Button>
              <Button 
                onClick={handlePublish} 
                disabled={isPublishing || (scheduleMode === 'schedule' && !scheduledAt)}
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 text-white min-w-[200px]"
              >
                {isPublishing ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Dispatching...</>
                ) : (
                  <><Share2 className="w-5 h-5 mr-2" /> Dispatch to Zernio</>
                )}
              </Button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
