import { prisma } from '../db.js';

export interface DailySpinPoolResponse {
  id: string;
  balance: string;
  updatedAt: number;
  totalDistributed?: string;
}

export async function setDailySpinPool(
  poolId: string,
  data: Record<string, any>,
): Promise<boolean> {
  try {
    const balance = typeof data.balance === 'bigint' ? data.balance : BigInt(data.balance || 0);

    await prisma.dailySpinPool.upsert({
      where: { id: poolId },
      create: {
        id: poolId,
        balance,
        updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
      },
      update: {
        balance,
        updatedAt: new Date(),
      },
    });

    return true;
  } catch (error) {
    console.error(`Error setting DailySpinPool:`, error);
    return false;
  }
}

export async function getDailySpinPool(poolId: string): Promise<DailySpinPoolResponse | null> {
  try {
    const pool = await prisma.dailySpinPool.findUnique({
      where: { id: poolId },
    });

    if (!pool) return null;

    return {
      id: pool.id,
      balance: pool.balance.toString(),
      updatedAt: pool.updatedAt.getTime(),
    };
  } catch (error) {
    console.error(`Error getting DailySpinPool:`, error);
    return null;
  }
}
