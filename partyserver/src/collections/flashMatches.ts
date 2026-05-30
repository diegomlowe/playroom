import { get, set } from '../db-client.js';

export interface FlashMatchesResponse {
  id: string;
  creator: string;
  player2?: string | null;
  player3?: string | null;
  player4?: string | null;
  playerCount: number;
  state: string;
  flashMomentMs?: string | null;
  createdAt: number;
  startedAt?: number | null;
  winner?: string | null;
  secondPlace?: string | null;
  winnerDeltaMs?: number | null;
  secondPlaceDeltaMs?: number | null;
  ts: number;
  buyIn: string;
  buyInCurrency?: string;
}

export async function setFlashMatches(
  matchId: string,
  data: Record<string, any>,
): Promise<boolean> {
  try {
    await set(`flashMatch/${matchId}`, data);
    return true;
  } catch (error) {
    console.error(`Error setting FlashMatches:`, error);
    return false;
  }
}

export async function updateFlashMatches(
  matchId: string,
  data: Record<string, any>,
): Promise<boolean> {
  return setFlashMatches(matchId, data);
}

export async function getFlashMatches(matchId: string): Promise<FlashMatchesResponse | null> {
  try {
    const match = await get(`flashMatch/${matchId}`);
    if (!match) return null;
    return match as FlashMatchesResponse;
  } catch (error) {
    console.error(`Error getting FlashMatches:`, error);
    return null;
  }
}

export async function getManyFlashMatches(): Promise<FlashMatchesResponse[]> {
  try {
    return [];
  } catch (error) {
    console.error(`Error getting FlashMatches collection:`, error);
    return [];
  }
}
