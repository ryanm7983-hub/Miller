import type { Metadata } from 'next';
import Link from 'next/link';
import { MessagesSquare } from 'lucide-react';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { resolveProject } from '@/lib/projects';
import { can } from '@/lib/auth/rbac';
import { getSubscription, hasFeature } from '@/lib/billing';
import { Card, CardHeader, EmptyState, PageHeader, Alert } from '@/components/ui/primitives';
import { Badge } from '@/components/ui/badge';
import { ProjectPicker } from '@/components/app/project-picker';
import { formatDateTime } from '@/lib/utils';
import { StartSimulatorForm } from './start-form';

export const metadata: Metadata = { title: 'Audit simulator' };

export default async function SimulatorPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const tenant = await requireTenant();
  const sp = await searchParams;
  const { project, projects } = await resolveProject(tenant, sp.project);

  if (!project) {
    return (
      <div>
        <PageHeader title="Audit simulator" />
        <Card>
          <EmptyState
            icon={<MessagesSquare className="h-5 w-5" />}
            title="No audit project yet"
            description="The simulator generates questions from a project's requirements and evidence."
            action={
              <Link href="/app/audits/new" className="btn-primary btn-md">
                Create audit project
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const [sessions, enabled, subscription] = await Promise.all([
    prisma.simulatorSession.findMany({
      where: { orgId: tenant.orgId, projectId: project.id },
      include: {
        createdBy: { select: { name: true } },
        questions: { include: { answers: { select: { score: true }, orderBy: { createdAt: 'desc' }, take: 1 } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    hasFeature(tenant.orgId, 'simulator'),
    getSubscription(tenant.orgId),
  ]);

  return (
    <div>
      <PageHeader
        title="Ask Me Like an Auditor"
        description="Practise the questions before the day. The simulator generates them from your framework and the evidence you actually have — then scores how you answered."
        action={<ProjectPicker projects={projects} activeId={project.id} basePath="/app/simulator" />}
      />

      {!enabled && (
        <Alert tone="info" className="mb-4" title="Included on Professional and above">
          Your organization is on the {subscription.plan.name} plan. The Audit Simulator is available on Professional and
          Business.{' '}
          <Link href="/app/settings/billing" className="link font-medium">
            See plans
          </Link>
          .
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr,340px]">
        <div className="space-y-4">
          {sessions.length === 0 ? (
            <Card>
              <EmptyState
                icon={<MessagesSquare className="h-5 w-5" />}
                title="No practice sessions yet"
                description="Start one to see the questions an experienced auditor would ask about this project — targeted at your weakest requirements first."
              />
            </Card>
          ) : (
            <Card>
              <CardHeader title="Previous sessions" />
              <ul className="divide-y divide-ink-100">
                {sessions.map((session) => {
                  const answered = session.questions.filter((q) => q.answers.length > 0);
                  const average =
                    answered.length > 0
                      ? Math.round(answered.reduce((sum, q) => sum + (q.answers[0]?.score ?? 0), 0) / answered.length)
                      : null;
                  return (
                    <li key={session.id}>
                      <Link
                        href={`/app/simulator/${session.id}`}
                        className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-ink-50/70"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] font-medium text-ink-900">{session.title}</p>
                          <p className="mt-0.5 text-[12px] text-ink-500">
                            {session.createdBy.name} · {formatDateTime(session.createdAt)} ·{' '}
                            {answered.length}/{session.questions.length} answered
                          </p>
                        </div>
                        {average !== null && (
                          <span
                            className={`tnum text-[17px] font-bold ${
                              average >= 80 ? 'text-strong-600' : average >= 55 ? 'text-caution-600' : 'text-risk-600'
                            }`}
                          >
                            {average}%
                          </span>
                        )}
                        <Badge tone={session.status === 'COMPLETE' ? 'muted' : 'info'} size="sm">
                          {session.status === 'COMPLETE' ? 'Complete' : 'In progress'}
                        </Badge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Start a session" description="Questions are generated fresh each time." />
            <div className="p-5">
              <StartSimulatorForm
                projectId={project.id}
                disabled={!enabled || !can(tenant.role, 'simulator:use')}
              />
            </div>
          </Card>

          <Card className="p-5">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-500">How it scores</p>
            <ul className="mt-3 space-y-2 text-[12.5px] leading-relaxed text-ink-600">
              <li>
                <strong className="font-semibold text-ink-800">Clarity</strong> — does the answer describe the process,
                or just name it?
              </li>
              <li>
                <strong className="font-semibold text-ink-800">Evidence referenced</strong> — did you name a specific
                record an auditor could ask to see?
              </li>
              <li>
                <strong className="font-semibold text-ink-800">Consistency</strong> — who is responsible, how often it
                happens, and how effectiveness is verified.
              </li>
            </ul>
            <p className="mt-4 border-t border-ink-100 pt-3 text-[12px] leading-relaxed text-ink-500">
              This is preparation practice, not an audit. Scores are coaching feedback and carry no compliance meaning.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
