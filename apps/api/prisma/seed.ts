import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 12);
  const user = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: { email: 'demo@example.com', name: 'Demo User', passwordHash },
  });

  const slug = 'demo-workspace';
  const org = await prisma.organization.upsert({
    where: { slug },
    update: {},
    create: { name: 'Demo Workspace', slug },
  });
  await prisma.membership.upsert({
    where: { userId_orgId: { userId: user.id, orgId: org.id } },
    update: {},
    create: { userId: user.id, orgId: org.id, role: 'OWNER' },
  });

  if ((await prisma.project.count({ where: { orgId: org.id } })) === 0) {
    await prisma.project.createMany({
      data: ['Website redesign', 'Mobile app'].map((name) => ({ orgId: org.id, name, createdBy: user.id })),
    });
  }
  console.log('Seeded: demo@example.com / password123');
}

main().finally(() => prisma.$disconnect());
