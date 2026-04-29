import Link from 'next/link';
import type { ReactNode } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, CircleAlert, Info } from 'lucide-react';
import { getOperationalIssues } from '@/app/actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { OperationalIssue, OperationalIssueSeverity } from '@/lib/operational-issues';

const issueStyles: Record<OperationalIssueSeverity, string> = {
  error: 'border-red-500/20 bg-red-500/10 text-red-300',
  warning: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  info: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
};

const issueIcons: Record<OperationalIssueSeverity, ReactNode> = {
  error: <CircleAlert className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
  info: <Info className="h-4 w-4" />,
};

function countBySeverity(issues: OperationalIssue[], severity: OperationalIssueSeverity) {
  return issues.filter((issue) => issue.severity === severity).length;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export default async function ErrorCenterPage() {
  const { issues } = await getOperationalIssues();
  const errors = countBySeverity(issues, 'error');
  const warnings = countBySeverity(issues, 'warning');
  const infos = countBySeverity(issues, 'info');

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
      <header className="flex flex-col gap-3 border-b border-zinc-800 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Error Center</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Operational issues gathered from episode state, publish runs, and destination configuration.
          </p>
        </div>
        <Button asChild variant="outline" className="w-fit border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">
          <Link href="/">
            Command Center
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card className="border-red-500/20 bg-red-500/10">
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wider text-red-300">Errors</p>
            <p className="mt-1 text-3xl font-bold text-zinc-100">{errors}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-500/20 bg-amber-500/10">
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wider text-amber-300">Warnings</p>
            <p className="mt-1 text-3xl font-bold text-zinc-100">{warnings}</p>
          </CardContent>
        </Card>
        <Card className="border-blue-500/20 bg-blue-500/10">
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wider text-blue-300">Info</p>
            <p className="mt-1 text-3xl font-bold text-zinc-100">{infos}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-zinc-800 bg-zinc-900/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-zinc-100">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            Active Issues
          </CardTitle>
        </CardHeader>
        <CardContent>
          {issues.length === 0 ? (
            <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              No active operational issues detected.
            </div>
          ) : (
            <div className="divide-y divide-zinc-800 overflow-hidden rounded-md border border-zinc-800">
              {issues.map((issue) => (
                <div key={issue.id} className="flex flex-col gap-3 bg-zinc-950/50 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className={`mt-0.5 rounded border p-1.5 ${issueStyles[issue.severity]}`}>
                      {issueIcons[issue.severity]}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-medium text-zinc-100">{issue.title}</h2>
                        <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-zinc-400">
                          {issue.scope}
                        </span>
                      </div>
                      <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-400">{issue.message}</p>
                      <p className="mt-1 text-xs text-zinc-600">
                        {issue.entityLabel || issue.entityId} · {formatDate(issue.createdAt)}
                      </p>
                    </div>
                  </div>
                  {issue.actionHref && (
                    <Button asChild variant="ghost" className="w-fit text-zinc-400 hover:text-zinc-100">
                      <Link href={issue.actionHref}>
                        Open
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
