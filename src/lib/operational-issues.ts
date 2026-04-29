export type OperationalIssueSeverity = 'info' | 'warning' | 'error';
export type OperationalIssueScope = 'client' | 'show' | 'episode' | 'destination' | 'short';

export type OperationalIssue = {
  id: string;
  scope: OperationalIssueScope;
  severity: OperationalIssueSeverity;
  code: string;
  title: string;
  message: string;
  entityId: string;
  entityLabel?: string;
  actionHref?: string;
  createdAt: string;
  resolvedAt?: string | null;
};

export type HealthCheckRun = {
  id: string;
  provider: string;
  status: string;
  error_message?: string | null;
  requested_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
};

export type HealthCheckDestination = {
  id: string;
  is_default?: boolean | null;
  zernio_account_id?: string | null;
  account?: {
    id?: string | null;
    external_account_id?: string | null;
    platform?: string | null;
    account_name?: string | null;
    channel_title?: string | null;
  } | null;
};

export type HealthCheckEpisode = {
  id: string;
  title: string;
  media_url?: string | null;
  created_at: string;
  show_id?: string | null;
  show?: {
    id: string;
    title?: string | null;
    captivate_show_id?: string | null;
    client_id?: string | null;
    youtube_reference_art?: string | null;
    podcast_reference_art?: string | null;
    client?: {
      id?: string | null;
      name?: string | null;
      email?: string | null;
    } | null;
    destinations?: HealthCheckDestination[] | null;
  } | null;
  runs?: HealthCheckRun[] | null;
};

const ACTIVE_RUN_STATUSES = new Set(['Processing', 'Queued', 'Pending']);
const SUCCESS_RUN_STATUSES = new Set(['Dispatched', 'Published', 'Scheduled', 'Draft']);

function issue(input: Omit<OperationalIssue, 'id'>) {
  return {
    ...input,
    id: [
      input.scope,
      input.entityId,
      input.code,
      input.createdAt,
    ].join(':'),
  };
}

function minutesSince(value: string | null | undefined, now: Date) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return 0;
  }

  return Math.max(0, Math.floor((now.getTime() - timestamp) / 60000));
}

export function buildEpisodeOperationalIssues(episode: HealthCheckEpisode, now = new Date()) {
  const issues: OperationalIssue[] = [];
  const show = episode.show;
  const destinations = show?.destinations || [];
  const runs = episode.runs || [];
  const episodeHref = `/episodes/${episode.id}`;

  if (!episode.media_url) {
    issues.push(issue({
      scope: 'episode',
      severity: 'error',
      code: 'episode_missing_media',
      title: 'Missing episode media',
      message: 'This episode has no media URL, so it cannot be dispatched to podcast or video destinations.',
      entityId: episode.id,
      entityLabel: episode.title,
      actionHref: episodeHref,
      createdAt: episode.created_at,
    }));
  }

  if (!show) {
    issues.push(issue({
      scope: 'show',
      severity: 'error',
      code: 'episode_missing_show',
      title: 'Show record unavailable',
      message: 'The episode is not connected to a readable show record.',
      entityId: episode.show_id || episode.id,
      entityLabel: episode.title,
      actionHref: episodeHref,
      createdAt: episode.created_at,
    }));
  } else {
    if (!show.client_id || !show.client) {
      issues.push(issue({
        scope: 'client',
        severity: 'warning',
        code: 'show_missing_client',
        title: 'Show has no client mapping',
        message: 'Client ownership is missing, which can block portal visibility and destination routing.',
        entityId: show.id,
        entityLabel: show.title || episode.title,
        actionHref: `/shows`,
        createdAt: episode.created_at,
      }));
    }

    if (!show.captivate_show_id || show.captivate_show_id.includes('pending')) {
      issues.push(issue({
        scope: 'show',
        severity: 'error',
        code: 'show_missing_captivate_id',
        title: 'Captivate show ID missing',
        message: 'Captivate publishing needs a valid provider show ID before this episode can be dispatched.',
        entityId: show.id,
        entityLabel: show.title || episode.title,
        actionHref: `/shows`,
        createdAt: episode.created_at,
      }));
    }

    if (destinations.length === 0) {
      issues.push(issue({
        scope: 'destination',
        severity: 'warning',
        code: 'show_missing_destination',
        title: 'No video destination configured',
        message: 'Full-pipeline publishing needs a default destination account for YouTube/Zernio dispatch.',
        entityId: show.id,
        entityLabel: show.title || episode.title,
        actionHref: `/clients`,
        createdAt: episode.created_at,
      }));
    } else if (!destinations.some((destination) => destination.is_default)) {
      issues.push(issue({
        scope: 'destination',
        severity: 'warning',
        code: 'show_missing_default_destination',
        title: 'No default destination selected',
        message: 'Multiple destinations may exist, but none is marked default for automated dispatch.',
        entityId: show.id,
        entityLabel: show.title || episode.title,
        actionHref: `/clients`,
        createdAt: episode.created_at,
      }));
    }

    for (const destination of destinations) {
      if (!destination.account?.external_account_id) {
        issues.push(issue({
          scope: 'destination',
          severity: 'error',
          code: 'destination_missing_external_account',
          title: 'Destination account is incomplete',
          message: 'A linked destination is missing its external account ID.',
          entityId: destination.id,
          entityLabel: show.title || episode.title,
          actionHref: `/clients`,
          createdAt: episode.created_at,
        }));
      }
    }
  }

  for (const run of runs) {
    const runCreatedAt = run.updated_at || run.requested_at || run.created_at || episode.created_at;

    if (run.status === 'Failed') {
      issues.push(issue({
        scope: 'destination',
        severity: 'error',
        code: `${run.provider}_publish_failed`,
        title: `${run.provider} dispatch failed`,
        message: run.error_message || 'The provider returned an error during dispatch.',
        entityId: run.id,
        entityLabel: episode.title,
        actionHref: episodeHref,
        createdAt: runCreatedAt,
      }));
      continue;
    }

    if (ACTIVE_RUN_STATUSES.has(run.status) && minutesSince(runCreatedAt, now) >= 30) {
      issues.push(issue({
        scope: 'destination',
        severity: 'warning',
        code: `${run.provider}_publish_stuck`,
        title: `${run.provider} dispatch may be stuck`,
        message: `This run has been ${run.status.toLowerCase()} for ${minutesSince(runCreatedAt, now)} minutes.`,
        entityId: run.id,
        entityLabel: episode.title,
        actionHref: episodeHref,
        createdAt: runCreatedAt,
      }));
    }
  }

  if (runs.length > 0 && runs.every((run) => !SUCCESS_RUN_STATUSES.has(run.status) && run.status !== 'Failed')) {
    issues.push(issue({
      scope: 'episode',
      severity: 'info',
      code: 'episode_waiting_on_dispatch',
      title: 'Episode is waiting on dispatch',
      message: 'No destination has reported a completed dispatch yet.',
      entityId: episode.id,
      entityLabel: episode.title,
      actionHref: episodeHref,
      createdAt: episode.created_at,
    }));
  }

  return issues;
}

export function sortOperationalIssues(issues: OperationalIssue[]) {
  const severityRank: Record<OperationalIssueSeverity, number> = {
    error: 0,
    warning: 1,
    info: 2,
  };

  return [...issues].sort((left, right) => {
    const severityDelta = severityRank[left.severity] - severityRank[right.severity];
    if (severityDelta !== 0) {
      return severityDelta;
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}
