'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { prisma } from '@/lib/db';
import { requireTenantStrict } from '@/lib/tenant';

export async function markReadAction(formData: FormData) {
  const tenant = await requireTenantStrict();
  const notificationId = String(formData.get('notificationId') ?? '');
  const redirectTo = String(formData.get('redirectTo') ?? '');

  // Scoped by both org and user: a notification id cannot be read across
  // tenants or between users.
  await prisma.notification.updateMany({
    where: { id: notificationId, orgId: tenant.orgId, userId: tenant.user.id, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath('/app', 'layout');

  // Only relative in-app paths are honoured, so a stored value can never be
  // used as an open redirect.
  if (redirectTo.startsWith('/app/')) redirect(redirectTo);
  redirect('/app/notifications');
}

export async function markAllReadAction() {
  const tenant = await requireTenantStrict();
  await prisma.notification.updateMany({
    where: { orgId: tenant.orgId, userId: tenant.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath('/app', 'layout');
}
