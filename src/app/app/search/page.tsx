import type { Metadata } from 'next';
import Link from 'next/link';
import {
  CheckSquare,
  FileText,
  Gauge,
  ListChecks,
  MessageSquare,
  Search as SearchIcon,
  ShieldAlert,
  Users,
} from 'lucide-react';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { consume, LIMITS } from '@/lib/rate-limit';
import { Card, CardHeader, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from './search-input';
import { formatDate, truncate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Search' };

/**
 * Global search across everything a tenant owns.
 *
 * Every query is scoped by `orgId`, including the full-text match against
 * extracted document contents, so search can never surface another
 * organization's data.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const tenant = await requireTenant();
  const { q } = await searchParams;
  const query = q?.trim() ?? '';

  if (query.length < 2) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Search" description={`Everything in ${tenant.org.name}.`} />
        <SearchInput defaultValue={query} />
        <Card className="mt-4">
          <EmptyState
            icon={<SearchIcon className="h-5 w-5" />}
            title="Search across your whole organization"
            description="Documents and their contents, requirements, gaps, actions, comments, audit projects and people. Type at least two characters."
          />
        </Card>
      </div>
    );
  }

  const limit = consume(`search:${tenant.user.id}`, LIMITS.search.limit, LIMITS.search.windowMs);
  if (!limit.ok) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Search" />
        <SearchInput defaultValue={query} />
        <Card className="mt-4">
          <EmptyState
            icon={<SearchIcon className="h-5 w-5" />}
            title="Slow down a moment"
            description={`Too many searches. Try again in ${limit.retryAfterSeconds} seconds.`}
          />
        </Card>
      </div>
    );
  }

  const [evidence, requirements, gaps, actions, projects, comments, members] = await Promise.all([
    prisma.evidence.findMany({
      where: {
        orgId: tenant.orgId,
        OR: [
          { title: { contains: query } },
          { filename: { contains: query } },
          { notes: { contains: query } },
          { extractedText: { contains: query } },
        ],
      },
      select: { id: true, title: true, filename: true, documentType: true, extractedText: true, createdAt: true },
      take: 12,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.projectRequirement.findMany({
      where: {
        orgId: tenant.orgId,
        OR: [
          { requirement: { identifier: { contains: query } } },
          { requirement: { title: { contains: query } } },
          { requirement: { text: { contains: query } } },
          { notes: { contains: query } },
        ],
      },
      include: { requirement: { select: { identifier: true, title: true } }, project: { select: { name: true } } },
      take: 12,
    }),
    prisma.gap.findMany({
      where: {
        orgId: tenant.orgId,
        OR: [{ title: { contains: query } }, { description: { contains: query } }],
      },
      select: { id: true, title: true, description: true, severity: true, status: true },
      take: 10,
    }),
    prisma.action.findMany({
      where: {
        orgId: tenant.orgId,
        OR: [
          { reference: { contains: query } },
          { title: { contains: query } },
          { description: { contains: query } },
        ],
      },
      select: { id: true, reference: true, title: true, status: true },
      take: 10,
    }),
    prisma.auditProject.findMany({
      where: { orgId: tenant.orgId, OR: [{ name: { contains: query } }, { scope: { contains: query } }] },
      select: { id: true, name: true, readinessScore: true },
      take: 6,
    }),
    prisma.comment.findMany({
      where: { orgId: tenant.orgId, body: { contains: query } },
      include: { user: { select: { name: true } } },
      take: 8,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.membership.findMany({
      where: {
        orgId: tenant.orgId,
        status: 'ACTIVE',
        OR: [{ user: { name: { contains: query } } }, { user: { email: { contains: query } } }],
      },
      include: { user: { select: { id: true, name: true, email: true, jobTitle: true } } },
      take: 6,
    }),
  ]);

  const total =
    evidence.length + requirements.length + gaps.length + actions.length + projects.length + comments.length + members.length;

  /** Highlights the matched span in extracted document text. */
  function snippet(text: string | null): string | null {
    if (!text) return null;
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return null;
    const start = Math.max(0, index - 70);
    return `…${text.slice(start, index + query.length + 90).replace(/\s+/g, ' ').trim()}…`;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`Results for “${query}”`}
        description={`${total} match${total === 1 ? '' : 'es'} across ${tenant.org.name}.`}
      />
      <SearchInput defaultValue={query} />

      {total === 0 ? (
        <Card className="mt-4">
          <EmptyState
            icon={<SearchIcon className="h-5 w-5" />}
            title="Nothing found"
            description="Try a different term. Document contents are searchable once text has been extracted on upload."
          />
        </Card>
      ) : (
        <div className="mt-4 space-y-4">
          {evidence.length > 0 && (
            <Card>
              <CardHeader title={`Documents (${evidence.length})`} />
              <ul className="divide-y divide-ink-100">
                {evidence.map((doc) => {
                  const match = snippet(doc.extractedText);
                  return (
                    <li key={doc.id}>
                      <Link href={`/app/evidence/${doc.id}`} className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-ink-50/70">
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] font-medium text-ink-900">{doc.title || doc.filename}</p>
                          {match ? (
                            <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-500">{match}</p>
                          ) : (
                            <p className="mt-0.5 text-[12px] text-ink-500">
                              {doc.filename} · {formatDate(doc.createdAt)}
                            </p>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {requirements.length > 0 && (
            <Card>
              <CardHeader title={`Requirements (${requirements.length})`} />
              <ul className="divide-y divide-ink-100">
                {requirements.map((row) => (
                  <li key={row.id}>
                    <Link href={`/app/requirements/${row.id}`} className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-ink-50/70">
                      <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-medium text-ink-900">
                          <span className="font-mono text-[12px] text-ink-500">{row.requirement.identifier}</span>{' '}
                          {row.requirement.title}
                        </p>
                        <p className="mt-0.5 text-[12px] text-ink-500">{row.project.name}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {gaps.length > 0 && (
            <Card>
              <CardHeader title={`Gaps (${gaps.length})`} />
              <ul className="divide-y divide-ink-100">
                {gaps.map((gap) => (
                  <li key={gap.id}>
                    <Link href={`/app/gaps/${gap.id}`} className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-ink-50/70">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-medium text-ink-900">{gap.title}</p>
                        <p className="mt-0.5 line-clamp-1 text-[12.5px] text-ink-500">{gap.description}</p>
                      </div>
                      <Badge tone="muted" size="sm">
                        {gap.severity.toLowerCase()}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {actions.length > 0 && (
            <Card>
              <CardHeader title={`Actions (${actions.length})`} />
              <ul className="divide-y divide-ink-100">
                {actions.map((action) => (
                  <li key={action.id}>
                    <Link href={`/app/actions/${action.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-ink-50/70">
                      <CheckSquare className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
                      <span className="font-mono text-[11.5px] text-ink-500">{action.reference}</span>
                      <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink-800">{action.title}</span>
                      <Badge tone="muted" size="sm">
                        {action.status.replace('_', ' ').toLowerCase()}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {projects.length > 0 && (
            <Card>
              <CardHeader title={`Audit projects (${projects.length})`} />
              <ul className="divide-y divide-ink-100">
                {projects.map((project) => (
                  <li key={project.id}>
                    <Link href={`/app/audits/${project.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-ink-50/70">
                      <Gauge className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink-900">
                        {project.name}
                      </span>
                      <span className="tnum text-[13px] font-semibold text-ink-700">{project.readinessScore}%</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {comments.length > 0 && (
            <Card>
              <CardHeader title={`Comments (${comments.length})`} />
              <ul className="divide-y divide-ink-100">
                {comments.map((comment) => (
                  <li key={comment.id} className="flex items-start gap-3 px-5 py-3">
                    <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] leading-relaxed text-ink-700">{truncate(comment.body, 180)}</p>
                      <p className="mt-0.5 text-[12px] text-ink-500">
                        {comment.user.name} · {formatDate(comment.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {members.length > 0 && (
            <Card>
              <CardHeader title={`People (${members.length})`} />
              <ul className="divide-y divide-ink-100">
                {members.map((member) => (
                  <li key={member.id} className="flex items-center gap-3 px-5 py-3">
                    <Users className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium text-ink-900">{member.user.name}</p>
                      <p className="text-[12px] text-ink-500">
                        {member.user.jobTitle ? `${member.user.jobTitle} · ` : ''}
                        {member.user.email}
                      </p>
                    </div>
                    <Badge tone="muted" size="sm">
                      {member.role.toLowerCase()}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
