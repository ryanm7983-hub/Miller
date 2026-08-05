import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { requireTenant } from '@/lib/tenant';
import { can } from '@/lib/auth/rbac';
import { ensureSystemFrameworks, listAvailableFrameworks } from '@/lib/frameworks';
import { getSubscription, getUsage } from '@/lib/billing';
import { PageHeader, Card, Alert } from '@/components/ui/primitives';
import { NewProjectForm } from './new-project-form';

export const metadata: Metadata = { title: 'New audit project' };

export default async function NewAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const tenant = await requireTenant();
  if (!can(tenant.role, 'project:create')) redirect('/app/audits');

  const { welcome } = await searchParams;

  // Make sure the bundled frameworks exist even for organizations created
  // before they shipped.
  await ensureSystemFrameworks();

  const [frameworks, subscription, usage] = await Promise.all([
    listAvailableFrameworks(tenant.orgId),
    getSubscription(tenant.orgId),
    getUsage(tenant.orgId),
  ]);

  const limit = subscription.plan.limits.auditProjects;
  const atLimit = limit !== -1 && usage.auditProjects >= limit;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={welcome ? 'Create your first audit project' : 'New audit project'}
        description={
          welcome
            ? 'One more step. Pick the framework you are being assessed against and when the audit is — you can change both later.'
            : 'A project holds a framework, its requirements, your evidence, gaps and actions.'
        }
        breadcrumb={[{ label: 'Audits', href: '/app/audits' }, { label: 'New' }]}
      />

      {atLimit && (
        <Alert tone="warning" className="mb-5" title="Plan limit reached">
          Your {subscription.plan.name} plan includes {limit} audit project{limit === 1 ? '' : 's'}. Archive an existing
          project or upgrade in Settings → Billing to create another.
        </Alert>
      )}

      <Card className="p-6">
        <NewProjectForm frameworks={frameworks} disabled={atLimit} />
      </Card>

      <p className="mt-5 text-[12.5px] leading-relaxed text-ink-500">
        The bundled frameworks use original demonstration requirements — they do not reproduce the text of any published
        standard, which is copyrighted by its publisher. Use them to try the full workflow, then create a custom
        framework with the requirements you are licensed to use.
      </p>
    </div>
  );
}
