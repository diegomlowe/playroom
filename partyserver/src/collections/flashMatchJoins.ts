import { get, set } from '../db-client.js';

export interface FlashMatchJoinsPlayersResponse {
  id: string;
  player: string;
  ts: number;
}

export async function setFlashMatchJoinsPlayers(
  matchId: string,
  playerAddress: string,
  data?: Record<string, any>,
): Promise<boolean> {
  try {
    await set(`flashMatchJoin/${matchId}/${playerAddress}`, data);
    return true;
  } catch (error) {
    console.error(`Error setting FlashMatchJoinsPlayers:`, error);
    return false;
  }
}

export async function getFlashMatchJoinsPlayers(
  matchId: string,
  playerAddress: string,
): Promise<FlashMatchJoinsPlayersResponse | null> {
  try {
    const join = await get(`flashMatchJoin/${matchId}/${playerAddress}`);
    if (!join) return null;
    return join as FlashMatchJoinsPlayersResponse;
  } catch (error) {
    console.error(`Error getting FlashMatchJoinsPlayers:`, error);
    return null;
  }
}

export async function getManyFlashMatchJoinsPlayers(matchId: string): Promise<FlashMatchJoinsPlayersResponse[]> {
  try {
    return [];
  } catch (error) {
    console.error(`Error getting FlashMatchJoinsPlayers collection:`, error);
    return [];
  }
}
