'use client';

import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { getShowMetadata, updateShowMetadata } from '@/app/actions';
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
import { useState } from 'react';

type PodcastProfileEditorProps = {
  showId: string | null;
  onClose: () => void;
};

type ShowMetadata = {
  id: string;
  title?: string | null;
  description?: string | null;
  author?: string | null;
  cover_art?: string | null;
};

function PodcastProfileEditorForm({ show, onClose }: { show: ShowMetadata; onClose: () => void }) {
  const [title, setTitle] = useState(show.title || '');
  const [description, setDescription] = useState(show.description || '');
  const [author, setAuthor] = useState(show.author || '');
  const [image, setImage] = useState(show.cover_art || '');

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
