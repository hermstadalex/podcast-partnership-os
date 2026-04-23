'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import {
  deriveApprovalRequestStatus,
  parseManualAssetLines,
  sortApprovalRequestItems,
  type ApprovalAssetRecord,
  type ApprovalItemRecord,
  type ApprovalRequestRecord,
  type ApprovalItemDecisionStatus,
} from '@/lib/approvals'

type ApprovalActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

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

type ApprovalQueueRelation<T> = T | T[] | null

type ApprovalQueueItemRow = Omit<ApprovalItemRecord, 'asset'> & {
  asset: ApprovalQueueRelation<ApprovalAssetRecord>
}

type ApprovalQueueRow = Omit<ApprovalRequestRecord, 'client' | 'show' | 'episode' | 'items'> & {
  client: ApprovalQueueRelation<ApprovalRequestRecord['client'] extends infer T ? Exclude<T, null> : never>
  show: ApprovalQueueRelation<ApprovalRequestRecord['show'] extends infer T ? Exclude<T, null> : never>
  episode: ApprovalQueueRelation<ApprovalRequestRecord['episode'] extends infer T ? Exclude<T, null> : never>
  items: ApprovalQueueItemRow[] | null
}

function normalizeRelation<T>(value: ApprovalQueueRelation<T>) {
  if (Array.isArray(value)) {
    return value[0] || null
  }

  return value || null
}

function isAdminEmail(email?: string | null) {
  return email === 'podcastpartnership@gmail.com'
}

function getOpenRequests(requests: ApprovalRequestRecord[]) {
  return requests.filter((request) => request.status === 'pending' || request.status === 'partially_approved')
}

async function getAuthenticatedUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  return { supabase, user }
}

async function requireAdmin() {
  const { supabase, user } = await getAuthenticatedUser()

  if (!isAdminEmail(user.email)) {
    redirect('/portal')
  }

  return { supabase, user }
}

async function getClientByEmail(email: string) {
  const { supabase } = await getAuthenticatedUser()
  const { data: client } = await supabase
    .from('clients')
    .select('id, name, email')
    .eq('email', email)
    .single()

  return client
}

