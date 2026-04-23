'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';

import { createManualApprovalBatch } from '@/app/approvals/actions';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type ApprovalComposerShow = {
  id: string
  title: string
  client_id: string | null
}

type ApprovalComposerEpisode = {
  id: string
  title: string
  show_id: string
}

type ApprovalActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

const initialState: ApprovalActionState = {
  status: 'idle',
  message: '',
}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {pending ? 'Creating Batch...' : 'Create Approval Batch'}
    </Button>
  )
}

export function ManualApprovalBatchForm({
  shows,
  episodes,
}: {
  shows: ApprovalComposerShow[]
  episodes: ApprovalComposerEpisode[]
}) {
  const [selectedShowId, setSelectedShowId] = useState(shows[0]?.id || '')
  const [state, formAction] = useActionState(createManualApprovalBatch, initialState)

  const filteredEpisodes = selectedShowId
    ? episodes.filter((episode) => episode.show_id === selectedShowId)
    : episodes

  return (
    <form action={formAction} className="space-y-4">
      {state.status !== 'idle' ? (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            state.status === 'success'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              : 'border-red-500/40 bg-red-500/10 text-red-300'
          }`}
        >
          {state.message}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="show_id">Show</Label>
        <select
          id="show_id"
          name="show_id"
          value={selectedShowId}
          onChange={(event) => setSelectedShowId(event.target.value)}
          required
          className="flex h-10 w-full items-center rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {shows.length === 0 ? <option value="">No client-linked shows available</option> : null}
          {shows.map((show) => (
            <option key={show.id} value={show.id} className="bg-zinc-950 text-white">
              {show.title}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="episode_id">Episode (optional)</Label>
        <select
          key={selectedShowId || 'all-shows'}
          id="episode_id"
          name="episode_id"
          className="flex h-10 w-full items-center rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          defaultValue=""
        >
          <option value="" className="bg-zinc-950 text-zinc-400">
            Use show-level approval only
          </option>
          {filteredEpisodes.map((episode) => (
            <option key={episode.id} value={episode.id} className="bg-zinc-950 text-white">
              {episode.title}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="asset_type">Asset Type</Label>
        <select
          id="asset_type"
          name="asset_type"
          defaultValue="short_clip"
          className="flex h-10 w-full items-center rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="short_clip" className="bg-zinc-950 text-white">Short Clip</option>
          <option value="thumbnail" className="bg-zinc-950 text-white">Thumbnail</option>
          <option value="square_art" className="bg-zinc-950 text-white">Square Art</option>
          <option value="caption_card" className="bg-zinc-950 text-white">Caption Card</option>
          <option value="other" className="bg-zinc-950 text-white">Other</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="asset_lines">Asset Lines</Label>
        <Textarea
          id="asset_lines"
          name="asset_lines"
          required
          rows={7}
          placeholder={'Clip Title | https://asset-url.example/file.mp4 | https://preview-url.example/thumb.jpg\nhttps://asset-url.example/another-file.mp4'}
          className="bg-white/5 border-white/10 font-mono text-xs"
        />
        <p className="text-xs text-zinc-500">
          Paste one asset per line. Format: <code>Title | Asset URL | Preview URL</code>. Preview URL is optional.
        </p>
      </div>

      <SubmitButton />
    </form>
  )
}
