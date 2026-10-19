import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const actor = vi.hoisted(() => ({ roles: ['MAINTAINER'] as string[] }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/guards', async () => {
  const { ForbiddenError } = await import('@/lib/auth/errors');
  return {
    requireMaintainer: async () => {
      if (!actor.roles.includes('MAINTAINER')) throw new ForbiddenError();
      return { status: 'granted', roles: actor.roles, userId: 'maint-1' };
    },
  };
});

import prisma from '@/lib/db';
import { clearAudit } from './db';
import { createHelper, getHelperProfile, updateHelper } from '@/features/helpers/service';
import { createOrganization, listOrganizationOptions, updateOrganization } from '@/features/organizations/service';
import { DuplicateOrganizationError, InvalidOrganizationError } from '@/features/helpers/errors';
import { ForbiddenError } from '@/lib/auth/errors';

beforeEach(async () => {
  actor.roles = ['MAINTAINER'];
  await clearAudit();
  await prisma.helper.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.authUser.deleteMany();
  await prisma.authUser.create({ data: { id: 'maint-1', email: 'm@example.test', name: 'M', emailVerified: true } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('organizations (PostgreSQL)', () => {
  it('creates, audits and rejects case-insensitive duplicates', async () => {
    await createOrganization({ name: ' Red Cross ' });
    await expect(createOrganization({ name: 'red cross' })).rejects.toBeInstanceOf(DuplicateOrganizationError);
    expect(await prisma.auditEvent.count({ where: { action: 'ORGANIZATION_CREATED', targetType: 'organization' } })).toBe(1);
  });

  it('assigns an optional organization to a helper and shows it on the profile', async () => {
    const { organizationId } = await createOrganization({ name: 'Org A' });
    const { helperId } = await createHelper({ firstName: 'A', lastName: 'B', organizationId });
    expect((await getHelperProfile(helperId))?.organization).toEqual({ id: organizationId, name: 'Org A' });
    const { helperId: other } = await createHelper({ firstName: 'C', lastName: 'D' });
    expect((await getHelperProfile(other))?.organization).toBeNull();
    await expect(createHelper({ firstName: 'E', lastName: 'F', organizationId: 'missing' })).rejects.toBeInstanceOf(InvalidOrganizationError);
  });

  it('keeps a retired organization on existing helpers but blocks new assignment', async () => {
    const { organizationId } = await createOrganization({ name: 'Old Org' });
    const { helperId } = await createHelper({ firstName: 'A', lastName: 'B', organizationId });
    await updateOrganization({ organizationId, name: 'Old Org', active: false });
    const same = { helperId, firstName: 'A', lastName: 'B', email: null, phone: null, address: null, active: true, organizationId };
    await updateHelper(same);
    await expect(createHelper({ firstName: 'X', lastName: 'Y', organizationId })).rejects.toBeInstanceOf(InvalidOrganizationError);
    expect((await listOrganizationOptions(null)).map((o) => o.id)).not.toContain(organizationId);
    expect((await listOrganizationOptions(organizationId)).map((o) => o.id)).toContain(organizationId);
  });

  it('blocks deleting an organization that helpers use, and requires the Maintainer role', async () => {
    const { organizationId } = await createOrganization({ name: 'Org' });
    await createHelper({ firstName: 'A', lastName: 'B', organizationId });
    await expect(prisma.organization.delete({ where: { id: organizationId } })).rejects.toThrow();
    actor.roles = [];
    await expect(createOrganization({ name: 'Nope' })).rejects.toBeInstanceOf(ForbiddenError);
  });
});
