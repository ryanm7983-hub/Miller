'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { prisma } from '@/lib/db';
import { requireTenantStrict, requirePermission } from '@/lib/tenant';
import { hasFeature } from '@/lib/billing';
import { ai, recordAssessment } from '@/lib/ai';
import { parseTags, stringifyJson } from '@/lib/json';
import { consume, LIMITS } from '@/lib/rate-limit';
import { recordAudit } from '@/lib/audit-log';
import { toFormError } from '@/lib/errors';

export interface SimulatorState {
  error?: string;
  success?: string;
}

/**
 * Starts an "Ask Me Like an Auditor" session.
 *
 * Questions are generated from the project's actual requirements and evidence,
 * weighted toward the weakest areas — that is where practice is worth the most.
 */
export async function startSimulatorAction(
  _prev: SimulatorState,
  formData: FormData
): Promise<SimulatorState> {
  let sessionId: string;

  try {
    const tenant = await requireTenantStrict();
    requirePermission(tenant, 'simulator:use');

    if (!(await hasFeature(tenant.orgId, 'simulator'))) {
      return {
        error:
          'The Audit Simulator is included on the Professional plan and above. Upgrade in Settings → Billing to switch it on.',
      };
    }

    const limit = consume(`simulator:${tenant.orgId}`, LIMITS.aiHeavy.limit, LIMITS.aiHeavy.windowMs);
    if (!limit.ok) {
      return { error: `Too many sessions started recently. Try again in ${limit.retryAfterSeconds} seconds.` };
    }

    const projectId = String(formData.get('projectId') ?? '');
    const count = Math.min(Math.max(Number(formData.get('count') ?? 6) || 6, 3), 12);

    const project = await prisma.auditProject.findFirst({
      where: { id: projectId, orgId: tenant.orgId },
      include: { frameworkVersion: { include: { framework: true } }, org: { select: { name: true } } },
    });
    if (!project) return { error: 'That audit project could not be found.' };

    const projectRequirements = await prisma.projectRequirement.findMany({
      where: { orgId: tenant.orgId, projectId: project.id, status: { not: 'NOT_APPLICABLE' } },
      include: {
        requirement: true,
        links: {
          where: { reviewState: { in: ['APPROVED', 'PENDING'] } },
          include: { evidence: { select: { title: true, filename: true } } },
        },
      },
    });

    if (projectRequirements.length === 0) {
      return { error: 'This project has no applicable requirements to practise against yet.' };
    }

    const result = await ai().generateAuditorQuestions({
      frameworkName: project.frameworkVersion.framework.name,
      organizationName: project.org.name,
      count,
      requirements: projectRequirements.map((pr) => ({
        projectRequirementId: pr.id,
        identifier: pr.requirement.identifier,
        title: pr.requirement.title,
        text: pr.requirement.text,
        guidance: pr.requirement.guidance,
        evidenceSuggestions: parseTags(pr.requirement.evidenceSuggestions),
        importance: pr.importanceOverride ?? pr.requirement.importance,
        status: pr.status,
        evidenceTitles: pr.links.map((l) => l.evidence.title || l.evidence.filename),
      })),
    });

    if (result.data.length === 0) {
      return { error: 'No questions could be generated. Try again, or add more evidence first.' };
    }

    const session = await prisma.simulatorSession.create({
      data: {
        orgId: tenant.orgId,
        projectId: project.id,
        title: `Practice session — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        createdById: tenant.user.id,
        questions: {
          create: result.data.map((question, index) => ({
            projectRequirementId: question.projectRequirementId,
            question: question.question,
            focus: question.focus,
            sortOrder: index,
          })),
        },
      },
    });

    await recordAssessment({
      orgId: tenant.orgId,
      subjectType: 'PROJECT_REQUIREMENT',
      subjectId: session.id,
      kind: 'SIMULATOR_QUESTIONS',
      result,
      summary: `${result.data.length} auditor questions generated.`,
    });

    await recordAudit({
      orgId: tenant.orgId,
      userId: tenant.user.id,
      action: 'ai.analysis_run',
      entityType: 'SimulatorSession',
      entityId: session.id,
      metadata: { kind: 'SIMULATOR_QUESTIONS', questions: result.data.length, provider: result.provider },
    });

    sessionId = session.id;
  } catch (error) {
    return { error: toFormError(error) };
  }

  revalidatePath('/app', 'layout');
  redirect(`/app/simulator/${sessionId}`);
}

/** Submits and evaluates an answer to one auditor question. */
export async function answerQuestionAction(
  _prev: SimulatorState,
  formData: FormData
): Promise<SimulatorState> {
  try {
    const tenant = await requireTenantStrict();
    requirePermission(tenant, 'simulator:use');

    const limit = consume(`simulator-answer:${tenant.orgId}`, LIMITS.aiAnalysis.limit, LIMITS.aiAnalysis.windowMs);
    if (!limit.ok) {
      return { error: `Slow down a moment — try again in ${limit.retryAfterSeconds} seconds.` };
    }

    const questionId = String(formData.get('questionId') ?? '');
    const answer = String(formData.get('answer') ?? '').trim();
    if (answer.length < 2) return { error: 'Write your answer first.' };

    const question = await prisma.simulatorQuestion.findFirst({
      where: { id: questionId, session: { orgId: tenant.orgId } },
      include: {
        session: { select: { id: true, projectId: true } },
        projectRequirement: {
          include: {
            requirement: true,
            links: {
              where: { reviewState: { in: ['APPROVED', 'PENDING'] } },
              include: { evidence: { select: { title: true, filename: true } } },
            },
          },
        },
      },
    });
    if (!question) return { error: 'That question could not be found.' };

    // Evidence on file for this project — what the answer should be citing.
    const availableEvidence = question.projectRequirement
      ? question.projectRequirement.links.map((l) => l.evidence.title || l.evidence.filename)
      : (
          await prisma.evidence.findMany({
            where: { orgId: tenant.orgId, projectId: question.session.projectId },
            select: { title: true, filename: true },
            take: 25,
          })
        ).map((e) => e.title || e.filename);

    const result = await ai().evaluateAnswer({
      question: question.question,
      answer: answer.slice(0, 12000),
      requirementIdentifier: question.projectRequirement?.requirement.identifier,
      requirementTitle: question.projectRequirement?.requirement.title,
      requirementText: question.projectRequirement?.requirement.text,
      availableEvidence,
    });

    const record = await prisma.simulatorAnswer.create({
      data: {
        questionId: question.id,
        userId: tenant.user.id,
        answer: answer.slice(0, 12000),
        score: Math.round(result.data.score),
        evaluation: stringifyJson(result.data),
      },
    });

    await recordAssessment({
      orgId: tenant.orgId,
      subjectType: 'SIMULATOR_ANSWER',
      subjectId: record.id,
      kind: 'SIMULATOR_EVALUATION',
      result,
      summary: result.data.coaching,
      confidence: result.data.score / 100,
    });

    revalidatePath('/app', 'layout');
    return { success: 'Answer evaluated.' };
  } catch (error) {
    return { error: toFormError(error) };
  }
}

export async function completeSimulatorSessionAction(formData: FormData) {
  const tenant = await requireTenantStrict();
  requirePermission(tenant, 'simulator:use');

  const sessionId = String(formData.get('sessionId') ?? '');
  const result = await prisma.simulatorSession.updateMany({
    where: { id: sessionId, orgId: tenant.orgId },
    data: { status: 'COMPLETE' },
  });
  if (result.count === 0) throw new Error('That session could not be found.');

  revalidatePath('/app', 'layout');
}
