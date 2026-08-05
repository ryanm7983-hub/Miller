/**
 * Development seed.
 *
 * Builds a realistic, fully-populated workspace by driving the *real* pipeline:
 * documents are written through the storage adapter, text is extracted by the
 * real extractor, and the real AI provider produces the requirement matches and
 * document-level gaps. Nothing here fabricates analysis results — the seeded
 * state is exactly what a customer would get by uploading these files.
 *
 * Run with `npm run db:seed`. Safe to re-run: it clears the demo organizations
 * first.
 */
import { PrismaClient } from '@prisma/client';

import { hashPassword } from '../src/lib/auth/password';
import { ensureSystemFrameworks } from '../src/lib/frameworks';
import { storage, buildStorageKey } from '../src/lib/storage';
import { extractDocumentText } from '../src/lib/documents/extract';
import { ai, recordAssessment, type RequirementRef } from '../src/lib/ai';
import { parseTags, stringifyJson } from '../src/lib/json';
import { syncProjectGaps, fingerprint } from '../src/lib/gaps';
import { deriveRequirementStatus, recomputeProjectScores } from '../src/lib/scoring';
import { SEED_DOCUMENTS } from './seed-documents';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'AuditReady2026!';
const DEMO_SLUGS = ['northfield-manufacturing', 'coastline-food-co', 'meridian-compliance-partners'];

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}

