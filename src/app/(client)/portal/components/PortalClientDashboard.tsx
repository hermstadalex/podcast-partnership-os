'use client';

import { useState } from 'react';
import { PodcastProfileEditor } from '@/components/PodcastProfileEditor';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EpisodeCreatorWizard } from '@/components/EpisodeCreatorWizard';

type PortalShow = {
  id: string;
  title: string;
  cover_art?: string | null;
  artwork?: string | null;
};

export function PortalClientDashboard({ mappedShow }: { mappedShow: PortalShow }) {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black bg-gradient-to-br from-white to-zinc-500 bg-clip-text text-transparent">
            {mappedShow.title}
          </h1>
          <p className="text-zinc-400 mt-1">Manage your podcast presence and launch new episodes.</p>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={() => setIsWizardOpen(true)}
            className="bg-gradient-to-r from-emerald-400 to-emerald-600 hover:from-emerald-500 hover:to-emerald-700 text-white font-semibold shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-all"
          >
            + Post New Episode
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
           <div className="flex justify-between border-b border-white/10 pb-2 items-center">
             <h2 className="text-xl font-semibold">Profile Configuration</h2>
             <Button variant="outline" size="sm" onClick={() => setIsEditorOpen(true)} className="bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-300">
                Edit Profile
             </Button>
           </div>
           <Card className="bg-black/40 border-white/10 overflow-hidden">
               <CardContent className="p-8">
                   <div className="space-y-4">
                     <p className="text-zinc-500 text-sm">Your podcast profile is securely synchronized with Captivate. To manage metadata, update your cover art, or change the show description globally, click &quot;Edit Profile&quot; above.</p>
                     {(mappedShow.cover_art || mappedShow.artwork) && (
                          <div className="mt-4 flex items-center justify-center">
                             {/* eslint-disable-next-line @next/next/no-img-element */}
                             <img src={mappedShow.cover_art || mappedShow.artwork || undefined} alt="Show Cover" className="w-32 h-32 rounded-lg shadow-xl shadow-black/50 border border-white/10" />
                          </div>
                      )}
                   </div>
               </CardContent>
           </Card>
           {isEditorOpen && (
               <PodcastProfileEditor 
                   showId={mappedShow.id} 
                   onClose={() => setIsEditorOpen(false)} 
               />
           )}
        </div>
        <div className="space-y-6">
           <h2 className="text-xl font-semibold border-b border-white/10 pb-2">Recent Launches</h2>
           <Card className="bg-black/40 border-white/10 overflow-hidden">
               <CardContent className="p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
                   <p className="text-zinc-500 text-sm">You haven&apos;t posted any new episodes via the portal recently.</p>
               </CardContent>
           </Card>
        </div>
      </div>

      <EpisodeCreatorWizard 
        isOpen={isWizardOpen} 
        onClose={() => setIsWizardOpen(false)} 
        showId={mappedShow.id}
      />
    </div>
  );
}
