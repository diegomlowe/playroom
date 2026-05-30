import { get, set } from '../db-client.js';

export interface CoinFlipMatchesResponse {
  id: string;
  creator: string;
  opponent?: string | null;
  tier: number;
  buyIn: string;
  state: string;
  winner?: string | null;
  createdAt: number;
  buyInCurrency: string;
  vrfResult?: string | null;
  txSignature?: string | null;
  ts: number;
}

export async function setCoinFlipMatches(
  matchId: string,
  data: Record<string, any>,
): Promise<boolean> {
  try {
    await set(`coinFlipMatch/${matchId}`, data);
    return true;
  } catch (error) {
    console.error(`Error setting CoinFlipMatches:`, error);
    return false;
  }
}

export async function updateCoinFlipMatches(
  matchId: string,
  data: Record<string, any>,
): Promise<boolean> {
  return setCoinFlipMatches(matchId, data);
}

export async function getCoinFlipMatches(matchId: string): Promise<CoinFlipMatchesResponse | null> {
  try {
    const match = await get(`coinFlipMatch/${matchId}`);
    if (!match) return null;
    return match as CoinFlipMatchesResponse;
  } catch (error) {
    console.error(`Error getting CoinFlipMatches:`, error);
    return null;
  }
}

export async function getManyCoinFlipMatches(): Promise<CoinFlipMatchesResponse[]> {
  try {
    return [];
  } catch (error) {
    console.error(`Error getting CoinFlipMatches collection:`, error);
    return [];
  }
}
