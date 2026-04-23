import { updateApprovalItemDecision } from '@/app/approvals/actions';
import {
  isImageAsset,
  isVideoAsset,
  type ApprovalRequestRecord,
} from '@/lib/approvals';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

function StatusBadge({ label }: { label: string }) {
  const className =
    label === 'approved'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
      : label === 'rejected'
        ? 'border-red-500/30 bg-red-500/10 text-red-300'
        : label === 'partially_approved'
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
          : 'border-blue-500/30 bg-blue-500/10 text-blue-300'

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider ${className}`}>
      {label.replace('_', ' ')}
    </span>
  )
}

function AssetPreview({ title, url }: { title: string; url: string | null }) {
  if (!url) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/5 text-xs text-zinc-500">
        Preview unavailable
      </div>
    )
  }

  if (isImageAsset(url)) {
    return (
      <div className="overflow-hidden rounded-lg border border-white/10 bg-black/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={title} className="h-32 w-full object-cover" />
      </div>
    )
  }

  if (isVideoAsset(url)) {
    return (
      <div className="overflow-hidden rounded-lg border border-white/10 bg-black/20">
        <video controls preload="metadata" className="h-32 w-full object-cover">
          <source src={url} />
        </video>
      </div>
    )
  }

  return (
    <div className="flex h-32 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 text-center text-xs text-zinc-400">
      External asset preview
    </div>
  )
}

export function ApprovalsInbox({
  requests,
  mode,
}: {
  requests: ApprovalRequestRecord[]
  mode: 'admin' | 'client'
}) {
  if (requests.length === 0) {
    return (
      <Card className="border-white/10 bg-black/40 backdrop-blur-xl">
        <CardContent className="flex min-h-[280px] flex-col items-center justify-center text-center">
          <p className="text-lg font-semibold text-zinc-100">
            {mode === 'admin' ? 'No approval batches are waiting right now.' : 'No approvals are waiting for you right now.'}
          </p>
          <p className="mt-2 max-w-md text-sm text-zinc-400">
            {mode === 'admin'
              ? 'Create a manual batch from clips, thumbnails, or other assets and they will appear here for operational review.'
              : 'When Podcast Partnership prepares new clips or creative assets for your show, they will appear here for final approval.'}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {requests.map((request) => (
        <Card key={request.id} className="border-white/10 bg-black/40 backdrop-blur-xl">
          <CardHeader className="space-y-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="text-xl text-zinc-50">
                  {request.show?.title || 'Untitled Show'}
                </CardTitle>
                <CardDescription className="text-zinc-400">
                  {request.episode?.title
                    ? `Episode: ${request.episode.title}`
                    : 'Show-level approval batch'}
                </CardDescription>
                {mode === 'admin' ? (
                  <p className="mt-2 text-xs uppercase tracking-widest text-zinc-500">
                    Client: {request.client?.name || 'Unknown'} {request.client?.email ? `• ${request.client.email}` : ''}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge label={request.status} />
                <span className="text-xs uppercase tracking-widest text-zinc-500">
                  Requested {new Date(request.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {request.items.map((item) => {
                const asset = item.asset
                if (!asset) {
                  return null
                }

                const previewUrl = asset.preview_url || asset.source_url
                return (
                  <div key={item.id} className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
                    <AssetPreview title={asset.title || asset.asset_type} url={previewUrl} />

                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-semibold text-zinc-100">
                          {asset.title || asset.asset_type.replace('_', ' ')}
                        </h3>
                        <StatusBadge label={item.decision_status} />
                      </div>
                      <p className="text-xs uppercase tracking-widest text-zinc-500">
                        {asset.asset_type.replace('_', ' ')} • {asset.status.replace('_', ' ')}
                      </p>
                    </div>

                    {item.decided_by_email ? (
                      <p className="text-xs text-zinc-500">
                        Last decision by {item.decided_by_email}
                        {item.decided_at ? ` on ${new Date(item.decided_at).toLocaleString()}` : ''}
                      </p>
                    ) : null}

                    <form action={updateApprovalItemDecision} className="space-y-3">
                      <input type="hidden" name="approval_item_id" value={item.id} />
                      <Textarea
                        name="decision_comment"
                        defaultValue={item.decision_comment || ''}
                        rows={3}
                        placeholder={mode === 'admin' ? 'Optional internal or client-facing note...' : 'Optional feedback for the Partnership team...'}
                        className="border-white/10 bg-black/20"
                      />

                      <div className="flex flex-wrap gap-2">
                        <Button type="submit" name="decision" value="approved" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                          {mode === 'admin' ? 'Approve / Override' : 'Approve'}
                        </Button>
                        <Button type="submit" name="decision" value="rejected" variant="outline" className="border-red-500/30 bg-red-500/5 text-red-300 hover:bg-red-500/10">
                          {mode === 'admin' ? 'Reject / Override' : 'Reject'}
                        </Button>
                      </div>
                    </form>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
