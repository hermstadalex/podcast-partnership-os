'use client';

import { CheckCircle2, PlayCircle, Loader2, UploadCloud, Video } from 'lucide-react';
import { motion } from 'framer-motion';

type EpisodeTrackerProps = {
  status: 'recording' | 'editing' | 'captivate' | 'zernio' | 'published';
};

const STEPS = [
  { id: 'recording', label: 'Recording', icon: PlayCircle },
  { id: 'editing', label: 'Editing', icon: Loader2 },
  { id: 'captivate', label: 'Podcast Published', icon: UploadCloud },
  { id: 'zernio', label: 'Video Processing', icon: Video },
  { id: 'published', label: 'YouTube Published', icon: CheckCircle2 },
];

export function EpisodeTracker({ status }: EpisodeTrackerProps) {
  const currentIndex = STEPS.findIndex(s => s.id === status);

  return (
    <div className="w-full py-6">
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-zinc-800 rounded-full" />
        
        {/* Progress bar */}
        <motion.div 
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-indigo-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${(currentIndex / (STEPS.length - 1)) * 100}%` }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />

        {STEPS.map((step, index) => {
          const isCompleted = index <= currentIndex;
          const isCurrent = index === currentIndex;
          const Icon = step.icon;
          
          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
              <motion.div 
                className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-colors duration-300 ${
                  isCompleted ? 'bg-zinc-950 border-indigo-500 text-indigo-400' : 'bg-zinc-950 border-zinc-700 text-zinc-600'
                } ${isCurrent ? 'ring-4 ring-indigo-500/20' : ''}`}
                animate={isCurrent && step.id === 'zernio' ? { rotate: 360 } : {}}
                transition={isCurrent && step.id === 'zernio' ? { repeat: Infinity, duration: 2, ease: "linear" } : {}}
              >
                <Icon className="h-5 w-5" />
              </motion.div>
              <span className={`text-xs font-medium absolute -bottom-6 whitespace-nowrap ${isCompleted ? 'text-zinc-300' : 'text-zinc-600'}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
