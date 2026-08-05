import type { Metadata } from 'next';
import Link from 'next/link';
import { FileText, Sparkles, Upload } from 'lucide-react';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { resolveProject } from '@/lib/projects';
import { can } from '@/lib/auth/rbac';
import { parseTags } from '@/lib/json';
import {
  DOCUMENT_TYPES,
  EVIDENCE_STATUSES,
  EVIDENCE_STATUS_META,
  documentTypeLabel,
  type EvidenceStatus,
} from '@/lib/enums';
import { Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Badge } from '@/components/ui/badge';
import { ProjectPicker } from '@/components/app/project-picker';
import { FilterBar } from '@/components/app/filter-bar';
import { SubmitButton } from '@/components/ui/form';
import { formatBytes, formatDate, relativeTime } from '@/lib/utils';
import { analyzeProjectEvidenceAction } from './actions';

export const metadata: Metadata = { title: 'Evidence' };

export default async function EvidencePage({
  searchParams,
}: {
  searchParams: Promise<{
    project?: string;
    status?: string;
    type?: string;
    q?: string;
    analysis?: string;
  }>;
}) {
  const tenant = await requireTenant();
  const sp = await searchParams;
  const { project, projects } = await resolveProject(tenant, sp.project);
  const query = sp.q?.trim();

  const where = {
    orgId: tenant.orgId,
    ...(project ? { projectId: project.id } : {}),
    ...(sp.status && EVIDENCE_STATUSES.includes(sp.status as EvidenceStatus) ? { status: sp.status } : {}),
    ...(sp.type ? { documentType: sp.type } : {}),
    ...(sp.analysis === 'pending' ? { analysisStatus: { in: ['NOT_ANALYZED', 'FAILED'] } } : {}),
    ...(sp.analysis === 'complete' ? { analysisStatus: 'COMPLETE' } : {}),
    ...(query
      ? {
          OR: [
            { title: { contains: query } },
            { filename: { contains: query } },
            { extractedText: { contains: query } },
            { notes: { contains: query } },
          ],
        }
      : {}),
  };

  const [documents, total, unanalyzed] = await Promise.all([
    prisma.evidence.findMany({
      where,
      include: {
        owner: { select: { name: true } },
        uploadedBy: { select: { name: true } },
        _count: { select: { links: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.evidence.count({ where: { orgId: tenant.orgId, ...(project ? { projectId: project.id } : {}) } }),
    project
      ? prisma.evidence.count({
          where: {
            orgId: tenant.orgId,
            projectId: project.id,
            analysisStatus: { in: ['NOT_ANALYZED', 'FAILED'] },
            extractionStatus: { in: ['COMPLETE', 'PARTIAL'] },
          },
        })
      : Promise.resolve(0),
  ]);

  const canUpload = can(tenant.role, 'evidence:upload');
  const canAnalyze = can(tenant.role, 'ai:run');

  return (
    <div>
      <PageHeader
        title="Evidence library"
        description={`${total} document${total === 1 ? '' : 's'}${project ? ` on ${project.name}` : ''}. Everything here is private to ${tenant.org.name}.`}
        action={
          <>
            {projects.length > 0 && project && (
              <ProjectPicker projects={projects} activeId={project.id} basePath="/app/evidence" />
            )}
            {project && canAnalyze && unanalyzed > 0 && (
              <form action={analyzeProjectEvidenceAction}>
                <input type="hidden" name="projectId" value={project.id} />
                <SubmitButton variant="secondary" pendingLabel="Analyzing…">
                  <Sparkles className="h-4 w-4" aria-hidden />
                  Analyze {unanalyzed} document{unanalyzed === 1 ? '' : 's'}
                </SubmitButton>
              </form>
            )}
            {canUpload && (
              <Link
                href={project ? `/app/evidence/upload?project=${project.id}` : '/app/evidence/upload'}
                className="btn-primary btn-md"
              >
                <Upload className="h-4 w-4" aria-hidden />
                Upload
              </Link>
            )}
          </>
        }
      />

      <FilterBar
        basePath="/app/evidence"
        params={{ project: project?.id ?? '' }}
        current={{ status: sp.status, type: sp.type, q: sp.q, analysis: sp.analysis }}
        searchPlaceholder="Search titles, filenames and document contents…"
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: EVIDENCE_STATUSES.map((s) => ({ value: s, label: EVIDENCE_STATUS_META[s].label })),
          },
          {
            key: 'type',
            label: 'Type',
            options: DOCUMENT_TYPES.map((t) => ({ value: t, label: documentTypeLabel(t) })),
          },
          {
            key: 'analysis',
            label: 'Analysis',
            options: [
              { value: 'pending', label: 'Not analyzed' },
              { value: 'complete', label: 'Analyzed' },
            ],
          },
        ]}
      />

      {documents.length === 0 ? (
        <Card className="mt-4">
          <EmptyState
            icon={<FileText className="h-5 w-5" />}
            title={total === 0 ? 'No evidence uploaded yet' : 'Nothing matches these filters'}
            description={
              total === 0
                ? 'Upload the documents you already have — procedures, records, certificates, training matrices, calibration certificates. AuditReady extracts the text and matches them to your requirements.'
                : 'Try clearing the filters or searching for something else.'
            }
            action={
              total === 0 && canUpload ? (
                <Link
                  href={project ? `/app/evidence/upload?project=${project.id}` : '/app/evidence/upload'}
                  className="btn-primary btn-lg"
                >
                  <Upload className="h-4 w-4" aria-hidden />
                  Upload your first documents
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card className="mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-ink-200 bg-ink-50/60 text-left text-[11.5px] uppercase tracking-wide text-ink-500">
                  <th className="px-5 py-2.5 font-medium">Document</th>
                  <th className="px-3 py-2.5 font-medium">Type</th>
                  <th className="px-3 py-2.5 font-medium">Links</th>
                  <th className="px-3 py-2.5 font-medium">Owner</th>
                  <th className="px-3 py-2.5 font-medium">Expires</th>
                  <th className="px-3 py-2.5 font-medium">Analysis</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {documents.map((doc) => {
                  const tags = parseTags(doc.tags);
                  const expired = doc.expiresAt && doc.expiresAt < new Date();
                  return (
                    <tr key={doc.id} className="table-row-link">
                      <td className="px-5 py-3">
                        <Link href={`/app/evidence/${doc.id}`} className="block">
                          <span className="text-[13.5px] font-medium text-ink-900">{doc.title || doc.filename}</span>
                          <span className="mt-0.5 block text-[12px] text-ink-500">
                            {doc.filename} · {formatBytes(doc.sizeBytes)} · {relativeTime(doc.createdAt)}
                          </span>
                          {tags.length > 0 && (
                            <span className="mt-1 flex flex-wrap gap-1">
                              {tags.slice(0, 4).map((tag) => (
                                <Badge key={tag} tone="muted" size="sm">
                                  {tag}
                                </Badge>
                              ))}
                            </span>
                          )}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-[12.5px] text-ink-600">{documentTypeLabel(doc.documentType)}</td>
                      <td className="px-3 py-3">
                        {doc._count.links > 0 ? (
                          <Badge tone="info" size="sm">
                            {doc._count.links}
                          </Badge>
                        ) : (
                          <span className="text-[12.5px] text-ink-400">None</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-[12.5px] text-ink-600">
                        {doc.owner?.name ?? <span className="text-ink-400">Unassigned</span>}
                      </td>
                      <td className="px-3 py-3 text-[12.5px]">
                        {doc.expiresAt ? (
                          <span className={expired ? 'font-semibold text-risk-600' : 'text-ink-600'}>
                            {formatDate(doc.expiresAt)}
                          </span>
                        ) : (
                          <span className="text-ink-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Badge
                          tone={
                            doc.analysisStatus === 'COMPLETE'
                              ? 'info'
                              : doc.analysisStatus === 'FAILED'
                                ? 'risk'
                                : 'muted'
                          }
                          size="sm"
                        >
                          {doc.analysisStatus === 'COMPLETE'
                            ? 'Analyzed'
                            : doc.analysisStatus === 'FAILED'
                              ? 'Failed'
                              : 'Pending'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={EVIDENCE_STATUS_META[doc.status as EvidenceStatus].tone} size="sm" dot>
                          {EVIDENCE_STATUS_META[doc.status as EvidenceStatus].label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
