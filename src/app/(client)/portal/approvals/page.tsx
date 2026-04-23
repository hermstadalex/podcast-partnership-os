import { getClientApprovalPageData } from '@/app/approvals/actions';
import { ApprovalsInbox } from '@/components/approvals/ApprovalsInbox';

export default async function ClientApprovalsPage() {
  const { clientName, requests } = await getClientApprovalPageData()

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-4xl font-black bg-gradient-to-br from-white to-zinc-500 bg-clip-text text-transparent">
          {clientName ? `${clientName} Approvals` : 'Approvals'}
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          Review the latest clips and creative assets prepared for your show, then approve or reject them without leaving the portal.
        </p>
      </div>

      <ApprovalsInbox requests={requests} mode="client" />
    </div>
  )
}
