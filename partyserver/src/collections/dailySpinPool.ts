import { get, set } from '../db-client.js';

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
    await set(`dailySpinPool/${poolId}`, data);
    return true;
  } catch (error) {
    console.error(`Error setting DailySpinPool:`, error);
    return false;
  }
}

export async function getDailySpinPool(poolId: string): Promise<DailySpinPoolResponse | null> {
  try {
    const pool = await get(`dailySpinPool/${poolId}`);
    if (!pool) return null;
    return pool as DailySpinPoolResponse;
  } catch (error) {
    console.error(`Error getting DailySpinPool:`, error);
    return null;
  }
}
