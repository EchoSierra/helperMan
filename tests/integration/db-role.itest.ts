import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';

import prisma from '@/lib/db';
import { clearAudit } from './db';

const ROLE = 'hm_app_test';
const PASSWORD = 'apptestpw123';
let app: PrismaClient;

beforeAll(async () => {
  await clearAudit();
  const sql = readFileSync('scripts/sql/app-role.sql', 'utf8')
    .replaceAll('__APP_ROLE__', ROLE)
    .replaceAll('__APP_PASSWORD__', PASSWORD);
  await prisma.$executeRawUnsafe(sql);
  const url = new URL(process.env.DATABASE_URL!);
  url.username = ROLE;
  url.password = PASSWORD;
  app = new PrismaClient({ datasourceUrl: url.toString() });
});

afterAll(async () => {
  await app.$disconnect();
  await prisma.$disconnect();
});

describe('least-privilege application role (scripts/sql/app-role.sql)', () => {
  it('can write and read ordinary tables and append audit events', async () => {
    const helper = await app.helper.create({ data: { firstName: 'A', lastName: 'B' } });
    await app.auditEvent.create({ data: { actorId: null, action: 'HELPER_CREATED', targetType: 'helper', targetId: helper.id } });
    expect(await app.auditEvent.count()).toBe(1);
    await app.helper.delete({ where: { id: helper.id } });
  });

  it('cannot update, delete or truncate audit events, even with the retention opt-in', async () => {
    const event = (await app.auditEvent.findFirstOrThrow());
    await expect(app.auditEvent.update({ where: { id: event.id }, data: { action: 'SIGN_OUT' } })).rejects.toThrow(/permission denied/);
    await expect(app.auditEvent.deleteMany()).rejects.toThrow(/permission denied/);
    await expect(app.$executeRawUnsafe('TRUNCATE "audit_events"')).rejects.toThrow(/permission denied/);
    await expect(
      app.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL app.audit_retention = 'on'");
        await tx.auditEvent.deleteMany();
      }),
    ).rejects.toThrow(/permission denied/);
    expect(await prisma.auditEvent.count()).toBe(1);
  });

  it('cannot touch the migration history or create objects', async () => {
    await expect(app.$queryRawUnsafe('SELECT * FROM "_prisma_migrations"')).rejects.toThrow(/permission denied/);
    await expect(app.$executeRawUnsafe('CREATE TABLE hm_evil (id int)')).rejects.toThrow(/permission denied/);
  });
});
