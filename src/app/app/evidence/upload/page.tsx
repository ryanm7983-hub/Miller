import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { requireTenant } from '@/lib/tenant';
import { can } from '@/lib/auth/rbac';
import { listProjects } from '@/lib/projects';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { aiProviderLabel } from '@/lib/ai';
import { PageHeader, Card, Alert } from '@/components/ui/primitives';
import { UploadForm } from './upload-form';

export const metadata: Metadata = { title: 'Upload evidence' };

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const tenant = await requireTenant();
  if (!can(tenant.role, 'evidence:upload')) redirect('/app/evidence');

  const sp = await searchParams;
  const [projects, departments] = await Promise.all([
    listProjects(tenant),
    prisma.department.findMany({ where: { orgId: tenant.orgId }, orderBy: { name: 'asc' } }),
  ]);

  const ai = aiProviderLabel();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Upload evidence"
        description="Drag in what you already have. Text is extracted on upload so documents become searchable and analysable straight away."
        breadcrumb={[{ label: 'Evidence', href: '/app/evidence' }, { label: 'Upload' }]}
      />

      <Card className="p-6">
        <UploadForm
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          departments={departments.map((d) => d.name)}
          defaultProjectId={sp.project ?? projects[0]?.id ?? ''}
          maxMb={Math.round(env.maxUploadBytes / 1024 / 1024)}
        />
      </Card>

      <Alert tone="info" className="mt-5">
        Documents are stored privately and served only through authenticated requests — never from a public URL. After
        upload you can run analysis, which matches each document to your requirements using{' '}
        {ai.live ? `${ai.name} (${ai.model})` : 'the built-in analysis engine'}. Suggested matches always wait for a
        person to approve them.
      </Alert>
    </div>
  );
}
