import { prisma } from '../db.js';

export interface DailySpinsResponse {
  id: string;
  spinnerAddress: string;
  prizeAmount: number;
  createdAt: number;
}

export async function setDailySpins(
  spinId: string,
  data: Record<string, any>,
): Promise<boolean> {
  try {
    await prisma.dailySpin.upsert({
      where: { id: spinId },
      create: {
        id: spinId,
        spinnerAddress: data.spinnerAddress,
        prizeAmount: data.prizeAmount || 0,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      },
      update: {
        prizeAmount: data.prizeAmount !== undefined ? data.prizeAmount : undefined,
      },
    });

    return true;
  } catch (error) {
    console.error(`Error setting DailySpins:`, error);
    return false;
  }
}

export async function getDailySpins(spinId: string): Promise<DailySpinsResponse | null> {
  try {
    const spin = await prisma.dailySpin.findUnique({
      where: { id: spinId },
    });

    if (!spin) return null;

    return {
      id: spin.id,
      spinnerAddress: spin.spinnerAddress,
      prizeAmount: spin.prizeAmount,
      createdAt: spin.createdAt.getTime(),
    };
  } catch (error) {
    console.error(`Error getting DailySpins:`, error);
    return null;
  }
}

export async function getManyDailySpins(): Promise<DailySpinsResponse[]> {
  try {
    const spins = await prisma.dailySpin.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return spins.map(spin => ({
      id: spin.id,
      spinnerAddress: spin.spinnerAddress,
      prizeAmount: spin.prizeAmount,
      createdAt: spin.createdAt.getTime(),
    }));
  } catch (error) {
    console.error(`Error getting DailySpins collection:`, error);
    return [];
  }
}
