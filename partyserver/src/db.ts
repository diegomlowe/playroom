import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

export async function disconnectDb() {
  await prisma.$disconnect();
}
