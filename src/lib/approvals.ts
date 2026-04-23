export type ApprovalItemDecisionStatus = 'pending' | 'approved' | 'rejected'
export type ApprovalRequestStatus = 'pending' | 'partially_approved' | 'approved' | 'rejected'

export type ParsedManualAsset = {
  title: string | null
  sourceUrl: string
  previewUrl: string | null
  assetType: string
}

export type ApprovalAssetRecord = {
  id: string
  title: string | null
  asset_type: string
  status: string
  source_url: string
  preview_url: string | null
  metadata: Record<string, unknown> | null
}

export type ApprovalItemRecord = {
  id: string
  decision_status: ApprovalItemDecisionStatus
  decision_comment: string | null
  decided_by_email: string | null
  decided_at: string | null
  sort_order: number
  asset: ApprovalAssetRecord | null
}

export type ApprovalRequestRecord = {
  id: string
  client_id: string
  show_id: string
  episode_id: string | null
  status: ApprovalRequestStatus
  requested_by_role: 'admin' | 'client' | 'system'
  created_at: string
  updated_at: string
  client: {
    name: string | null
    email: string | null
  } | null
  show: {
    title: string | null
  } | null
  episode: {
    title: string | null
  } | null
  items: ApprovalItemRecord[]
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function parseManualAssetLines(rawValue: string, assetType: string) {
  const lines = rawValue
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    throw new Error('Paste at least one asset URL to create an approval batch.')
  }

  return lines.map((line, index) => {
    const parts = line.split('|').map((part) => part.trim()).filter(Boolean)

    let title: string | null = null
    let sourceUrl = ''
    let previewUrl: string | null = null

    if (parts.length === 1) {
      sourceUrl = parts[0]
    } else if (parts.length >= 2) {
      title = parts[0]
      sourceUrl = parts[1]
      previewUrl = parts[2] || null
    }

    if (!isHttpUrl(sourceUrl)) {
      throw new Error(`Line ${index + 1} must include a valid http(s) asset URL.`)
    }

    if (previewUrl && !isHttpUrl(previewUrl)) {
      throw new Error(`Line ${index + 1} includes an invalid preview URL.`)
    }

    return {
      title,
      sourceUrl,
      previewUrl,
      assetType,
    } satisfies ParsedManualAsset
  })
}

export function deriveApprovalRequestStatus(decisions: ApprovalItemDecisionStatus[]): ApprovalRequestStatus {
  if (decisions.length === 0 || decisions.every((decision) => decision === 'pending')) {
    return 'pending'
  }

  if (decisions.every((decision) => decision === 'approved')) {
    return 'approved'
  }

  if (decisions.every((decision) => decision === 'rejected')) {
    return 'rejected'
  }

  return 'partially_approved'
}

export function sortApprovalRequestItems(request: ApprovalRequestRecord) {
  return {
    ...request,
    items: [...request.items].sort((left, right) => left.sort_order - right.sort_order),
  }
}

export function isImageAsset(url: string | null | undefined) {
  if (!url) {
    return false
  }

  return /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(url)
}

export function isVideoAsset(url: string | null | undefined) {
  if (!url) {
    return false
  }

  return /\.(mp4|mov|m4v|webm|ogg)$/i.test(url)
}
