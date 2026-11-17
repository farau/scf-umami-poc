/** Additive and repeatable seed for a dedicated POC database, including on Railway. */
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/client';
import { DEMO_TENANTS, daysInRange, PAGES, visitsForDay } from '../src/lib/scf/demo';

function id(value: string) {
  const hex = createHash('sha256').update(`scf-poc:${value}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

async function main() {
  if (process.env.SCF_DEMO_MODE !== 'true')
    throw new Error('Set SCF_DEMO_MODE=true on a dedicated POC database.');
  const password = process.env.SCF_SEED_PASSWORD;
  if (!password || password.length < 12)
    throw new Error('Set SCF_SEED_PASSWORD to at least 12 characters.');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  const url = new URL(process.env.DATABASE_URL);
  const prisma = new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: url.toString() },
      { schema: url.searchParams.get('schema') || undefined },
    ),
  });
  try {
    const passwordHash = await hash(password, 12);
    const operatorId = id('operator');
    await prisma.user.upsert({
      where: { id: operatorId },
      create: { id: operatorId, username: 'scf-operator', password: passwordHash, role: 'admin' },
      update: {},
    });
    for (const tenant of DEMO_TENANTS) {
      const userId = id(`${tenant.id}:user`);
      const username = `tenant-${tenant.seed}`;
      await prisma.user.upsert({
        where: { id: userId },
        create: { id: userId, username, password: passwordHash, role: 'user' },
        update: {},
      });
      await prisma.team.upsert({
        where: { id: tenant.id },
        create: { id: tenant.id, name: tenant.name },
        update: {},
      });
      await prisma.teamUser.upsert({
        where: { id: id(`${tenant.id}:member`) },
        create: { id: id(`${tenant.id}:member`), teamId: tenant.id, userId, role: 'team-owner' },
        update: {},
      });
      await prisma.website.upsert({
        where: { id: tenant.websiteId },
        create: {
          id: tenant.websiteId,
          name: tenant.name,
          domain: tenant.domain,
          teamId: tenant.id,
          createdBy: operatorId,
        },
        update: {},
      });
      // Per-day transactions keep the same synthetic session/event IDs on every rerun.
      for (const date of daysInRange(90)) {
        const sessions: Parameters<typeof prisma.session.createMany>[0]['data'] = [];
        const events: Parameters<typeof prisma.websiteEvent.createMany>[0]['data'] = [];
        visitsForDay(tenant, date).forEach((visit, i) => {
          const sessionId = id(`${tenant.id}:${date}:${i}`);
          const start = new Date(`${date}T00:00:00Z`).getTime() + ((i * 1093) % 82800) * 1000;
          sessions.push({
            id: sessionId,
            websiteId: tenant.websiteId,
            createdAt: new Date(start),
            browser: visit.browser,
            os: visit.device === 'mobile' ? 'iOS' : 'Windows 11',
            device: visit.device,
            country: visit.country,
            language: 'en-US',
          });
          for (let p = 0; p < visit.pageviews; p++) {
            events.push({
              id: id(`${sessionId}:${p}`),
              websiteId: tenant.websiteId,
              sessionId,
              visitId: id(`${sessionId}:visit`),
              createdAt: new Date(
                start + p * (visit.duration / Math.max(1, visit.pageviews - 1)) * 1000,
              ),
              urlPath: PAGES[(i + p) % PAGES.length],
              pageTitle: 'SCF synthetic demo',
              referrerDomain: visit.referrer === 'Direct' ? null : visit.referrer,
              hostname: tenant.domain,
              eventType: 1,
            });
          }
        });
        await prisma.$transaction(async tx => {
          await tx.session.createMany({ data: sessions, skipDuplicates: true });
          await tx.websiteEvent.createMany({ data: events, skipDuplicates: true });
        });
      }
      console.log(
        `${tenant.name}: tenant.id=${tenant.id}, website.id=${tenant.websiteId}, login=${username}`,
      );
    }
    console.log(
      'SCF native demo ready. Operator login: scf-operator. Passwords are set only when creating accounts.',
    );
  } finally {
    await prisma.$disconnect();
  }
}
main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
