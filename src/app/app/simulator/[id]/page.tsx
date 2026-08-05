import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { can } from '@/lib/auth/rbac';
import { parseJson } from '@/lib/json';
import type { AnswerEvaluation } from '@/lib/ai/types';
import { Card, CardHeader, PageHeader, Stat } from '@/components/ui/primitives';
import { Badge } from '@/components/ui/badge';
import { SubmitButton } from '@/components/ui/form';
import { completeSimulatorSessionAction } from '../actions';
import { QuestionCard } from './question-card';
import { formatDateTime } from '@/lib/utils';

export const metadata: Metadata = { title: 'Practice session' };

export default async function SimulatorSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const tenant = await requireTenant();
  const { id } = await params;

  const session = await prisma.simulatorSession.findFirst({
    where: { id, orgId: tenant.orgId },
    include: {
      project: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      questions: {
        orderBy: { sortOrder: 'asc' },
        include: {
          projectRequirement: { include: { requirement: { select: { identifier: true, title: true } } } },
          answers: { orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true } } } },
        },
      },
    },
  });
  if (!session) notFound();

  const answered = session.questions.filter((q) => q.answers.length > 0);
  const average =
    answered.length > 0
      ? Math.round(answered.reduce((sum, q) => sum + (q.answers[0]?.score ?? 0), 0) / answered.length)
      : null;

  const canUse = can(tenant.role, 'simulator:use');

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={session.title}
        description={`${session.project.name} · started by ${session.createdBy.name} on ${formatDateTime(session.createdAt)}`}
        breadcrumb={[
          { label: 'Simulator', href: `/app/simulator?project=${session.projectId}` },
          { label: 'Session' },
        ]}
        action={
          session.status !== 'COMPLETE' && canUse ? (
            <form action={completeSimulatorSessionAction}>
              <input type="hidden" name="sessionId" value={session.id} />
              <SubmitButton variant="secondary" pendingLabel="Closing…">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Mark session complete
              </SubmitButton>
            </form>
          ) : (
            <Badge tone="muted">Complete</Badge>
          )
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card>
          <Stat label="Answered" value={`${answered.length}/${session.questions.length}`} />
        </Card>
        <Card>
          <Stat
            label="Average readiness"
            value={average !== null ? `${average}%` : '—'}
            tone={average === null ? 'default' : average >= 80 ? 'strong' : average >= 55 ? 'caution' : 'risk'}
            sub="Across answered questions"
          />
        </Card>
        <Card>
          <Stat
            label="Weakest answer"
            value={
              answered.length > 0
                ? `${Math.min(...answered.map((q) => q.answers[0]?.score ?? 0))}%`
                : '—'
            }
            tone="caution"
          />
        </Card>
      </div>

      <div className="space-y-4">
        {session.questions.map((question, index) => {
          const latest = question.answers[0];
          return (
            <QuestionCard
              key={question.id}
              index={index + 1}
              question={{
                id: question.id,
                question: question.question,
                focus: question.focus,
                requirementHref: question.projectRequirementId
                  ? `/app/requirements/${question.projectRequirementId}`
                  : null,
                requirementLabel: question.projectRequirement
                  ? `${question.projectRequirement.requirement.identifier} — ${question.projectRequirement.requirement.title}`
                  : null,
              }}
              latestAnswer={
                latest
                  ? {
                      answer: latest.answer,
                      score: latest.score,
                      userName: latest.user.name,
                      createdAt: latest.createdAt.toISOString(),
                      evaluation: parseJson<AnswerEvaluation | null>(latest.evaluation, null),
                    }
                  : null
              }
              attempts={question.answers.length}
              canAnswer={canUse && session.status !== 'COMPLETE'}
            />
          );
        })}
      </div>

      <Card className="mt-5 p-5">
        <p className="text-[12.5px] leading-relaxed text-ink-500">
          This is a preparation exercise. The questions are generated from your framework and evidence, and the scores
          are coaching feedback on how an answer would land — they are not an audit, an assessment of compliance, or a
          prediction of an audit outcome.
        </p>
      </Card>

      <div className="mt-4">
        <Link href={`/app/audits/${session.projectId}/prepare`} className="btn-secondary btn-md">
          Back to preparation plan
        </Link>
      </div>
    </div>
  );
}
