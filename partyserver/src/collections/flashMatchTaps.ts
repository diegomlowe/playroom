import { get, set } from '../db-client.js';

export interface FlashMatchTapsPlayersResponse {
  id: string;
  player: string;
  tapTime: string;
  reactionTime?: string | null;
}

export async function setFlashMatchTapsPlayers(
  matchId: string,
  playerAddress: string,
  data?: Record<string, any>,
): Promise<boolean> {
  try {
    await set(`flashMatchTap/${matchId}/${playerAddress}`, data);
    return true;
  } catch (error) {
    console.error(`Error setting FlashMatchTapsPlayers:`, error);
    return false;
  }
}

export async function getFlashMatchTapsPlayers(
  matchId: string,
  playerAddress: string,
): Promise<FlashMatchTapsPlayersResponse | null> {
  try {
    const tap = await get(`flashMatchTap/${matchId}/${playerAddress}`);
    if (!tap) return null;
    return tap as FlashMatchTapsPlayersResponse;
  } catch (error) {
    console.error(`Error getting FlashMatchTapsPlayers:`, error);
    return null;
  }
}

export async function getManyFlashMatchTapsPlayers(matchId: string): Promise<FlashMatchTapsPlayersResponse[]> {
  try {
    return [];
  } catch (error) {
    console.error(`Error getting FlashMatchTapsPlayers collection:`, error);
    return [];
  }
}