async function fetchApprovalRequests(filterClientId?: string) {
  const { supabase } = await getAuthenticatedUser()
  let query = supabase
    .from('approval_requests')
    .select(`
      id,
      client_id,
      show_id,
      episode_id,
      status,
      requested_by_role,
      created_at,
      updated_at,
      client:clients(name, email),
      show:shows(title),
      episode:episodes(title),
      items:approval_items(
        id,
        decision_status,
        decision_comment,
        decided_by_email,
        decided_at,
        sort_order,
        asset:assets(
          id,
          title,
          asset_type,
          status,
          source_url,
          preview_url,
          metadata
        )
      )
    `)
    .order('created_at', { ascending: false })

  if (filterClientId) {
    query = query.eq('client_id', filterClientId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to load approval requests: ${error.message}`)
  }

  return ((data || []) as unknown as ApprovalQueueRow[]).map((request) =>
    sortApprovalRequestItems({
      ...request,
      client: normalizeRelation(request.client),
      show: normalizeRelation(request.show),
      episode: normalizeRelation(request.episode),
      items: (request.items || []).map((item) => ({
        ...item,
        asset: normalizeRelation(item.asset),
      })),
    })
  )
}

export async function getAdminApprovalPageData() {
  const { supabase } = await requireAdmin()

  const [requests, showsResult, episodesResult] = await Promise.all([
    fetchApprovalRequests(),
    supabase.from('shows').select('id, title, client_id').order('title', { ascending: true }),
    supabase.from('episodes').select('id, title, show_id').order('created_at', { ascending: false }),
  ])

  return {
    requests: getOpenRequests(requests),
    shows: (showsResult.data || []) as ApprovalComposerShow[],
    episodes: (episodesResult.data || []) as ApprovalComposerEpisode[],
  }
}

export async function getClientApprovalPageData() {
  const { user } = await getAuthenticatedUser()

  if (!user.email || isAdminEmail(user.email)) {
    redirect('/')
  }

  const client = await getClientByEmail(user.email)
  if (!client) {
    return {
      clientName: null,
      requests: [],
    }
  }

  const requests = await fetchApprovalRequests(client.id)

  return {
    clientName: client.name,
    requests: getOpenRequests(requests),
  }
}

export async function createManualApprovalBatch(
  _previousState: ApprovalActionState,
  formData: FormData
): Promise<ApprovalActionState> {
  const { supabase } = await requireAdmin()

  const showId = String(formData.get('show_id') || '')
  const episodeIdValue = String(formData.get('episode_id') || '')
  const episodeId = episodeIdValue || null
  const assetType = String(formData.get('asset_type') || 'short_clip').trim()
  const rawAssetLines = String(formData.get('asset_lines') || '')

  if (!showId) {
    return { status: 'error', message: 'Select a show before creating an approval batch.' }
  }

  try {
    const parsedAssets = parseManualAssetLines(rawAssetLines, assetType)

    const { data: show, error: showError } = await supabase
      .from('shows')
      .select('id, title, client_id')
      .eq('id', showId)
      .single()

    if (showError || !show) {
      return { status: 'error', message: 'The selected show could not be found.' }
    }

    if (!show.client_id) {
      return { status: 'error', message: 'That show is not assigned to a client yet.' }
    }

    if (episodeId) {
      const { data: episode, error: episodeError } = await supabase
        .from('episodes')
        .select('id, show_id')
        .eq('id', episodeId)
        .single()

      if (episodeError || !episode || episode.show_id !== showId) {
        return { status: 'error', message: 'The selected episode does not belong to that show.' }
      }
    }

    const now = new Date().toISOString()
    const { data: approvalRequest, error: approvalRequestError } = await supabase
      .from('approval_requests')
      .insert({
        client_id: show.client_id,
        show_id: show.id,
        episode_id: episodeId,
        status: 'pending',
        requested_by_role: 'admin',
        updated_at: now,
      })
      .select('id')
      .single()

    if (approvalRequestError || !approvalRequest) {
      throw new Error(approvalRequestError?.message || 'Failed to create approval request.')
    }

    const { data: assetRows, error: assetError } = await supabase
      .from('assets')
      .insert(
        parsedAssets.map((asset, index) => ({
          show_id: show.id,
          episode_id: episodeId,
          asset_type: asset.assetType,
          status: 'awaiting_approval',
          source_provider: 'manual',
          source_url: asset.sourceUrl,
          preview_url: asset.previewUrl,
          title: asset.title,
          metadata: {
            imported_from: 'manual_batch',
            imported_line: index + 1,
          },
          updated_at: now,
        }))
      )
      .select('id')

    if (assetError || !assetRows) {
      await supabase.from('approval_requests').delete().eq('id', approvalRequest.id)
      throw new Error(assetError?.message || 'Failed to create asset records.')
    }

    const { error: itemError } = await supabase
      .from('approval_items')
      .insert(
        assetRows.map((asset, index) => ({
          approval_request_id: approvalRequest.id,
          asset_id: asset.id,
          decision_status: 'pending',
          sort_order: index,
          updated_at: now,
        }))
      )

    if (itemError) {
      await supabase.from('assets').delete().in('id', assetRows.map((asset) => asset.id))
      await supabase.from('approval_requests').delete().eq('id', approvalRequest.id)
      throw new Error(itemError.message)
    }

    revalidatePath('/approvals')
    revalidatePath('/portal/approvals')

    return {
      status: 'success',
      message: `Created approval batch with ${assetRows.length} asset${assetRows.length === 1 ? '' : 's'}.`,
    }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to create approval batch.',
    }
  }
}

export async function updateApprovalItemDecision(formData: FormData) {
  const { supabase, user } = await getAuthenticatedUser()

  const approvalItemId = String(formData.get('approval_item_id') || '')
  const decision = String(formData.get('decision') || '') as ApprovalItemDecisionStatus
  const commentValue = String(formData.get('decision_comment') || '').trim()

  if (!approvalItemId || (decision !== 'approved' && decision !== 'rejected')) {
    throw new Error('Invalid approval decision submitted.')
  }

  const { data: item, error: itemError } = await supabase
    .from('approval_items')
    .select('id, approval_request_id, asset_id')
    .eq('id', approvalItemId)
    .single()

  if (itemError || !item) {
    throw new Error('Approval item not found or unavailable.')
  }

  const now = new Date().toISOString()

  const { error: updateItemError } = await supabase
    .from('approval_items')
    .update({
      decision_status: decision,
      decision_comment: commentValue || null,
      decided_by_email: user.email || null,
      decided_at: now,
      updated_at: now,
    })
    .eq('id', item.id)

  if (updateItemError) {
    throw new Error(updateItemError.message)
  }

  const { error: updateAssetError } = await supabase
    .from('assets')
    .update({
      status: decision === 'approved' ? 'approved' : 'rejected',
      updated_at: now,
    })
    .eq('id', item.asset_id)

  if (updateAssetError) {
    throw new Error(updateAssetError.message)
  }

  const { data: requestItems, error: requestItemsError } = await supabase
    .from('approval_items')
    .select('decision_status')
    .eq('approval_request_id', item.approval_request_id)

  if (requestItemsError || !requestItems) {
    throw new Error(requestItemsError?.message || 'Failed to refresh approval request status.')
  }

  const nextStatus = deriveApprovalRequestStatus(
    requestItems.map((requestItem) => requestItem.decision_status as ApprovalItemDecisionStatus)
  )

  const { error: updateRequestError } = await supabase
    .from('approval_requests')
    .update({
      status: nextStatus,
      updated_at: now,
    })
    .eq('id', item.approval_request_id)

  if (updateRequestError) {
    throw new Error(updateRequestError.message)
  }

  revalidatePath('/approvals')
  revalidatePath('/portal/approvals')
}
