import { get, set } from '../db-client.js';

export interface DailySpinsResponse {
  id: string;
  spinnerAddress: string;
  prizeAmount: number;
  createdAt: number;
  lastSpinAt?: number | null;
  totalWon?: number;
}

export async function setDailySpins(
  spinId: string,
  data: Record<string, any>,
): Promise<boolean> {
  try {
    await set(`dailySpin/${spinId}`, data);
    return true;
  } catch (error) {
    console.error(`Error setting DailySpins:`, error);
    return false;
  }
}

export async function getDailySpins(spinId: string): Promise<DailySpinsResponse | null> {
  try {
    const spin = await get(`dailySpin/${spinId}`);
    if (!spin) return null;
    return spin as DailySpinsResponse;
  } catch (error) {
    console.error(`Error getting DailySpins:`, error);
    return null;
  }
}

export async function getManyDailySpins(): Promise<DailySpinsResponse[]> {
  try {
    return [];
  } catch (error) {
    console.error(`Error getting DailySpins collection:`, error);
    return [];
  }
}
