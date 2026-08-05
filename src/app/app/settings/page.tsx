import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import { requireTenant } from '@/lib/tenant';
import { can } from '@/lib/auth/rbac';
import { aiProviderLabel } from '@/lib/ai';
import { env } from '@/lib/env';
import { email } from '@/lib/email';
import { billing } from '@/lib/billing';
import { Card, CardHeader } from '@/components/ui/primitives';
import { Badge } from '@/components/ui/badge';
import { OrganizationForm } from './organization-form';
import { DepartmentManager } from './department-manager';

export const metadata: Metadata = { title: 'Organization settings' };

export default async function OrganizationSettingsPage() {
  const tenant = await requireTenant();

  const [org, departments] = await Promise.all([
    prisma.organization.findUnique({ where: { id: tenant.orgId } }),
    prisma.department.findMany({ where: { orgId: tenant.orgId }, orderBy: { name: 'asc' } }),
  ]);
  if (!org) return null;

  const canManage = can(tenant.role, 'org:manage');
  const ai = aiProviderLabel();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Organization"
          description={canManage ? 'Appears on reports and in the organization switcher.' : 'Read-only for your role.'}
        />
        <div className="p-5">
          <OrganizationForm
            org={{
              name: org.name,
              industry: org.industry,
              sizeBand: org.sizeBand,
              country: org.country,
              kind: org.kind,
            }}
            canManage={canManage}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Departments"
          description="Used to filter requirements, evidence, gaps and actions by area of the business."
        />
        <div className="p-5">
          <DepartmentManager
            departments={departments.map((d) => ({ id: d.id, name: d.name }))}
            canManage={canManage}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="System configuration"
          description="How this deployment is currently set up. Change these with environment variables."
        />
        <dl className="divide-y divide-ink-100 text-[13px]">
          {[
            {
              term: 'AI provider',
              value: `${ai.name} · ${ai.model}`,
              badge: ai.live ? { tone: 'strong' as const, label: 'Live model' } : { tone: 'info' as const, label: 'Built-in engine' },
              hint: ai.live
                ? 'Document analysis, action drafting and simulator scoring use a live model.'
                : 'Set ANTHROPIC_API_KEY to switch to the Claude-powered provider. The built-in engine is deterministic and fully offline.',
            },
            {
              term: 'Document storage',
              value: env.storageDriver === 's3' ? 'S3-compatible object storage' : 'Local filesystem',
              badge: { tone: 'muted' as const, label: env.storageDriver },
              hint: 'Documents are only ever served through authenticated, authorized requests.',
            },
            {
              term: 'Email delivery',
              value: email().name,
              badge: email().deliversRealEmail
                ? { tone: 'strong' as const, label: 'Delivering' }
                : { tone: 'caution' as const, label: 'Logged only' },
              hint: email().deliversRealEmail
                ? 'Notification emails are being delivered.'
                : 'Notifications are written in-app and logged to the server console. Set EMAIL_PROVIDER=http with EMAIL_API_URL and EMAIL_API_KEY to deliver them.',
            },
            {
              term: 'Billing',
              value: billing().name,
              badge: billing().live
                ? { tone: 'strong' as const, label: 'Live payments' }
                : { tone: 'caution' as const, label: 'Simulated' },
              hint: billing().live
                ? 'Plan changes go through Stripe checkout.'
                : 'Plan changes apply immediately with no payment. Set STRIPE_SECRET_KEY to process real subscriptions.',
            },
            {
              term: 'OCR',
              value: env.ocrEnabled ? 'Enabled' : 'Disabled',
              badge: { tone: 'muted' as const, label: env.ocrEnabled ? 'on' : 'off' },
              hint: 'When enabled, scanned images are put through OCR so their text becomes searchable and analysable.',
            },
            {
              term: 'Maximum upload size',
              value: `${Math.round(env.maxUploadBytes / 1024 / 1024)} MB per file`,
              hint: 'Controlled by MAX_UPLOAD_MB.',
            },
          ].map((row) => (
            <div key={row.term} className="px-5 py-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dt className="text-[13px] font-medium text-ink-800">{row.term}</dt>
                <dd className="flex items-center gap-2">
                  <span className="text-[13px] text-ink-600">{row.value}</span>
                  {row.badge && (
                    <Badge tone={row.badge.tone} size="sm">
                      {row.badge.label}
                    </Badge>
                  )}
                </dd>
              </div>
              {row.hint && <p className="mt-1 text-[12px] leading-relaxed text-ink-500">{row.hint}</p>}
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
