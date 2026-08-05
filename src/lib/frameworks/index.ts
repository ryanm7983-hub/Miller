import 'server-only';

import { prisma } from '@/lib/db';
import { stringifyJson } from '@/lib/json';
import { DEMO_FRAMEWORKS } from './demo';

export { DEMO_FRAMEWORKS } from './demo';
export type { DemoFramework, DemoRequirement } from './demo';

/**
 * Idempotently installs the bundled system frameworks.
 *
 * Safe to call on every onboarding: existing frameworks are left alone, and
 * only missing versions/requirements are created. Requirement text is never
 * overwritten, so a version already in use by projects cannot shift under them.
 */
export async function ensureSystemFrameworks(): Promise<void> {
  for (const definition of DEMO_FRAMEWORKS) {
    const framework = await prisma.framework.upsert({
      where: { key: definition.key },
      create: {
        key: definition.key,
        name: definition.name,
        publisher: definition.publisher,
        category: definition.category,
        description: definition.description,
        isSystem: true,
      },
      update: { name: definition.name, description: definition.description, category: definition.category },
    });

    const existingVersion = await prisma.frameworkVersion.findUnique({
      where: { frameworkId_version: { frameworkId: framework.id, version: definition.version } },
      include: { _count: { select: { requirements: true } } },
    });

    if (existingVersion && existingVersion._count.requirements > 0) continue;

    const version =
      existingVersion ??
      (await prisma.frameworkVersion.create({
        data: {
          frameworkId: framework.id,
          version: definition.version,
          notes: definition.versionNotes,
          isDefault: true,
          effectiveDate: new Date(),
        },
      }));

    const categoryIds = new Map<string, string>();
    for (const [index, category] of definition.categories.entries()) {
      const row = await prisma.requirementCategory.upsert({
        where: { frameworkVersionId_code: { frameworkVersionId: version.id, code: category.code } },
        create: {
          frameworkVersionId: version.id,
          code: category.code,
          name: category.name,
          description: category.description,
          sortOrder: index,
        },
        update: { name: category.name, description: category.description, sortOrder: index },
      });
      categoryIds.set(category.code, row.id);
    }

    for (const [index, requirement] of definition.requirements.entries()) {
      await prisma.requirement.upsert({
        where: {
          frameworkVersionId_identifier: {
            frameworkVersionId: version.id,
            identifier: requirement.identifier,
          },
        },
        create: {
          frameworkVersionId: version.id,
          categoryId: categoryIds.get(requirement.categoryCode) ?? null,
          identifier: requirement.identifier,
          title: requirement.title,
          text: requirement.text,
          guidance: requirement.guidance,
          evidenceSuggestions: stringifyJson(requirement.evidenceSuggestions),
          importance: requirement.importance,
          sortOrder: index,
        },
        update: {},
      });
    }
  }
}

/** Framework versions selectable by an organization (system + its own). */
export async function listAvailableFrameworks(orgId: string) {
  const frameworks = await prisma.framework.findMany({
    where: { OR: [{ isSystem: true }, { orgId }] },
    include: {
      versions: {
        orderBy: [{ isDefault: 'desc' }, { version: 'desc' }],
        include: { _count: { select: { requirements: true } } },
      },
    },
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
  });

  return frameworks
    .filter((f) => f.versions.some((v) => v._count.requirements > 0))
    .map((f) => ({
      id: f.id,
      key: f.key,
      name: f.name,
      description: f.description,
      category: f.category,
      publisher: f.publisher,
      isSystem: f.isSystem,
      versions: f.versions
        .filter((v) => v._count.requirements > 0)
        .map((v) => ({
          id: v.id,
          version: v.version,
          notes: v.notes,
          isDefault: v.isDefault,
          requirementCount: v._count.requirements,
        })),
    }));
}
