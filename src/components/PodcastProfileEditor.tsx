'use client';

import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { getShowMetadata, updateShowMetadata, syncZernioAccountsForClient } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useState, useTransition } from 'react';
import { Loader2, RefreshCw, Video, Camera, Music, ExternalLink as LinkIcon } from 'lucide-react';

type PodcastProfileEditorProps = {
  showId: string | null;
  onClose: () => void;
};

type ShowMetadata = {
  id: string;
  client_id?: string | null;
  title?: string | null;
  description?: string | null;
  author?: string | null;
  cover_art?: string | null;
  zernio_profile?: any;
  zernio_accounts?: any[];
};

function PodcastProfileEditorForm({ show, onClose }: { show: ShowMetadata; onClose: () => void }) {
  const [title, setTitle] = useState(show.title || '');
  const [description, setDescription] = useState(show.description || '');
  const [author, setAuthor] = useState(show.author || '');
  const [image, setImage] = useState(show.cover_art || '');

  const [zernioProfileId, setZernioProfileId] = useState(show.zernio_profile?.external_profile_id || '');
  const [isSyncing, startSyncTransition] = useTransition();

  const handleSave = async () => {
    const promise = updateShowMetadata(show.id, { title, description, author, image });

    toast.promise(promise, {
      loading: 'Pushing changes to Captivate...',
      success: 'Profile seamlessly updated!',
      error: 'Failed to sync with provider.',
    });

    await promise;
    onClose();
  };

  const handleSyncZernio = () => {
    if (!show.client_id) {
      toast.error('This show is not mapped to a Client.');
      return;
    }
    if (!zernioProfileId) {
      toast.error('Please enter a Zernio Profile ID first.');
      return;
    }

    startSyncTransition(async () => {
      try {
        const res = await syncZernioAccountsForClient(show.client_id!, zernioProfileId);
        toast.success(`Synced ${res.count} accounts from Zernio!`);
        // Force refresh of the drawer data by calling onClose, which invalidates the query
        onClose();
      } catch (err: any) {
        toast.error(err.message || 'Failed to sync accounts.');
      }
    });
  };

  return (
    <>
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-400">Show Cover Art URL</label>
        {image ? (
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="Cover" className="w-24 h-24 rounded-md object-cover border border-zinc-800" />
            <Button variant="outline" size="sm" onClick={() => setImage('')} className="bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800">
              Replace Cover
            </Button>
          </div>
        ) : (
          <Input
            placeholder="https://..."
            value={image}
            onChange={(e) => setImage(e.target.value)}
            className="bg-zinc-900 border-zinc-700 focus-visible:ring-indigo-500"
          />
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-400">Episode Title</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="bg-zinc-900 border-zinc-700 focus-visible:ring-indigo-500"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-400">Author</label>
        <Input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          className="bg-zinc-900 border-zinc-700 focus-visible:ring-indigo-500"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-400">Show Description</label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          className="bg-zinc-900 border-zinc-700 focus-visible:ring-indigo-500"
        />
      </div>

      <div className="pt-6 border-t border-zinc-800 mt-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <LinkIcon className="h-5 w-5 text-indigo-400" />
          <h3 className="text-lg font-semibold text-zinc-100">Zernio Publishing Integration</h3>
        </div>
        <p className="text-sm text-zinc-400">
          Link a Zernio Profile to enable automated distribution of Shorts and Episodes to social media.
        </p>

        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-400">Zernio Profile ID</label>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. prf_123456789"
              value={zernioProfileId}
              onChange={(e) => setZernioProfileId(e.target.value)}
              className="bg-zinc-900 border-zinc-700 focus-visible:ring-indigo-500 flex-1"
            />
            <Button 
              onClick={handleSyncZernio} 
              disabled={isSyncing || !zernioProfileId}
              variant="outline"
              className="bg-zinc-900 border-zinc-700 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800"
            >
              {isSyncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Sync Accounts
            </Button>
          </div>
        </div>

        {show.zernio_accounts && show.zernio_accounts.length > 0 && (
          <div className="mt-4 p-4 border border-zinc-800 bg-zinc-900/50 rounded-lg">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Connected Platforms</h4>
            <div className="space-y-3">
              {show.zernio_accounts.map((acc: any) => (
                <div key={acc.id} className="flex items-center justify-between text-sm bg-zinc-950 p-2.5 rounded border border-zinc-800">
                  <div className="flex items-center gap-3">
                    {acc.platform === 'youtube' && <Video className="h-4 w-4 text-red-500" />}
                    {acc.platform === 'tiktok' && <Music className="h-4 w-4 text-cyan-400" />}
                    {acc.platform === 'instagram' && <Camera className="h-4 w-4 text-fuchsia-500" />}
                    <span className="font-medium text-zinc-200">{acc.account_name || 'Unnamed Account'}</span>
                  </div>
                  <div className="text-xs text-zinc-500 font-mono">
                    {acc.platform}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 mt-2 flex justify-end gap-3 border-t border-zinc-900">
        <DrawerClose asChild>
          <Button variant="ghost" className="hover:bg-zinc-800 text-zinc-300">Cancel</Button>
        </DrawerClose>
        <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          Push to Provider
        </Button>
      </div>
    </>
  );
}

export function PodcastProfileEditor({ showId, onClose }: PodcastProfileEditorProps) {
  const { data: show, isLoading } = useQuery({
    queryKey: ['show', showId],
    queryFn: () => getShowMetadata(showId!),
    enabled: !!showId,
  });

  return (
    <Drawer open={!!showId} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="bg-zinc-950 border-zinc-800 text-zinc-50">
        <div className="mx-auto w-full max-w-3xl">
          <DrawerHeader>
            <DrawerTitle className="text-2xl font-bold">Show Profile Editor</DrawerTitle>
            <DrawerDescription className="text-zinc-400">
              Update your podcast metadata globally.
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-4 pb-0 space-y-6 max-h-[60vh] overflow-y-auto">
            {isLoading ? (
              <div className="space-y-4">
                <div className="animate-pulse h-12 bg-zinc-900 rounded-lg" />
                <div className="animate-pulse h-32 bg-zinc-900 rounded-lg" />
              </div>
            ) : show ? (
              <PodcastProfileEditorForm key={show.id} show={show as ShowMetadata} onClose={onClose} />
            ) : (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-sm text-zinc-400">
                Show metadata could not be loaded.
              </div>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