async function main() {
  console.log('▶ Seeding AuditReady demo data…\n');

  // ---------------------------------------------------------------- reset
  const existing = await prisma.organization.findMany({
    where: { slug: { in: DEMO_SLUGS } },
    select: { id: true },
  });
  if (existing.length > 0) {
    await prisma.organization.deleteMany({ where: { id: { in: existing.map((o) => o.id) } } });
    console.log(`  cleared ${existing.length} existing demo organization(s)`);
  }
  await prisma.user.deleteMany({
    where: { email: { in: ['dana@northfield.example', 'sam@northfield.example', 'tomas@northfield.example', 'priya@meridian.example'] } },
  });

  await ensureSystemFrameworks();
  console.log('  installed bundled frameworks');

  // ---------------------------------------------------------------- people
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const [dana, tomas, sam, priya] = await Promise.all([
    prisma.user.create({
      data: { email: 'dana@northfield.example', name: 'Dana Whitfield', jobTitle: 'Quality Manager', passwordHash, avatarSeed: 'dana@northfield.example' },
    }),
    prisma.user.create({
      data: { email: 'tomas@northfield.example', name: 'Tomas Bassey', jobTitle: 'Production Supervisor', passwordHash, avatarSeed: 'tomas@northfield.example' },
    }),
    prisma.user.create({
      data: { email: 'sam@northfield.example', name: 'Sam Okafor', jobTitle: 'CNC Operator', passwordHash, avatarSeed: 'sam@northfield.example' },
    }),
    prisma.user.create({
      data: { email: 'priya@meridian.example', name: 'Priya Anand', jobTitle: 'Lead Consultant', passwordHash, avatarSeed: 'priya@meridian.example' },
    }),
  ]);
  console.log('  created 4 users');

  const departments = [
    'Quality',
    'Operations',
    'Production',
    'Maintenance',
    'Engineering',
    'Health & Safety',
    'Purchasing',
    'People / HR',
    'Despatch',
  ];

  // ------------------------------------------------------- organizations
  const northfield = await prisma.organization.create({
    data: {
      name: 'Northfield Manufacturing',
      slug: 'northfield-manufacturing',
      kind: 'STANDARD',
      industry: 'Manufacturing',
      sizeBand: '11–50',
      country: 'United States',
      departments: { create: departments.map((name) => ({ name })) },
      memberships: {
        create: [
          { userId: dana.id, role: 'OWNER', status: 'ACTIVE', department: 'Quality' },
          { userId: tomas.id, role: 'MANAGER', status: 'ACTIVE', department: 'Production' },
          { userId: sam.id, role: 'CONTRIBUTOR', status: 'ACTIVE', department: 'Production' },
        ],
      },
      subscription: {
        create: {
          planKey: 'professional',
          status: 'ACTIVE',
          provider: 'simulator',
          currentPeriodEnd: daysFromNow(24),
          seats: 10,
        },
      },
    },
  });

  const coastline = await prisma.organization.create({
    data: {
      name: 'Coastline Food Co.',
      slug: 'coastline-food-co',
      kind: 'STANDARD',
      industry: 'Food & beverage',
      sizeBand: '51–200',
      country: 'United States',
      departments: { create: ['Quality', 'Production', 'Hygiene', 'Warehouse'].map((name) => ({ name })) },
      memberships: { create: [{ userId: dana.id, role: 'VIEWER', status: 'ACTIVE' }] },
      subscription: {
        create: { planKey: 'starter', status: 'ACTIVE', provider: 'simulator', currentPeriodEnd: daysFromNow(12) },
      },
    },
  });

  const meridian = await prisma.organization.create({
    data: {
      name: 'Meridian Compliance Partners',
      slug: 'meridian-compliance-partners',
      kind: 'CONSULTANCY',
      industry: 'Engineering services',
      sizeBand: '1–10',
      country: 'United States',
      departments: { create: ['Consulting'].map((name) => ({ name })) },
      memberships: { create: [{ userId: priya.id, role: 'OWNER', status: 'ACTIVE' }] },
      subscription: {
        create: { planKey: 'business', status: 'ACTIVE', provider: 'simulator', currentPeriodEnd: daysFromNow(19) },
      },
    },
  });

  // Consultant engagements — this is what makes the client portfolio real.
  await prisma.clientEngagement.createMany({
    data: [
      { consultancyOrgId: meridian.id, clientOrgId: northfield.id, status: 'ACTIVE', grantedRole: 'MANAGER' },
      { consultancyOrgId: meridian.id, clientOrgId: coastline.id, status: 'ACTIVE', grantedRole: 'MANAGER' },
    ],
  });
  console.log('  created 3 organizations and 2 consultant engagements');

  // ------------------------------------------------------------- projects
  const qmsVersion = await prisma.frameworkVersion.findFirst({
    where: { framework: { key: 'demo-qms' } },
    include: { requirements: { orderBy: { sortOrder: 'asc' } } },
  });
  const safetyVersion = await prisma.frameworkVersion.findFirst({
    where: { framework: { key: 'demo-safety' } },
    include: { requirements: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!qmsVersion || !safetyVersion) throw new Error('Bundled frameworks are missing.');

  const mainProject = await prisma.auditProject.create({
    data: {
      orgId: northfield.id,
      name: 'Recertification Audit 2026',
      frameworkVersionId: qmsVersion.id,
      auditType: 'CERTIFICATION',
      scope: 'Design, manufacture, inspection and distribution of precision machined components at the Northfield site.',
      auditDate: daysFromNow(72),
      status: 'IN_PROGRESS',
      leadUserId: dana.id,
      requirements: {
        create: qmsVersion.requirements.map((requirement) => ({
          orgId: northfield.id,
          requirementId: requirement.id,
          status: 'NOT_ASSESSED',
        })),
      },
    },
  });

  const safetyProject = await prisma.auditProject.create({
    data: {
      orgId: northfield.id,
      name: 'Annual Safety Self-Assessment',
      frameworkVersionId: safetyVersion.id,
      auditType: 'INTERNAL',
      scope: 'All areas of the Northfield site including contractors.',
      auditDate: daysFromNow(160),
      status: 'PLANNING',
      leadUserId: tomas.id,
      requirements: {
        create: safetyVersion.requirements.map((requirement) => ({
          orgId: northfield.id,
          requirementId: requirement.id,
          status: 'NOT_ASSESSED',
        })),
      },
    },
  });

  const coastlineProject = await prisma.auditProject.create({
    data: {
      orgId: coastline.id,
      name: 'Customer Audit — Q3',
      frameworkVersionId: qmsVersion.id,
      auditType: 'CUSTOMER',
      auditDate: daysFromNow(26),
      status: 'IN_PROGRESS',
      requirements: {
        create: qmsVersion.requirements.map((requirement) => ({
          orgId: coastline.id,
          requirementId: requirement.id,
          status: 'NOT_ASSESSED',
        })),
      },
    },
  });
  console.log('  created 3 audit projects');

  // --------------------------------------------- evidence (real pipeline)
  const owners = [dana.id, tomas.id, sam.id];
  const evidenceIds: string[] = [];

  for (const [index, document] of SEED_DOCUMENTS.entries()) {
    const buffer = Buffer.from(document.content, 'utf8');
    const key = buildStorageKey(northfield.id, document.filename);
    const stored = await storage().put(key, buffer, document.mimeType);
    const extraction = await extractDocumentText(buffer, document.mimeType);

    const evidence = await prisma.evidence.create({
      data: {
        orgId: northfield.id,
        projectId: mainProject.id,
        title: document.filename.replace(/\.[^.]+$/, ''),
        filename: document.filename,
        storageKey: stored.key,
        mimeType: document.mimeType,
        sizeBytes: stored.sizeBytes,
        checksum: stored.checksum,
        documentType: document.documentType,
        department: document.department,
        revision: document.revision ?? null,
        effectiveDate: document.effectiveDaysAgo ? daysFromNow(-document.effectiveDaysAgo) : null,
        expiresAt: document.expiresInDays ? daysFromNow(document.expiresInDays) : null,
        tags: stringifyJson(document.tags ?? []),
        uploadedById: dana.id,
        // A couple are deliberately left unowned so the gap engine finds them.
        ownerUserId: index % 5 === 4 ? null : owners[index % owners.length],
        extractedText: extraction.text || null,
        extractionStatus: extraction.status,
        extractionNote: extraction.note,
        ocrUsed: extraction.ocrUsed,
        pageCount: extraction.pageCount,
        status: index % 4 === 0 ? 'ACCEPTED' : 'PENDING_REVIEW',
      },
    });
    evidenceIds.push(evidence.id);
  }
  console.log(`  uploaded and extracted ${evidenceIds.length} evidence documents`);

  // ------------------------------------------------------- real analysis
  const projectRequirements = await prisma.projectRequirement.findMany({
    where: { orgId: northfield.id, projectId: mainProject.id },
    include: { requirement: true },
  });

  const requirementRefs: RequirementRef[] = projectRequirements.map((pr) => ({
    projectRequirementId: pr.id,
    identifier: pr.requirement.identifier,
    title: pr.requirement.title,
    text: pr.requirement.text,
    guidance: pr.requirement.guidance,
    evidenceSuggestions: parseTags(pr.requirement.evidenceSuggestions),
    importance: pr.requirement.importance,
  }));

  const validRequirementIds = new Set(projectRequirements.map((pr) => pr.id));
  let totalMatches = 0;
  let totalAiGaps = 0;

  for (const evidenceId of evidenceIds) {
    const evidence = await prisma.evidence.findUniqueOrThrow({ where: { id: evidenceId } });
    if (!evidence.extractedText) continue;

    const result = await ai().analyzeDocument({
      filename: evidence.filename,
      mimeType: evidence.mimeType,
      text: evidence.extractedText,
      requirements: requirementRefs,
      today: new Date().toISOString().slice(0, 10),
      organizationName: northfield.name,
      frameworkName: 'Demo Quality Management Framework',
    });

    for (const match of result.data.matches) {
      if (!validRequirementIds.has(match.projectRequirementId)) continue;
      await prisma.evidenceLink.upsert({
        where: {
          evidenceId_projectRequirementId: {
            evidenceId: evidence.id,
            projectRequirementId: match.projectRequirementId,
          },
        },
        create: {
          orgId: northfield.id,
          evidenceId: evidence.id,
          projectRequirementId: match.projectRequirementId,
          source: 'AI',
          relevance: match.relevance,
          confidence: match.confidence,
          strength: match.strength,
          rationale: match.rationale,
          concerns: stringifyJson(match.concerns),
          reviewState: 'PENDING',
        },
        update: {},
      });
      totalMatches++;
    }

    for (const gap of result.data.potentialGaps.slice(0, 6)) {
      const fp = fingerprint(['AI', gap.type, evidence.id, gap.title]);
      await prisma.gap.upsert({
        where: { projectId_fingerprint: { projectId: mainProject.id, fingerprint: fp } },
        create: {
          orgId: northfield.id,
          projectId: mainProject.id,
          evidenceId: evidence.id,
          type: gap.type,
          severity: gap.severity,
          title: gap.title,
          description: gap.description,
          recommendation: gap.recommendation,
          detectedBy: 'AI',
          department: evidence.department,
          fingerprint: fp,
        },
        update: {},
      });
      totalAiGaps++;
    }

    await prisma.evidence.update({
      where: { id: evidence.id },
      data: {
        analysisStatus: 'COMPLETE',
        analyzedAt: new Date(),
        documentType: evidence.documentType === 'other' ? result.data.documentType : evidence.documentType,
      },
    });

    await recordAssessment({
      orgId: northfield.id,
      subjectType: 'EVIDENCE',
      subjectId: evidence.id,
      kind: 'DOCUMENT_ANALYSIS',
      result,
      summary: result.data.summary,
      confidence: result.data.overallConfidence,
    });
  }
  console.log(`  analysis produced ${totalMatches} requirement matches and ${totalAiGaps} document gaps`);

  // ------------------------------------- human review of a realistic subset
  const links = await prisma.evidenceLink.findMany({
    where: { orgId: northfield.id, projectRequirement: { projectId: mainProject.id } },
    orderBy: { relevance: 'desc' },
  });

  // Approve the strongest ~75%, reject a few weak ones, leave the rest pending
  // so the "awaiting review" state is visible on the dashboard.
  const approveCount = Math.floor(links.length * 0.75);
  for (const [index, link] of links.entries()) {
    if (index < approveCount) {
      await prisma.evidenceLink.update({
        where: { id: link.id },
        data: { reviewState: 'APPROVED', decidedById: dana.id, decidedAt: daysFromNow(-3) },
      });
    } else if (link.strength === 'WEAK' && index % 3 === 0) {
      await prisma.evidenceLink.update({
        where: { id: link.id },
        data: { reviewState: 'REJECTED', decidedById: dana.id, decidedAt: daysFromNow(-2) },
      });
    }
  }

  // Derive requirement statuses from the reviewed links.
  for (const pr of projectRequirements) {
    const prLinks = await prisma.evidenceLink.findMany({
      where: { projectRequirementId: pr.id },
      select: { reviewState: true, strength: true, relevance: true },
    });
    await prisma.projectRequirement.update({
      where: { id: pr.id },
      data: {
        status: deriveRequirementStatus(prLinks),
        statusSource: 'SYSTEM',
        lastAssessedAt: prLinks.length > 0 ? daysFromNow(-3) : null,
      },
    });
  }

  // A few explicit human decisions, including one not-applicable.
  const byIdentifier = new Map(projectRequirements.map((pr) => [pr.requirement.identifier, pr]));
  const humanCalls: Array<[string, string, string | null, string | null]> = [
    // Well-evidenced areas an experienced team would already have closed out.
    ['DEMO-4.1', 'SATISFIED', dana.id, null],
    ['DEMO-4.2', 'SATISFIED', dana.id, null],
    ['DEMO-4.3', 'SATISFIED', tomas.id, null],
    ['DEMO-5.1', 'SATISFIED', dana.id, null],
    ['DEMO-5.2', 'SATISFIED', dana.id, null],
    ['DEMO-5.3', 'SATISFIED', dana.id, null],
    ['DEMO-6.1', 'SATISFIED', dana.id, null],
    ['DEMO-6.2', 'SATISFIED', dana.id, null],
    ['DEMO-7.4', 'SATISFIED', dana.id, null],
    ['DEMO-7.5', 'SATISFIED', dana.id, null],
    ['DEMO-8.1', 'SATISFIED', tomas.id, null],
    ['DEMO-8.6', 'SATISFIED', tomas.id, null],
    ['DEMO-9.1', 'SATISFIED', dana.id, null],
    ['DEMO-9.3', 'SATISFIED', dana.id, null],
    ['DEMO-10.1', 'SATISFIED', dana.id, null],
    // Genuinely partial — the evidence exists but has holes in it.
    ['DEMO-7.2', 'PARTIALLY_SATISFIED', dana.id, null],
    ['DEMO-8.5', 'PARTIALLY_SATISFIED', tomas.id, null],
    ['DEMO-7.1', 'PARTIALLY_SATISFIED', tomas.id, null],
    ['DEMO-6.3', 'PARTIALLY_SATISFIED', dana.id, null],
    ['DEMO-10.2', 'PARTIALLY_SATISFIED', dana.id, null],
    // The real problems this demo is built around.
    ['DEMO-8.3', 'MISSING', dana.id, null],
    ['DEMO-7.3', 'MISSING', sam.id, null],
    ['DEMO-9.2', 'NEEDS_REVIEW', dana.id, null],
    ['DEMO-8.2', 'NEEDS_REVIEW', tomas.id, null],
    [
      'DEMO-8.4',
      'NOT_APPLICABLE',
      dana.id,
      'All product is manufactured to customer-supplied drawings against a single cast per works order; unique serialisation is not required by any current customer specification.',
    ],
  ];

  for (const [identifier, status, ownerId, justification] of humanCalls) {
    const pr = byIdentifier.get(identifier);
    if (!pr) continue;
    await prisma.projectRequirement.update({
      where: { id: pr.id },
      data: {
        status,
        statusSource: 'HUMAN',
        ownerUserId: ownerId,
        naJustification: justification,
        lastAssessedAt: daysFromNow(-2),
        department: identifier.startsWith('DEMO-8') ? 'Production' : 'Quality',
      },
    });
  }

  // Owners across the rest so the org does not look unmanaged.
  for (const [index, pr] of projectRequirements.entries()) {
    if (index % 3 === 0) continue; // leave some unowned for the gap engine
    await prisma.projectRequirement.updateMany({
      where: { id: pr.id, ownerUserId: null },
      data: { ownerUserId: owners[index % owners.length] },
    });
  }
  console.log('  applied human review decisions');

  // ------------------------------------------------------ gaps + actions
  await syncProjectGaps(northfield.id, mainProject.id);
  await syncProjectGaps(northfield.id, safetyProject.id);
  await syncProjectGaps(coastline.id, coastlineProject.id);

  const topGaps = await prisma.gap.findMany({
    where: { orgId: northfield.id, projectId: mainProject.id, status: 'OPEN' },
    orderBy: [{ severity: 'asc' }],
    take: 6,
  });

  const actionSeeds: Array<{ status: string; dueInDays: number; ownerId: string }> = [
    { status: 'IN_PROGRESS', dueInDays: 21, ownerId: dana.id },
    { status: 'OPEN', dueInDays: 14, ownerId: tomas.id },
    { status: 'OPEN', dueInDays: -6, ownerId: sam.id },
    { status: 'BLOCKED', dueInDays: 9, ownerId: tomas.id },
    { status: 'COMPLETE', dueInDays: -12, ownerId: dana.id },
    { status: 'VERIFIED', dueInDays: -25, ownerId: dana.id },
  ];

  for (const [index, gap] of topGaps.entries()) {
    const seed = actionSeeds[index % actionSeeds.length];
    const reference = `CA-${String(index + 1).padStart(4, '0')}`;
    const complete = seed.status === 'COMPLETE' || seed.status === 'VERIFIED';

    await prisma.action.create({
      data: {
        orgId: northfield.id,
        projectId: mainProject.id,
        gapId: gap.id,
        reference,
        title: `Address: ${gap.title}`.slice(0, 150),
        description: `${gap.description}\n\n${gap.recommendation ?? 'Review the affected records and correct them.'}\n\nRaised from the Gap Center during preparation for the recertification audit.`,
        ownerUserId: seed.ownerId,
        department: gap.department,
        dueDate: daysFromNow(seed.dueInDays),
        priority: gap.severity,
        status: seed.status,
        source: gap.detectedBy === 'AI' ? 'AI' : 'HUMAN',
        createdById: dana.id,
        completedAt: complete ? daysFromNow(seed.dueInDays + 2) : null,
        verifiedById: seed.status === 'VERIFIED' ? dana.id : null,
        verifiedAt: seed.status === 'VERIFIED' ? daysFromNow(seed.dueInDays + 4) : null,
      },
    });

    if (seed.status !== 'OPEN') {
      await prisma.gap.update({
        where: { id: gap.id },
        data: {
          status: seed.status === 'VERIFIED' ? 'RESOLVED' : 'IN_PROGRESS',
          ownerUserId: seed.ownerId,
          dueDate: daysFromNow(seed.dueInDays),
          resolvedAt: seed.status === 'VERIFIED' ? daysFromNow(seed.dueInDays + 4) : null,
        },
      });
    }
  }
  console.log(`  created ${topGaps.length} tracked actions from gaps`);

  // ------------------------------------------------------------- comments
  const firstAction = await prisma.action.findFirst({
    where: { orgId: northfield.id },
    orderBy: { createdAt: 'asc' },
  });
  if (firstAction) {
    await prisma.comment.createMany({
      data: [
        {
          orgId: northfield.id,
          entityType: 'ACTION',
          entityId: firstAction.id,
          userId: tomas.id,
          body: 'I have the paper sign-off sheets for two of these in the cell 1 folder — I will scan them and attach this week.',
        },
        {
          orgId: northfield.id,
          entityType: 'ACTION',
          entityId: firstAction.id,
          userId: dana.id,
          body: 'Good. Once they are in, link them to DEMO-7.2 so the matrix reflects it. The rest need the assessor to sign, so book 20 minutes with Lena.',
        },
      ],
    });
  }

  // ---------------------------------------------------------- simulator
  const simulatorRequirements = await prisma.projectRequirement.findMany({
    where: { orgId: northfield.id, projectId: mainProject.id, status: { not: 'NOT_APPLICABLE' } },
    include: {
      requirement: true,
      links: {
        where: { reviewState: { in: ['APPROVED', 'PENDING'] } },
        include: { evidence: { select: { title: true, filename: true } } },
      },
    },
  });

  const questionResult = await ai().generateAuditorQuestions({
    frameworkName: 'Demo Quality Management Framework',
    organizationName: northfield.name,
    count: 5,
    requirements: simulatorRequirements.map((pr) => ({
      projectRequirementId: pr.id,
      identifier: pr.requirement.identifier,
      title: pr.requirement.title,
      text: pr.requirement.text,
      guidance: pr.requirement.guidance,
      evidenceSuggestions: parseTags(pr.requirement.evidenceSuggestions),
      importance: pr.requirement.importance,
      status: pr.status,
      evidenceTitles: pr.links.map((l) => l.evidence.title || l.evidence.filename),
    })),
  });

  const simulatorSession = await prisma.simulatorSession.create({
    data: {
      orgId: northfield.id,
      projectId: mainProject.id,
      title: 'Practice session — competence and calibration',
      createdById: dana.id,
      questions: {
        create: questionResult.data.map((question, index) => ({
          projectRequirementId: question.projectRequirementId,
          question: question.question,
          focus: question.focus,
          sortOrder: index,
        })),
      },
    },
    include: { questions: { orderBy: { sortOrder: 'asc' } } },
  });

  // Answer the first two so the session shows real scored feedback.
  const sampleAnswers = [
    'We keep a training matrix that lists every role and the training each role needs. New starters complete an induction and their supervisor signs the record. For machine setting we also do a practical assessment before anyone works unsupervised, and that is recorded on the matrix with the assessor name and date.',
    'Every gauge is on the calibration register with its due date. Camden Calibration do the external calibrations and we file the certificates. If something goes past its date it comes out of service.',
  ];

  for (const [index, question] of simulatorSession.questions.slice(0, 2).entries()) {
    const evaluation = await ai().evaluateAnswer({
      question: question.question,
      answer: sampleAnswers[index],
      availableEvidence: SEED_DOCUMENTS.map((d) => d.filename.replace(/\.[^.]+$/, '')),
    });
    await prisma.simulatorAnswer.create({
      data: {
        questionId: question.id,
        userId: dana.id,
        answer: sampleAnswers[index],
        score: Math.round(evaluation.data.score),
        evaluation: stringifyJson(evaluation.data),
      },
    });
  }
  console.log(`  created a simulator session with ${simulatorSession.questions.length} questions`);

  // ------------------------------------------------------- notifications
  await prisma.notification.createMany({
    data: [
      {
        orgId: northfield.id,
        userId: dana.id,
        type: 'UPCOMING_AUDIT',
        title: '72 days until the Recertification Audit 2026',
        body: 'Open the preparation view to see your top priorities.',
        link: `/app/audits/${mainProject.id}/prepare`,
      },
      {
        orgId: northfield.id,
        userId: dana.id,
        type: 'ANALYSIS_COMPLETE',
        title: `Analysis complete for ${evidenceIds.length} documents`,
        body: 'Suggested requirement matches are waiting for your review in the matrix.',
        link: `/app/matrix?project=${mainProject.id}&review=PENDING`,
      },
      {
        orgId: northfield.id,
        userId: tomas.id,
        type: 'ACTION_ASSIGNED',
        title: 'You have been assigned corrective actions',
        body: 'Two actions on the recertification project are assigned to you.',
        link: '/app/actions?owner=me',
      },
    ],
  });

  // ------------------------------------------------------------- scoring
  await recomputeProjectScores(northfield.id, mainProject.id);
  await recomputeProjectScores(northfield.id, safetyProject.id);
  await recomputeProjectScores(coastline.id, coastlineProject.id);

  const scored = await prisma.auditProject.findUniqueOrThrow({ where: { id: mainProject.id } });
  const gapCount = await prisma.gap.count({
    where: { orgId: northfield.id, projectId: mainProject.id, status: { in: ['OPEN', 'IN_PROGRESS'] } },
  });

  console.log(`\n✓ Seed complete.\n`);
  console.log(`  Northfield Manufacturing — readiness ${scored.readinessScore}%, risk ${scored.riskLevel}, ${gapCount} open gaps`);
  console.log(`\n  Sign in at /login with any of:`);
  console.log(`    dana@northfield.example    (Owner, Quality Manager)`);
  console.log(`    tomas@northfield.example   (Manager, Production)`);
  console.log(`    sam@northfield.example     (Contributor, CNC Operator)`);
  console.log(`    priya@meridian.example     (Consultancy owner — see the client portfolio)`);
  console.log(`\n  Password for all demo accounts: ${DEMO_PASSWORD}\n`);
}

main()
  .catch((error) => {
    console.error('\n✗ Seed failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
