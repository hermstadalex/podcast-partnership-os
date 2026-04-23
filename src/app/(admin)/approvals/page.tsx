import { getAdminApprovalPageData } from '@/app/approvals/actions';
import { ApprovalsInbox } from '@/components/approvals/ApprovalsInbox';
import { ManualApprovalBatchForm } from '@/components/approvals/ManualApprovalBatchForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function ApprovalsPage() {
  const { requests, shows, episodes } = await getAdminApprovalPageData()
  const provisionedShows = shows.filter((show) => show.client_id)

  return (
    <div className="space-y-8 p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-4xl font-black bg-gradient-to-br from-white to-zinc-500 bg-clip-text text-transparent">
          Approvals
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          Intake repurposed assets from your managed workflows, route them to the right client, and keep every approval decision inside Partnership OS.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
        <Card className="border-white/10 bg-black/40 backdrop-blur-xl xl:col-span-1">
          <CardHeader>
            <CardTitle>Create Manual Approval Batch</CardTitle>
            <CardDescription>
              Paste clip or asset URLs from Taja, Sheets, or another source and send them directly into the native approval queue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ManualApprovalBatchForm shows={provisionedShows} episodes={episodes} />
          </CardContent>
        </Card>

        <div className="xl:col-span-2">
          <ApprovalsInbox requests={requests} mode="admin" />
        </div>
      </div>
    </div>
  )
}
