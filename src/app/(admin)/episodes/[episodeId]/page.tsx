import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clapperboard,
  ExternalLink,
  FileText,
  Mic,
  Podcast,
  Scissors,
  Settings,
  Video,
} from 'lucide-react';
import { getEpisodeOperationalContext } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { OperationalIssue, OperationalIssueSeverity } from '@/lib/operational-issues';

const statusStyles: Record<string, string> = {
  Published: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Dispatched: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Failed: 'bg-red-500/10 text-red-400 border-red-500/20',
  Draft: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  Scheduled: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Processing: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

const issueStyles: Record<OperationalIssueSeverity, string> = {
  error: 'border-red-500/20 bg-red-500/10 text-red-300',
  warning: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  info: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
};

function formatDate(value?: string | null) {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function IssueList({ issues }: { issues: OperationalIssue[] }) {
  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
        <CheckCircle2 className="h-4 w-4" />
        No active operational issues detected.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {issues.map((issue) => (
        <div key={issue.id} className={`rounded-md border p-3 ${issueStyles[issue.severity]}`}>
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-zinc-100">{issue.title}</p>
                <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-zinc-400">
                  {issue.scope}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-zinc-300">{issue.message}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function EpisodeDetailPage({
  params,
}: {
  params: Promise<{ episodeId: string }>;
}) {
  const { episodeId } = await params;
  const context = await getEpisodeOperationalContext(episodeId);

  if (!context) {
    notFound();
  }

  const { episode, issues } = context;
  const runs = episode.runs || [];
  const shorts = episode.shorts || [];
  const destinations = episode.show?.destinations || [];
  const latestRun = runs[0];
  const isVideo = /\.(mp4|mov|webm|avi|mkv)$/i.test(episode.media_url || '');

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" className="text-zinc-400 hover:text-zinc-100">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {isVideo && (
            <Button asChild variant="outline" className="border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">
              <Link href={`/taskbots/shorts-creator?episodeId=${episode.id}`}>
                <Scissors className="h-4 w-4" />
                Shorts
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" className="border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">
            <Link href="/shows">
              <Settings className="h-4 w-4" />
              Edit Show
            </Link>
          </Button>
        </div>
      </div>

      <header className="space-y-3 border-b border-zinc-800 pb-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span>{episode.show?.title || 'Unassigned show'}</span>
          {episode.show?.client?.name && <span>· {episode.show.client.name}</span>}
          <span>· Created {formatDate(episode.created_at)}</span>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="max-w-4xl text-3xl font-bold tracking-tight text-zinc-100">{episode.title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400 line-clamp-3">
              {episode.description || 'No description has been generated for this episode yet.'}
            </p>
          </div>
          <div className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${statusStyles[latestRun?.status || 'Processing'] || statusStyles.Processing}`}>
            {latestRun?.status || 'No runs yet'}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-zinc-800 bg-zinc-900/30 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Operational State
            </CardTitle>
          </CardHeader>
          <CardContent>
            <IssueList issues={issues} />
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <FileText className="h-4 w-4 text-indigo-400" />
              Metadata
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Media</dt>
                <dd className="text-right text-zinc-300">{episode.media_url ? 'Attached' : 'Missing'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Scheduled</dt>
                <dd className="text-right text-zinc-300">{formatDate(episode.scheduled_at)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Published</dt>
                <dd className="text-right text-zinc-300">{formatDate(episode.published_at)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Season / Episode</dt>
                <dd className="text-right text-zinc-300">
                  {episode.episode_season || '—'} / {episode.episode_number || '—'}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="border-zinc-800 bg-zinc-900/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <Podcast className="h-4 w-4 text-emerald-400" />
              Publish Runs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {runs.length === 0 ? (
              <p className="text-sm text-zinc-500">No publish runs have been created yet.</p>
            ) : (
              <div className="space-y-2">
                {runs.map((run) => (
                  <div key={run.id} className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Mic className="h-4 w-4 text-zinc-500" />
                        <span className="text-sm font-medium capitalize text-zinc-100">{run.provider}</span>
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusStyles[run.status] || statusStyles.Processing}`}>
                        {run.status}
                      </span>
                    </div>
                    {run.error_message && (
                      <p className="mt-2 text-xs leading-relaxed text-red-300">{run.error_message}</p>
                    )}
                    <p className="mt-2 text-xs text-zinc-500">
                      Requested {formatDate(run.requested_at || run.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <Video className="h-4 w-4 text-fuchsia-400" />
              Destinations & Shorts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                {destinations.length === 0 ? (
                  <p className="text-sm text-zinc-500">No video destination is configured for this show.</p>
                ) : (
                  destinations.map((destination) => (
                    <div key={destination.id} className="flex items-center justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
                      <div>
                        <p className="text-sm font-medium text-zinc-100">
                          {destination.account?.channel_title || destination.account?.account_name || 'Destination account'}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {destination.account?.platform || 'youtube'} · {destination.account?.external_account_id || 'Missing external ID'}
                        </p>
                      </div>
                      {destination.is_default && (
                        <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-400">
                          Default
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>

              {episode.youtube_video_url && (
                <Button asChild variant="outline" className="border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">
                  <a href={episode.youtube_video_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Open Published Video
                  </a>
                </Button>
              )}

              <div className="border-t border-zinc-800 pt-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-100">
                  <Clapperboard className="h-4 w-4 text-fuchsia-400" />
                  Shorts
                </div>
                {shorts.length === 0 ? (
                  <p className="text-sm text-zinc-500">No shorts are saved for this episode yet.</p>
                ) : (
                  <div className="space-y-2">
                    {shorts.map((short) => (
                      <div key={short.id} className="flex items-center justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
                        <div>
                          <p className="text-sm font-medium text-zinc-100">{short.title || 'Untitled short'}</p>
                          <p className="text-xs text-zinc-500">
                            {short.export_status || 'pending'} · {short.approval_status || 'pending'}
                          </p>
                        </div>
                        {short.video_url && (
                          <a href={short.video_url} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-zinc-100">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-zinc-800 bg-zinc-900/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-zinc-100">
            <CalendarClock className="h-4 w-4 text-blue-400" />
            Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 text-sm text-zinc-300 sm:grid-cols-3">
            <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
              <p className="text-xs uppercase tracking-wider text-zinc-500">Created</p>
              <p className="mt-1">{formatDate(episode.created_at)}</p>
            </div>
            <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
              <p className="text-xs uppercase tracking-wider text-zinc-500">Updated</p>
              <p className="mt-1">{formatDate(episode.updated_at)}</p>
            </div>
            <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
              <p className="text-xs uppercase tracking-wider text-zinc-500">Klap Folder</p>
              <p className="mt-1 truncate">{episode.klap_folder_id || '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
