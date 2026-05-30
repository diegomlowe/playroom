import { prisma } from '../db.js';

export interface SpinPayoutsResponse {
  id: string;
  spinId: string;
  playerAddress: string;
  amount: string;
  createdAt: number;
}

export async function setSpinPayouts(
  payoutId: string,
  data: Record<string, any>,
): Promise<boolean> {
  try {
    const amount = typeof data.amount === 'bigint' ? data.amount : BigInt(data.amount || 0);

    await prisma.spinPayout.upsert({
      where: { id: payoutId },
      create: {
        id: payoutId,
        spinId: data.spinId,
        playerAddress: data.playerAddress,
        amount,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      },
      update: {
        amount,
      },
    });

    return true;
  } catch (error) {
    console.error(`Error setting SpinPayouts:`, error);
    return false;
  }
}

export async function getSpinPayouts(payoutId: string): Promise<SpinPayoutsResponse | null> {
  try {
    const payout = await prisma.spinPayout.findUnique({
      where: { id: payoutId },
    });

    if (!payout) return null;

    return {
      id: payout.id,
      spinId: payout.spinId,
      playerAddress: payout.playerAddress,
      amount: payout.amount.toString(),
      createdAt: payout.createdAt.getTime(),
    };
  } catch (error) {
    console.error(`Error getting SpinPayouts:`, error);
    return null;
  }
}

export async function getManySpinPayouts(): Promise<SpinPayoutsResponse[]> {
  try {
    const payouts = await prisma.spinPayout.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return payouts.map(payout => ({
      id: payout.id,
      spinId: payout.spinId,
      playerAddress: payout.playerAddress,
      amount: payout.amount.toString(),
      createdAt: payout.createdAt.getTime(),
    }));
  } catch (error) {
    console.error(`Error getting SpinPayouts collection:`, error);
    return [];
  }
}
