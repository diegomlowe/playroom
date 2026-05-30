import { get, set } from '../db-client.js';

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
    await set(`spinPayout/${payoutId}`, data);
    return true;
  } catch (error) {
    console.error(`Error setting SpinPayouts:`, error);
    return false;
  }
}

export async function getSpinPayouts(payoutId: string): Promise<SpinPayoutsResponse | null> {
  try {
    const payout = await get(`spinPayout/${payoutId}`);
    if (!payout) return null;
    return payout as SpinPayoutsResponse;
  } catch (error) {
    console.error(`Error getting SpinPayouts:`, error);
    return null;
  }
}

export async function getManySpinPayouts(): Promise<SpinPayoutsResponse[]> {
  try {
    return [];
  } catch (error) {
    console.error(`Error getting SpinPayouts collection:`, error);
    return [];
  }
}
